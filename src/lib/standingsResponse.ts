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
  // Called on every /live poll from every viewer — skip all queries
  // entirely before a format has even been chosen, rather than always
  // pulling the full teams table just to hit the empty-result fallback.
  if (!tour?.groupFormat) {
    return { format: null, groups: [], global: null };
  }

  if (tour.groupFormat === "groups_of_4") {
    const [allTeams, allGroups, finalGroupMatchesRaw] = await Promise.all([
      db.select().from(teams),
      db.select().from(groups).orderBy(groups.label),
      db
        .select()
        .from(matches)
        .where(and(eq(matches.phase, "group"), eq(matches.status, "final"))),
    ]);
    const teamById = new Map(allTeams.map((t) => [t.id, t]));
    const enrich = (rows: ReturnType<typeof computeStandings>) =>
      rows.map((r) => ({
        ...r,
        teamName: teamById.get(r.teamId)?.name ?? `Team #${r.teamId}`,
        teamSlug: teamById.get(r.teamId)?.slug ?? null,
      }));
    const finalGroupMatches = finalGroupMatchesRaw.filter(hasBothTeams);

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

  if (tour.groupFormat === "single_bracket_random_3") {
    const [allTeams, finalMatchesRaw] = await Promise.all([
      db.select().from(teams),
      db
        .select()
        .from(matches)
        .where(and(eq(matches.phase, "group"), eq(matches.status, "final"))),
    ]);
    const teamById = new Map(allTeams.map((t) => [t.id, t]));
    const enrich = (rows: ReturnType<typeof computeStandings>) =>
      rows.map((r) => ({
        ...r,
        teamName: teamById.get(r.teamId)?.name ?? `Team #${r.teamId}`,
        teamSlug: teamById.get(r.teamId)?.slug ?? null,
      }));
    const finalMatches = finalMatchesRaw.filter(hasBothTeams);
    const teamIds = allTeams.map((t) => t.id);

    return {
      format: "single_bracket_random_3",
      groups: [],
      global: enrich(computeStandings(teamIds, finalMatches)),
    };
  }

  return { format: null, groups: [], global: null };
}
