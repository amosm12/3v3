import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threePointAttempts } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as { entrantName?: string; score?: number };

  const [updated] = await db
    .update(threePointAttempts)
    .set({
      ...(body.entrantName?.trim() ? { entrantName: body.entrantName.trim() } : {}),
      ...(typeof body.score === "number" && Number.isFinite(body.score) ? { score: body.score } : {}),
    })
    .where(eq(threePointAttempts.id, Number(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  await db.delete(threePointAttempts).where(eq(threePointAttempts.id, Number(id)));
  return NextResponse.json({ ok: true });
}
