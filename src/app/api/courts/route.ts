import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courts } from "@/lib/db/schema";

export async function GET() {
  const all = await db.select().from(courts).orderBy(courts.id);
  return NextResponse.json(all);
}
