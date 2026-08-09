import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const { playerId, checkedIn } = (await request.json()) as {
    playerId: number;
    checkedIn: boolean;
  };

  const team = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(players)
    .set({ checkedIn })
    .where(and(eq(players.id, playerId), eq(players.teamId, team.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
