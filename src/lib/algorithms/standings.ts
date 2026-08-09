import type { StandingsRow } from "@/lib/types";

type FinalMatch = {
  teamAId: number;
  teamBId: number;
  scoreA: number;
  scoreB: number;
  winnerId: number | null;
};

type TeamAgg = {
  teamId: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
};

/**
 * Computes standings from only `status: 'final'` matches in scope (a single
 * group, or all matches for the random-pairing format which has none).
 * Tiebreak: bucket by win% (exact fraction equality, not floating point) →
 * a clean 2-way tie where those teams played each other resolves by that
 * head-to-head result → everything else (2 teams who never played, or any
 * 3+-way tie) falls straight to point differential, then total points.
 */
export function computeStandings(teamIds: number[], matches: FinalMatch[]): StandingsRow[] {
  const agg = new Map<number, TeamAgg>(
    teamIds.map((id) => [id, { teamId: id, wins: 0, losses: 0, gamesPlayed: 0, pointsFor: 0, pointsAgainst: 0 }]),
  );
  // headToHead.get(a)?.get(b) === winner team id for that a-vs-b game.
  const headToHead = new Map<number, Map<number, number>>();

  function recordH2H(a: number, b: number, winnerId: number) {
    if (!headToHead.has(a)) headToHead.set(a, new Map());
    headToHead.get(a)!.set(b, winnerId);
  }

  for (const m of matches) {
    if (m.winnerId == null) continue; // defensive: a final match should always have a winner
    const a = agg.get(m.teamAId);
    const b = agg.get(m.teamBId);
    if (!a || !b) continue; // match involves a team outside this scope

    a.gamesPlayed++;
    b.gamesPlayed++;
    a.pointsFor += m.scoreA;
    a.pointsAgainst += m.scoreB;
    b.pointsFor += m.scoreB;
    b.pointsAgainst += m.scoreA;

    if (m.winnerId === m.teamAId) {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
    recordH2H(m.teamAId, m.teamBId, m.winnerId);
    recordH2H(m.teamBId, m.teamAId, m.winnerId);
  }

  const teams = [...agg.values()];

  // Bucket by exact win% equality (cross-multiplication avoids float error),
  // ordered by win% descending. Teams with 0 games played rank last (0%).
  function winPct(t: TeamAgg) {
    return t.gamesPlayed === 0 ? 0 : t.wins / t.gamesPlayed;
  }
  function samePct(x: TeamAgg, y: TeamAgg) {
    if (x.gamesPlayed === 0 && y.gamesPlayed === 0) return true;
    return x.wins * y.gamesPlayed === y.wins * x.gamesPlayed;
  }

  const sorted = [...teams].sort((x, y) => winPct(y) - winPct(x));
  const buckets: TeamAgg[][] = [];
  for (const t of sorted) {
    const last = buckets[buckets.length - 1];
    if (last && samePct(last[0], t)) {
      last.push(t);
    } else {
      buckets.push([t]);
    }
  }

  function pointDiff(t: TeamAgg) {
    return t.pointsFor - t.pointsAgainst;
  }

  const ordered: TeamAgg[] = [];
  for (const bucket of buckets) {
    if (bucket.length === 1) {
      ordered.push(bucket[0]);
      continue;
    }
    if (bucket.length === 2 && headToHead.get(bucket[0].teamId)?.has(bucket[1].teamId)) {
      const winner = headToHead.get(bucket[0].teamId)!.get(bucket[1].teamId);
      const [a, b] = bucket;
      ordered.push(...(winner === a.teamId ? [a, b] : [b, a]));
      continue;
    }
    // 2 teams who never played, or a 3+-way tie: point diff, then total points.
    const tieBroken = [...bucket].sort(
      (x, y) => pointDiff(y) - pointDiff(x) || y.pointsFor - x.pointsFor,
    );
    ordered.push(...tieBroken);
  }

  return ordered.map((t, i) => ({
    teamId: t.teamId,
    wins: t.wins,
    losses: t.losses,
    gamesPlayed: t.gamesPlayed,
    winPct: winPct(t),
    pointsFor: t.pointsFor,
    pointsAgainst: t.pointsAgainst,
    pointDiff: pointDiff(t),
    rank: i + 1,
  }));
}
