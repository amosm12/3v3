import { NextResponse } from "next/server";
import { eq, or, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const team = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const teamMatchFilter = or(eq(matches.teamAId, team.id), eq(matches.teamBId, team.id));

  const [groupMatches, knockoutMatches] = await Promise.all([
    db.query.matches.findMany({
      where: and(eq(matches.phase, "group"), teamMatchFilter),
      with: { teamA: true, teamB: true, court: true, ref: true, group: true },
      orderBy: (m, { asc }) => [asc(m.scheduledTime), asc(m.id)],
    }),
    db.query.matches.findMany({
      where: and(eq(matches.phase, "knockout"), teamMatchFilter),
      with: { teamA: true, teamB: true, court: true, ref: true, group: true },
      orderBy: (m, { asc }) => [asc(m.id)],
    }),
  ]);

  let eliminated = false;
  let champion = false;
  for (const m of knockoutMatches) {
    if (m.status === "final") {
      if (m.winnerId === team.id) {
        if (m.roundLabel === "Final") champion = true;
      } else {
        eliminated = true;
      }
    }
  }
  const bracketStatus =
    knockoutMatches.length === 0 ? "not_in_knockout" : champion ? "champion" : eliminated ? "eliminated" : "alive";

  return NextResponse.json({ team, groupMatches, knockoutMatches, bracketStatus });
}
