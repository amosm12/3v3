import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, tournament, teams, courts as courtsTable } from "@/lib/db/schema";
import { computeStandingsResponse } from "@/lib/standingsResponse";
import { buildSeedList, pairSeeds, type SeedEntry } from "@/lib/algorithms/seeding";
import { buildKnockoutBracket, type BracketMatchSpec, type BracketSlotSpec } from "@/lib/algorithms/bracket";
import { KNOCKOUT_ROUND_TIMES } from "@/lib/scheduleTimes";
import { KNOCKOUT_SEED_LOCK_KEY } from "@/lib/advisoryLocks";
import { getCourtRefsMap } from "@/lib/courtRefs";

// Round of 16 has 8 matches but only 5 courts, so it runs in two waves
// (4 matches, then the remaining 4) at the two R16 time slots.
const R16_WAVE_1_SIZE = 4;

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
  const courtRefs = await getCourtRefsMap(courtRows.map((c) => c.id));

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
      const { refId, refId2 } = (courtId != null && courtRefs.get(courtId)) || { refId: null, refId2: null };
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
