import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { propagateWinnerInTransaction, maybeAutoSeedKnockout } from "@/lib/matchFinalize";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const { token } = (await request.json()) as { token: string };

  const result = await db.transaction(async (tx) => {
    // Atomic: only finalizes if still in_progress, held by this token, and
    // not tied (ties keep playing per the "no special OT mode" rule).
    const [updated] = await tx
      .update(matches)
      .set({
        status: "final",
        winnerId: sql`CASE WHEN ${matches.scoreA} > ${matches.scoreB} THEN ${matches.teamAId} WHEN ${matches.scoreB} > ${matches.scoreA} THEN ${matches.teamBId} ELSE NULL END`,
      })
      .where(
        and(
          eq(matches.id, matchId),
          eq(matches.status, "in_progress"),
          eq(matches.lockToken, token),
          sql`${matches.scoreA} <> ${matches.scoreB}`,
        ),
      )
      .returning();

    if (updated?.winnerId) {
      await propagateWinnerInTransaction(tx, updated, updated.winnerId);
    }

    return updated ?? null;
  });

  if (!result) {
    const existing = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    if (existing.status === "in_progress" && existing.scoreA === existing.scoreB) {
      return NextResponse.json(
        { error: "TIED", message: "Scores are tied — keep playing until there's a winner." },
        { status: 400 },
      );
    }
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

  maybeAutoSeedKnockout(result);

  return NextResponse.json(result);
}
