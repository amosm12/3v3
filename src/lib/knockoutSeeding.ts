import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, tournament, teams, courts as courtsTable, refs as refsTable } from "@/lib/db/schema";
import { computeStandingsResponse } from "@/lib/standingsResponse";
import { buildSeedList, pairSeeds, type SeedEntry } from "@/lib/algorithms/seeding";
import { buildKnockoutBracket, type BracketMatchSpec, type BracketSlotSpec } from "@/lib/algorithms/bracket";
import { KNOCKOUT_ROUND_TIMES } from "@/lib/scheduleTimes";
import { KNOCKOUT_SEED_LOCK_KEY } from "@/lib/advisoryLocks";

// Round of 16 has 8 matches but only 5 courts, so it runs in two waves
// (4 matches, then the remaining 4) at the two R16 time slots.
const R16_WAVE_1_SIZE = 4;

// Groups of bracket-slot keys that run concurrently (same time, different
// courts) — a single ref can appear at most once per group. Knockout courts
// shrink round over round (4 courts through the Round of 16/Quarterfinal, 2
// for the Semifinal, 1 for the Final), so sticking to the simple "ref
// follows their assigned court" rule (as group-stage matches do, see
// courtRefs.ts) would leave whichever refs are on the now-unused courts
// completely idle for the rest of the tournament. Knockout refs instead
// rotate through every ref in the pool — see buildKnockoutRefRotation.
const KNOCKOUT_WAVES: string[][] = [
  ["R16-0", "R16-1", "R16-2", "R16-3"],
  ["R16-4", "R16-5", "R16-6", "R16-7"],
  ["QF-0", "QF-1", "QF-2", "QF-3"],
  ["SF-0", "SF-1"],
  ["F-0"],
];

/**
 * Assigns refId/refId2 for every knockout bracket slot by rotating through
 * the full ref roster (not just whoever's assigned to that match's court),
 * so refs whose own court sits idle once the field narrows still get
 * knockout games. Within a single wave (matches happening at the same
 * time) every assignment is a distinct ref — physically required, since
 * nobody can ref two concurrent matches — which also means with only 7
 * refs and up to 4 concurrent matches needing 2 refs each (8 slots), one
 * match per 4-wide wave necessarily gets only a primary ref, no backup.
 * The rotation's starting point advances each wave so it's not always the
 * same ref (or the same match) coming up short.
 */
export function buildKnockoutRefRotation(
  allRefs: { id: number }[],
): Map<string, { refId: number | null; refId2: number | null }> {
  const map = new Map<string, { refId: number | null; refId2: number | null }>();
  const n = allRefs.length;
  if (n === 0) return map;

  let cursor = 0;
  for (const wave of KNOCKOUT_WAVES) {
    const waveSize = wave.length;
    const lap = Array.from({ length: Math.min(n, waveSize * 2) }, (_, i) => allRefs[(cursor + i) % n]);
    const primaries = lap.slice(0, waveSize);
    const secondaries = lap.slice(waveSize, waveSize + Math.max(0, Math.min(waveSize, n - waveSize)));
    wave.forEach((key, i) => {
      map.set(key, { refId: primaries[i]?.id ?? null, refId2: secondaries[i]?.id ?? null });
    });
    cursor = (cursor + waveSize) % n;
  }
  return map;
}

export function scheduleForSpec(
  spec: BracketSlotSpec | BracketMatchSpec,
  courtRows: { id: number }[],
): { scheduledTime: Date | null; courtId: number | null } {
  if (spec.key.startsWith("R16-")) {
    const r16Index = Number(spec.key.split("-")[1]);
    const inWave2 = r16Index >= R16_WAVE_1_SIZE;
    const courtIndex = inWave2 ? r16Index - R16_WAVE_1_SIZE : r16Index;
    return {
      scheduledTime: inWave2 ? KNOCKOUT_ROUND_TIMES.r16Wave2 : KNOCKOUT_ROUND_TIMES.r16Wave1,
      courtId: courtRows[courtIndex]?.id ?? null,
    };
  }
  if (spec.key.startsWith("QF-")) {
    const courtIndex = Number(spec.key.split("-")[1]);
    return { scheduledTime: KNOCKOUT_ROUND_TIMES.quarterfinal, courtId: courtRows[courtIndex]?.id ?? null };
  }
  if (spec.key.startsWith("SF-")) {
    const courtIndex = Number(spec.key.split("-")[1]);
    return { scheduledTime: KNOCKOUT_ROUND_TIMES.semifinal, courtId: courtRows[courtIndex]?.id ?? null };
  }
  return { scheduledTime: KNOCKOUT_ROUND_TIMES.final, courtId: courtRows[0]?.id ?? null };
}

export type SeedAttemptResult =
  | { seeded: true; seeds: SeedEntry[]; unresolvedSeeds: number[] }
  | { seeded: false; reason: "NO_GROUP_FORMAT" }
  | { seeded: false; reason: "ALREADY_SEEDED" }
  | { seeded: false; reason: "GROUP_STAGE_INCOMPLETE"; pendingCount: number }
  | { seeded: false; reason: "INSUFFICIENT_TEAMS"; seedCount: number };

/**
 * Seeds the top-16 knockout bracket once every group-stage match is final.
 * Called both from the manual "Generate Knockout Bracket" admin action and
 * automatically after a group match finalizes (see matchFinalize.ts). Cheap
 * pre-checks run unlocked (this gets called on every group-match finalize,
 * so it must stay fast for the common "not done yet" case); only the actual
 * insert is guarded by an advisory lock + re-check.
 *
 * `force: true` skips the group-stage-complete check, seeding off whatever
 * standings exist right now — an admin escape hatch for a live event running
 * behind schedule. Standings already only count `status: 'final'` matches
 * (see standings.ts), so teams with fewer games played simply rank on win%
 * of what they've played, same as the existing bonus-game handling; any
 * group match still `scheduled` at that point is just left behind, unused.
 */
export async function attemptKnockoutSeeding(options?: { force?: boolean }): Promise<SeedAttemptResult> {
  const force = options?.force ?? false;

  const [tour] = await db.select().from(tournament).limit(1);
  if (!tour?.groupFormat) {
    return { seeded: false, reason: "NO_GROUP_FORMAT" };
  }

  const existingKnockout = await db.query.matches.findFirst({ where: eq(matches.phase, "knockout") });
  if (existingKnockout) {
    return { seeded: false, reason: "ALREADY_SEEDED" };
  }

  const pendingGroupMatches = await db.query.matches.findMany({
    where: and(eq(matches.phase, "group"), ne(matches.status, "final")),
  });
  if (!force && pendingGroupMatches.length > 0) {
    return { seeded: false, reason: "GROUP_STAGE_INCOMPLETE", pendingCount: pendingGroupMatches.length };
  }

  const standings = await computeStandingsResponse(tour);
  const allTeams = await db.select().from(teams);
  const teamGroupId = new Map(allTeams.map((t) => [t.id, t.groupId]));

  const seeds = buildSeedList(standings, teamGroupId);
  if (seeds.length !== 16) {
    return { seeded: false, reason: "INSUFFICIENT_TEAMS", seedCount: seeds.length };
  }

  const { pairs, unresolvedSeeds } = pairSeeds(seeds);
  const specs = buildKnockoutBracket(pairs);
  const courtRows = await db.select().from(courtsTable).orderBy(courtsTable.id);
  const allRefs = await db.select().from(refsTable).orderBy(refsTable.id);
  const refRotation = buildKnockoutRefRotation(allRefs);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${KNOCKOUT_SEED_LOCK_KEY})`);

    // Re-check under the lock: another concurrent call may have already
    // seeded (or the group stage may no longer look complete to it) between
    // our unlocked checks above and acquiring the lock just now.
    const raceCheck = await tx.query.matches.findFirst({ where: eq(matches.phase, "knockout") });
    if (raceCheck) {
      return { seeded: false, reason: "ALREADY_SEEDED" };
    }
    const stillPending = await tx.query.matches.findMany({
      where: and(eq(matches.phase, "group"), ne(matches.status, "final")),
    });
    if (!force && stillPending.length > 0) {
      return { seeded: false, reason: "GROUP_STAGE_INCOMPLETE", pendingCount: stillPending.length };
    }

    const idByKey = new Map<string, number>();
    for (const spec of specs) {
      const feedsIntoMatchId = spec.feedsIntoKey ? idByKey.get(spec.feedsIntoKey)! : null;
      const { scheduledTime, courtId } = scheduleForSpec(spec, courtRows);
      const { refId, refId2 } = refRotation.get(spec.key) ?? { refId: null, refId2: null };
      const [row] = await tx
        .insert(matches)
        .values({
          phase: "knockout",
          roundLabel: spec.roundLabel,
          teamAId: spec.teamAId,
          teamBId: spec.teamBId,
          status: "scheduled",
          feedsIntoMatchId,
          feedsIntoSlot: spec.feedsIntoSlot,
          scheduledTime,
          courtId,
          refId,
          refId2,
        })
        .returning();
      idByKey.set(spec.key, row.id);
    }

    await tx.update(tournament).set({ status: "knockout" }).where(eq(tournament.id, tour.id));

    return { seeded: true, seeds, unresolvedSeeds };
  });
}
