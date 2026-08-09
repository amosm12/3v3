import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refs } from "@/lib/db/schema";
import { generateSlug } from "@/lib/slug";

export async function GET() {
  const all = await db.query.refs.findMany({
    orderBy: (r, { asc }) => [asc(r.name)],
  });
  return NextResponse.json(all);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; assignedCourtId?: number | null };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Ref name is required" }, { status: 400 });
  }
  const [row] = await db
    .insert(refs)
    .values({
      name: body.name.trim(),
      slug: generateSlug(),
      assignedCourtId: body.assignedCourtId ?? null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
