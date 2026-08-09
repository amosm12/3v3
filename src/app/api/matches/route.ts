import { NextResponse } from "next/server";
import { and, eq, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conditions: SQL[] = [];

  const phase = searchParams.get("phase");
  if (phase) conditions.push(eq(matches.phase, phase));

  const status = searchParams.get("status");
  if (status) conditions.push(eq(matches.status, status));

  const refId = searchParams.get("refId");
  if (refId) conditions.push(or(eq(matches.refId, Number(refId)), eq(matches.refId2, Number(refId)))!);

  const groupId = searchParams.get("groupId");
  if (groupId) conditions.push(eq(matches.groupId, Number(groupId)));

  const all = await db.query.matches.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      teamA: true,
      teamB: true,
      court: true,
      ref: true,
      ref2: true,
      group: true,
    },
    orderBy: (m, { asc }) => [asc(m.id)],
  });

  return NextResponse.json(all);
}
