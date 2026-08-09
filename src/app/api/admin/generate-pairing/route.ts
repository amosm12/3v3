import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, matches, tournament, courts as courtsTable } from "@/lib/db/schema";
import { generateRandomPairing } from "@/lib/algorithms/randomPairing";
import { assignMatchSchedule } from "@/lib/algorithms/scheduleAssignment";
import { GROUP_STAGE_START_TIMES } from "@/lib/scheduleTimes";
import { GROUP_GENERATION_LOCK_KEY } from "@/lib/advisoryLocks";
import { getCourtRefsMap } from "@/lib/courtRefs";

export async function POST() {
  const existingGroupMatches = await db.query.matches.findFirst({
    where: eq(matches.phase, "group"),
  });
  if (existingGroupMatches) {
    return NextResponse.json(
      { error: "Group matches already exist. Reset tournament data before regenerating." },
      { status: 409 },
    );
  }

  // Uses every registered team, not just checked-in ones — the schedule can
  // be built ahead of the event; check-in tracks attendance separately.
  const allTeams = await db.select().from(teams);
  const teamIds = allTeams.map((t) => t.id);

  let generated;
  try {
    generated = generateRandomPairing(teamIds);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const courtRows = await db.select().from(courtsTable).orderBy(courtsTable.id);
  const courtRefs = await getCourtRefsMap(courtRows.map((c) => c.id));
  const bonusByPair = new Map(generated.matches.map((m) => [`${m.teamAId}-${m.teamBId}`, m.bonusGame]));
  const { scheduled, unscheduled } = assignMatchSchedule(
    generated.matches.map((m) => ({ teamAId: m.teamAId, teamBId: m.teamBId })),
    courtRows.length,
    GROUP_STAGE_START_TIMES.length,
  );

  const result = await db.transaction(async (tx) => {
    // Lock + re-check: a second request (rapid double-click, or racing the
    // groups-of-4 endpoint) may have passed the unlocked guard above before
    // this one committed. Re-verify under the lock, immediately before
    // writing, so at most one generation ever succeeds.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${GROUP_GENERATION_LOCK_KEY})`);
    const raceCheck = await tx.query.matches.findFirst({ where: eq(matches.phase, "group") });
    if (raceCheck) {
      return { alreadyExists: true as const };
    }

    const scheduledRows = scheduled.map((s) => {
      const courtId = courtRows[s.courtIndex]?.id ?? null;
      const { refId, refId2 } = (courtId != null && courtRefs.get(courtId)) || { refId: null, refId2: null };
      return {
        phase: "group" as const,
        roundLabel: `Group Stage ${s.roundIndex + 1}`,
        teamAId: s.teamAId,
        teamBId: s.teamBId,
        bonusGame: bonusByPair.get(`${s.teamAId}-${s.teamBId}`) ?? false,
        status: "scheduled" as const,
        scheduledTime: GROUP_STAGE_START_TIMES[s.roundIndex],
        courtId,
        refId,
        refId2,
      };
    });
    const unscheduledRows = unscheduled.map((u) => ({
      phase: "group" as const,
      roundLabel: "Unscheduled — assign manually",
      teamAId: u.teamAId,
      teamBId: u.teamBId,
      bonusGame: bonusByPair.get(`${u.teamAId}-${u.teamBId}`) ?? false,
      status: "scheduled" as const,
    }));

    await tx.insert(matches).values([...scheduledRows, ...unscheduledRows]);

    await tx.update(tournament).set({ groupFormat: "single_bracket_random_3", status: "group_stage" });

    return { alreadyExists: false as const };
  });

  if (result.alreadyExists) {
    return NextResponse.json(
      { error: "Group matches already exist. Reset tournament data before regenerating." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    matches: generated.matches.length,
    floaterTeamId: generated.floaterTeamId,
    bonusTeamIds: generated.bonusTeamIds,
    unscheduledCount: unscheduled.length,
  });
}
