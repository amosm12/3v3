import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ slug: string }> };

type CheckinBody = { markAllRequired: true; checkedIn?: boolean } | { playerId: number; checkedIn: boolean };

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const body = (await request.json()) as CheckinBody;

  const team = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if ("markAllRequired" in body) {
    const checkedIn = body.checkedIn ?? true;
    const updated = await db
      .update(players)
      .set({ checkedIn })
      .where(and(eq(players.teamId, team.id), eq(players.isRequired, true)))
      .returning();
    return NextResponse.json(updated);
  }

  const [updated] = await db
    .update(players)
    .set({ checkedIn: body.checkedIn })
    .where(and(eq(players.id, body.playerId), eq(players.teamId, team.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
