import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { refs, matches } from "@/lib/db/schema";
import { syncScheduledMatchRefsForCourt } from "@/lib/courtRefs";
import { teamRefWithCheckedIn } from "@/lib/teamStatus";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const ref = await db.query.refs.findFirst({ where: eq(refs.slug, slug) });
  if (!ref) return NextResponse.json({ error: "Ref not found" }, { status: 404 });

  const assignedMatchesRaw = await db.query.matches.findMany({
    where: or(eq(matches.refId, ref.id), eq(matches.refId2, ref.id)),
    with: {
      teamA: { with: { players: true } },
      teamB: { with: { players: true } },
      court: true,
      ref: true,
      ref2: true,
      group: true,
    },
    orderBy: (m, { asc }) => [asc(m.scheduledTime), asc(m.id)],
  });
  const assignedMatches = assignedMatchesRaw.map((m) => ({
    ...m,
    teamA: teamRefWithCheckedIn(m.teamA),
    teamB: teamRefWithCheckedIn(m.teamB),
  }));

  return NextResponse.json({ ...ref, matches: assignedMatches });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const body = (await request.json()) as { name?: string; assignedCourtId?: number | null };
  const existing = await db.query.refs.findFirst({ where: eq(refs.slug, slug) });
  if (!existing) return NextResponse.json({ error: "Ref not found" }, { status: 404 });

  const [updated] = await db
    .update(refs)
    .set({
      ...(body.name?.trim() ? { name: body.name.trim() } : {}),
      ...(body.assignedCourtId !== undefined ? { assignedCourtId: body.assignedCourtId } : {}),
    })
    .where(eq(refs.id, existing.id))
    .returning();

  // A ref's court assignment is the source of truth for who reffs every
  // match on that court — keep both the old and new court's still-scheduled
  // matches in sync with whoever is actually assigned there now.
  if (body.assignedCourtId !== undefined && body.assignedCourtId !== existing.assignedCourtId) {
    if (existing.assignedCourtId != null) await syncScheduledMatchRefsForCourt(existing.assignedCourtId);
    if (body.assignedCourtId != null) await syncScheduledMatchRefsForCourt(body.assignedCourtId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const existing = await db.query.refs.findFirst({ where: eq(refs.slug, slug) });
  if (!existing) return NextResponse.json({ error: "Ref not found" }, { status: 404 });

  // Clear any match still referencing this ref before deleting it, or the
  // foreign key constraint blocks the delete.
  await db.update(matches).set({ refId: null }).where(eq(matches.refId, existing.id));
  await db.update(matches).set({ refId2: null }).where(eq(matches.refId2, existing.id));

  await db.delete(refs).where(eq(refs.id, existing.id));

  // Backfill the now-open slot on their court from whichever ref(s) remain.
  if (existing.assignedCourtId != null) {
    await syncScheduledMatchRefsForCourt(existing.assignedCourtId);
  }

  return NextResponse.json({ ok: true });
}
