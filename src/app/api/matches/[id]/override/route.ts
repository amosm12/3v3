import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { propagateWinnerInTransaction, maybeAutoSeedKnockout } from "@/lib/matchFinalize";

type RouteParams = { params: Promise<{ id: string }> };

type OverrideBody = Partial<{
  scoreA: number;
  scoreB: number;
  winnerId: number | null;
  teamAId: number | null;
  teamBId: number | null;
  status: "scheduled" | "final";
  courtId: number | null;
  refId: number | null;
  refId2: number | null;
  scheduledTime: string | null;
}>;

// Admin-trusted: no lock-token check. Also used as the "manual seed
// override" mechanism (reassigning teamAId/teamBId on a knockout match).
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);
  const body = (await request.json()) as OverrideBody;

  const existing = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(matches)
      .set({
        ...(body.scoreA !== undefined ? { scoreA: body.scoreA } : {}),
        ...(body.scoreB !== undefined ? { scoreB: body.scoreB } : {}),
        ...(body.winnerId !== undefined ? { winnerId: body.winnerId } : {}),
        ...(body.teamAId !== undefined ? { teamAId: body.teamAId } : {}),
        ...(body.teamBId !== undefined ? { teamBId: body.teamBId } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.courtId !== undefined ? { courtId: body.courtId } : {}),
        ...(body.refId !== undefined ? { refId: body.refId } : {}),
        ...(body.refId2 !== undefined ? { refId2: body.refId2 } : {}),
        ...(body.scheduledTime !== undefined
          ? { scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : null }
          : {}),
      })
      .where(eq(matches.id, matchId))
      .returning();

    if (updated.status === "final" && updated.winnerId != null) {
      await propagateWinnerInTransaction(tx, updated, updated.winnerId);
    }

    return updated;
  });

  maybeAutoSeedKnockout(result, existing.status);

  return NextResponse.json(result);
}
