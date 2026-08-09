import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { refs, matches } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const ref = await db.query.refs.findFirst({ where: eq(refs.slug, slug) });
  if (!ref) return NextResponse.json({ error: "Ref not found" }, { status: 404 });

  const assignedMatches = await db.query.matches.findMany({
    where: eq(matches.refId, ref.id),
    with: { teamA: true, teamB: true, court: true, group: true },
    orderBy: (m, { asc }) => [asc(m.scheduledTime), asc(m.id)],
  });

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
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const existing = await db.query.refs.findFirst({ where: eq(refs.slug, slug) });
  if (!existing) return NextResponse.json({ error: "Ref not found" }, { status: 404 });
  await db.delete(refs).where(eq(refs.id, existing.id));
  return NextResponse.json({ ok: true });
}
