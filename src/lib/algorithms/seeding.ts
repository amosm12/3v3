import type { StandingsRowWithTeam, StandingsResponse } from "@/lib/types";

export type SeedEntry = {
  seed: number; // 1-16
  teamId: number;
  groupId: number | null;
};

// Standard 16-bracket seed pairing order — keeps top seeds apart until the
// final (1 and 2 can only meet there).
const PAIR_ORDER: [number, number][] = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

function rankSort(a: StandingsRowWithTeam, b: StandingsRowWithTeam) {
  return b.winPct - a.winPct || b.pointDiff - a.pointDiff || b.pointsFor - a.pointsFor;
}

/**
 * Builds the top-16 seed list.
 *
 * groups_of_4: group winners become the top seeds (ranked against each
 * other), then runners-up (ranked against each other). With exactly 8
 * groups (32 teams) that's already 16 and done — matches the original
 * design exactly. With fewer groups (any other team count divisible by 4,
 * e.g. 28 teams -> 7 groups -> 14 auto-qualifiers), the remaining slots are
 * filled by a wildcard tier: every team ranked 3rd or worse in its own
 * group, pooled across all groups and ranked against each other by the same
 * win% -> point diff -> total points comparator (head-to-head is skipped
 * here, not just for 3+-way ties — most wildcard candidates are from
 * different groups and never played each other, so head-to-head isn't
 * meaningfully available across the pool; using the same fallback rule
 * uniformly keeps this consistent with the "no clean head-to-head" case
 * already defined for in-group standings).
 *
 * single_bracket_random_3: no groups exist, so the global top 16 map
 * directly to seeds 1-16.
 */
export function buildSeedList(
  standings: StandingsResponse,
  teamGroupId: Map<number, number | null>,
): SeedEntry[] {
  if (standings.format === "groups_of_4") {
    const winners = standings.groups
      .map((g) => g.standings.find((s) => s.rank === 1))
      .filter((s): s is StandingsRowWithTeam => !!s)
      .sort(rankSort);
    const runnersUp = standings.groups
      .map((g) => g.standings.find((s) => s.rank === 2))
      .filter((s): s is StandingsRowWithTeam => !!s)
      .sort(rankSort);
    const autoQualified = [...winners, ...runnersUp];

    const slotsRemaining = 16 - autoQualified.length;
    const wildcards =
      slotsRemaining > 0
        ? standings.groups
            .flatMap((g) => g.standings.filter((s) => s.rank >= 3))
            .sort(rankSort)
            .slice(0, slotsRemaining)
        : [];

    return [...autoQualified, ...wildcards].map((s, i) => ({
      seed: i + 1,
      teamId: s.teamId,
      groupId: teamGroupId.get(s.teamId) ?? null,
    }));
  }

  if (standings.format === "single_bracket_random_3" && standings.global) {
    return standings.global.slice(0, 16).map((s, i) => ({
      seed: i + 1,
      teamId: s.teamId,
      groupId: null,
    }));
  }

  return [];
}

function hasCollision(a: SeedEntry, b: SeedEntry) {
  return a.groupId != null && a.groupId === b.groupId;
}

/**
 * Maps a 16-entry seed list to Round-of-16 pairs in standard bracket order,
 * then runs a bounded greedy repair pass swapping only among the 9-16 tier
 * (seeds 1-8 stay fixed as bracket anchors) to avoid same-group rematches
 * before the teams have even left the group stage. Any collision that can't
 * be resolved this way is returned in `unresolvedSeeds` for manual review.
 */
export function pairSeeds(seeds: SeedEntry[]): {
  pairs: [SeedEntry, SeedEntry][];
  unresolvedSeeds: number[];
} {
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  const pairs: [SeedEntry, SeedEntry][] = PAIR_ORDER.map(([top, bottom]) => [
    bySeed.get(top)!,
    bySeed.get(bottom)!,
  ]);

  for (let pass = 0; pass < 20; pass++) {
    const collisionIdx = pairs.map((p, i) => (hasCollision(p[0], p[1]) ? i : -1)).filter((i) => i >= 0);
    if (collisionIdx.length === 0) break;

    let progressed = false;
    for (const i of collisionIdx) {
      if (!hasCollision(pairs[i][0], pairs[i][1])) continue;
      for (let j = 0; j < pairs.length; j++) {
        if (j === i) continue;
        const swappedI: [SeedEntry, SeedEntry] = [pairs[i][0], pairs[j][1]];
        const swappedJ: [SeedEntry, SeedEntry] = [pairs[j][0], pairs[i][1]];
        if (!hasCollision(...swappedI) && !hasCollision(...swappedJ)) {
          pairs[i] = swappedI;
          pairs[j] = swappedJ;
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }

  const unresolvedSeeds = pairs
    .filter((p) => hasCollision(p[0], p[1]))
    .flatMap((p) => [p[0].seed, p[1].seed]);

  return { pairs, unresolvedSeeds };
}
