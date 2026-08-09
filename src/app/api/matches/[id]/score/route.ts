import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

type ScoreBody = { token: string; team: "A" | "B"; delta: 1 | 2 | -1 };

// Only ever adjusts the score — finalizing a match (at any score, no fixed
// win threshold) is a separate deliberate action via /final or /override.
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const body = (await request.json()) as ScoreBody;

  if (![1, 2, -1].includes(body.delta) || !["A", "B"].includes(body.team)) {
    return NextResponse.json({ error: "Invalid score request" }, { status: 400 });
  }

  const scoreColumn = body.team === "A" ? matches.scoreA : matches.scoreB;
  const [updated] = await db
    .update(matches)
    .set({
      [body.team === "A" ? "scoreA" : "scoreB"]: sql`GREATEST(${scoreColumn} + ${body.delta}, 0)`,
    })
    .where(and(eq(matches.id, matchId), eq(matches.status, "in_progress"), eq(matches.lockToken, body.token)))
    .returning();

  if (!updated) {
    const existing = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    return NextResponse.json(
      {
        error: "LOCK_MISMATCH",
        message:
          existing.status === "final"
            ? "This match is already final."
            : "This device no longer holds the lock for this match — ask admin to unlock.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}
