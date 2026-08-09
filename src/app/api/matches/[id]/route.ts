import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { getCourtRefs } from "@/lib/courtRefs";
import { deriveRoundLabelFromTime } from "@/lib/scheduleTimes";
import { teamRefWithCheckedIn } from "@/lib/teamStatus";

type RouteParams = { params: Promise<{ id: string }> };

async function getMatchWithNames(id: number) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: {
      teamA: { with: { players: true } },
      teamB: { with: { players: true } },
      court: true,
      ref: true,
      ref2: true,
      group: true,
    },
  });
  if (!match) return match;
  return { ...match, teamA: teamRefWithCheckedIn(match.teamA), teamB: teamRefWithCheckedIn(match.teamB) };
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

  // A match's roundLabel follows its scheduledTime — re-derive it from the
  // canonical time grid on a time change, same pattern as refs following
  // courtId above. A time that isn't an exact hit on the grid (fully
  // custom, off-grid) leaves the existing label untouched rather than
  // guessing.
  let roundLabel: string | undefined;
  if (body.scheduledTime !== undefined && body.scheduledTime) {
    const derived = deriveRoundLabelFromTime(new Date(body.scheduledTime));
    if (derived) roundLabel = derived;
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
      ...(roundLabel !== undefined ? { roundLabel } : {}),
    })
    .where(eq(matches.id, Number(id)));

  const updated = await getMatchWithNames(Number(id));
  return NextResponse.json(updated);
}
