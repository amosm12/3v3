import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { threePointAttempts } from "@/lib/db/schema";

export async function GET() {
  const all = await db
    .select()
    .from(threePointAttempts)
    .orderBy(desc(threePointAttempts.enteredAt));
  return NextResponse.json(all);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { entrantName: string; score: number };
  if (!body.entrantName?.trim() || typeof body.score !== "number" || !Number.isFinite(body.score)) {
    return NextResponse.json({ error: "Name and a numeric score are required" }, { status: 400 });
  }
  const [row] = await db
    .insert(threePointAttempts)
    .values({ entrantName: body.entrantName.trim(), score: body.score })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
