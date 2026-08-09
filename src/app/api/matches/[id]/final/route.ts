import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { propagateWinnerInTransaction, maybeAutoSeedKnockout } from "@/lib/matchFinalize";

type RouteParams = { params: Promise<{ id: string }> };

// Refs submit the final score directly (a physical scoreboard runs the
// game — this app never tracks it live), so this is the only scoring
// action there is: one atomic scheduled -> final transition.
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const { scoreA, scoreB } = (await request.json()) as { scoreA: number; scoreB: number };

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return NextResponse.json(
      { error: "INVALID_SCORE", message: "Enter a valid score for both teams." },
      { status: 400 },
    );
  }
  if (scoreA === scoreB) {
    return NextResponse.json(
      { error: "TIED", message: "Scores can't be tied — double check and re-enter." },
      { status: 400 },
    );
  }

  const existing = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (existing.teamAId == null || existing.teamBId == null) {
    return NextResponse.json(
      { error: "TEAMS_NOT_SET", message: "Teams for this match aren't determined yet." },
      { status: 400 },
    );
  }

  const winnerId = scoreA > scoreB ? existing.teamAId : existing.teamBId;

  const result = await db.transaction(async (tx) => {
    // Conditional UPDATE is the race guard: only succeeds if still
    // 'scheduled', so two refs submitting at once can't both win.
    const [updated] = await tx
      .update(matches)
      .set({ scoreA, scoreB, status: "final", winnerId })
      .where(and(eq(matches.id, matchId), eq(matches.status, "scheduled")))
      .returning();

    if (updated) {
      await propagateWinnerInTransaction(tx, updated, winnerId);
    }

    return updated ?? null;
  });

  if (!result) {
    return NextResponse.json(
      { error: "ALREADY_FINAL", message: "This match's score has already been submitted." },
      { status: 409 },
    );
  }

  maybeAutoSeedKnockout(result);

  return NextResponse.json(result);
}
