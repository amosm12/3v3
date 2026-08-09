import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { propagateWinnerInTransaction, maybeAutoSeedKnockout } from "@/lib/matchFinalize";
import { WIN_SCORE } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

class LockMismatchError extends Error {}

type ScoreBody = { token: string; team: "A" | "B"; delta: 1 | 2 | -1 };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const body = (await request.json()) as ScoreBody;

  if (![1, 2, -1].includes(body.delta) || !["A", "B"].includes(body.team)) {
    return NextResponse.json({ error: "Invalid score request" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const scoreColumn = body.team === "A" ? matches.scoreA : matches.scoreB;
      const [updated] = await tx
        .update(matches)
        .set({
          [body.team === "A" ? "scoreA" : "scoreB"]: sql`GREATEST(${scoreColumn} + ${body.delta}, 0)`,
        })
        .where(
          and(
            eq(matches.id, matchId),
            eq(matches.status, "in_progress"),
            eq(matches.lockToken, body.token),
          ),
        )
        .returning();

      if (!updated) throw new LockMismatchError();

      const newScore = body.team === "A" ? updated.scoreA : updated.scoreB;
      if (newScore >= WIN_SCORE) {
        const winnerId = body.team === "A" ? updated.teamAId : updated.teamBId;
        if (winnerId) {
          await tx.update(matches).set({ status: "final", winnerId }).where(eq(matches.id, matchId));
          await propagateWinnerInTransaction(tx, updated, winnerId);
        }
      }

      return tx.query.matches.findFirst({ where: eq(matches.id, matchId) });
    });

    if (result) maybeAutoSeedKnockout(result);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LockMismatchError) {
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
    throw err;
  }
}
