import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, tournament, threePointAttempts } from "@/lib/db/schema";
import { computeStandingsResponse } from "@/lib/standingsResponse";

export async function GET() {
  const [tour, threePoint, bracket] = await Promise.all([
    db.select().from(tournament).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(threePointAttempts),
    db.query.matches.findMany({
      where: eq(matches.phase, "knockout"),
      with: { teamA: true, teamB: true, court: true, group: true },
      orderBy: (m, { asc }) => [asc(m.id)],
    }),
  ]);

  const standings = await computeStandingsResponse(tour);

  return NextResponse.json({
    tournament: tour,
    standings,
    threePoint: [...threePoint].sort((a, b) => b.score - a.score),
    bracket,
  });
}
