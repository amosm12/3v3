import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

// Reopens a final match for correction (the ref can then resubmit a
// corrected score). Deliberately narrow: does not retract any winner
// already propagated into a downstream knockout slot — that's a rare edge
// case left for manual admin cleanup (see plan notes).
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);

  const [updated] = await db
    .update(matches)
    .set({ status: "scheduled", winnerId: null })
    .where(eq(matches.id, matchId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(updated);
}
