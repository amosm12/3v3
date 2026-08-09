import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, matches, groups } from "@/lib/db/schema";
import { computeStandings } from "@/lib/algorithms/standings";
import type { StandingsResponse } from "@/lib/types";

type FinalRow = typeof matches.$inferSelect;

// A 'final' match always has both teams set — this narrows away the
// schema's nullable typing (which exists for not-yet-decided knockout slots).
function hasBothTeams(m: FinalRow): m is FinalRow & { teamAId: number; teamBId: number } {
  return m.teamAId != null && m.teamBId != null;
}

export async function computeStandingsResponse(
  tour: { groupFormat: string | null } | null,
): Promise<StandingsResponse> {
  const allTeams = await db.select().from(teams);
  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  function enrich(rows: ReturnType<typeof computeStandings>) {
    return rows.map((r) => ({
      ...r,
      teamName: teamById.get(r.teamId)?.name ?? `Team #${r.teamId}`,
      teamSlug: teamById.get(r.teamId)?.slug ?? null,
    }));
  }

  if (tour?.groupFormat === "groups_of_4") {
    const allGroups = await db.select().from(groups).orderBy(groups.label);
    const finalGroupMatches = (
      await db
        .select()
        .from(matches)
        .where(and(eq(matches.phase, "group"), eq(matches.status, "final")))
    ).filter(hasBothTeams);

    const result = allGroups.map((g) => {
      const teamIds = allTeams.filter((t) => t.groupId === g.id).map((t) => t.id);
      const groupMatches = finalGroupMatches.filter((m) => m.groupId === g.id);
      return {
        groupLabel: g.label,
        standings: enrich(computeStandings(teamIds, groupMatches)),
      };
    });

    return { format: "groups_of_4", groups: result, global: null };
  }

  if (tour?.groupFormat === "single_bracket_random_3") {
    const finalMatches = (
      await db
        .select()
        .from(matches)
        .where(and(eq(matches.phase, "group"), eq(matches.status, "final")))
    ).filter(hasBothTeams);
    const teamIds = allTeams.map((t) => t.id);
    return {
      format: "single_bracket_random_3",
      groups: [],
      global: enrich(computeStandings(teamIds, finalMatches)),
    };
  }

  return { format: null, groups: [], global: null };
}
