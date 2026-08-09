import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

// Clears the lock token so a different device can take over (dead phone,
// wrong tap). Only downgrades status back to 'scheduled' if it was
// 'in_progress' — a 'final' match is untouched (use un-finalize for that).
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const matchId = Number(id);

  const [updated] = await db
    .update(matches)
    .set({
      lockToken: null,
      status: sql`CASE WHEN ${matches.status} = 'in_progress' THEN 'scheduled' ELSE ${matches.status} END`,
    })
    .where(eq(matches.id, matchId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(updated);
}
