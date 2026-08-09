import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ slug: string }> };

type Source = "admin" | "checkin";

type PayBody =
  | { markAllRequired: true; paid?: boolean; source: Source }
  | { playerId: number; paid: boolean; source: Source };

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const body = (await request.json()) as PayBody;

  const team = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // paidByAdmin only sticks when the mark is both `true` and admin-sourced —
  // it resets whenever a player is unmarked, so the next mark (from either
  // side) starts from a clean slate.
  if ("markAllRequired" in body) {
    const paid = body.paid ?? true;
    const updated = await db
      .update(players)
      .set({ paid, paidByAdmin: paid && body.source === "admin" })
      .where(and(eq(players.teamId, team.id), eq(players.isRequired, true)))
      .returning();
    return NextResponse.json(updated);
  }

  const [updated] = await db
    .update(players)
    .set({ paid: body.paid, paidByAdmin: body.paid && body.source === "admin" })
    .where(and(eq(players.id, body.playerId), eq(players.teamId, team.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
