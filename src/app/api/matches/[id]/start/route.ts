import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const token = randomUUID();

  // Conditional UPDATE is the race guard: only succeeds if the match is
  // still 'scheduled', so two refs tapping Start at once can't both win.
  const updated = await db
    .update(matches)
    .set({ status: "in_progress", lockToken: token })
    .where(and(eq(matches.id, matchId), eq(matches.status, "scheduled")))
    .returning();

  if (updated.length === 0) {
    const existing = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!existing) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "ALREADY_STARTED", message: "This match was already started on another device." },
      { status: 409 },
    );
  }

  return NextResponse.json({ token, match: updated[0] });
}
