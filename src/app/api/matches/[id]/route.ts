import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { getCourtRefs } from "@/lib/courtRefs";

type RouteParams = { params: Promise<{ id: string }> };

async function getMatchWithNames(id: number) {
  return db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: { teamA: true, teamB: true, court: true, ref: true, ref2: true, group: true },
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const match = await getMatchWithNames(Number(id));
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(match);
}

type PatchBody = {
  courtId?: number | null;
  refId?: number | null;
  refId2?: number | null;
  scheduledTime?: string | null;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  const existing = await db.query.matches.findFirst({ where: eq(matches.id, Number(id)) });
  if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  let refId = body.refId;
  let refId2 = body.refId2;
  // A match's refs follow its court — every match on a court is reffed by
  // that court's assigned refs. Re-derive them on a court change unless the
  // caller is also explicitly setting refs in this same request.
  if (body.courtId !== undefined && body.refId === undefined && body.refId2 === undefined) {
    const derived = await getCourtRefs(body.courtId);
    refId = derived.refId;
    refId2 = derived.refId2;
  }

  await db
    .update(matches)
    .set({
      ...(body.courtId !== undefined ? { courtId: body.courtId } : {}),
      ...(refId !== undefined ? { refId } : {}),
      ...(refId2 !== undefined ? { refId2 } : {}),
      ...(body.scheduledTime !== undefined
        ? { scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : null }
        : {}),
    })
    .where(eq(matches.id, Number(id)));

  const updated = await getMatchWithNames(Number(id));
  return NextResponse.json(updated);
}
