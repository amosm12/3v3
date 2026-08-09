import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tournament } from "@/lib/db/schema";
import { computeStandingsResponse } from "@/lib/standingsResponse";

export async function GET() {
  const [tour] = await db.select().from(tournament).limit(1);
  const response = await computeStandingsResponse(tour ?? null);
  return NextResponse.json(response);
}
