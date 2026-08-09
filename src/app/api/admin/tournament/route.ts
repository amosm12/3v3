import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tournament } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TournamentStatus, GroupFormat } from "@/lib/types";

async function getTournament() {
  const [row] = await db.select().from(tournament).limit(1);
  return row;
}

export async function GET() {
  const row = await getTournament();
  if (!row) {
    return NextResponse.json({ error: "Tournament not seeded" }, { status: 404 });
  }
  return NextResponse.json(row);
}

type PatchBody = { status?: TournamentStatus; groupFormat?: GroupFormat | null };

export async function PATCH(request: Request) {
  const body = (await request.json()) as PatchBody;
  const row = await getTournament();
  if (!row) {
    return NextResponse.json({ error: "Tournament not seeded" }, { status: 404 });
  }

  const [updated] = await db
    .update(tournament)
    .set({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.groupFormat !== undefined ? { groupFormat: body.groupFormat } : {}),
    })
    .where(eq(tournament.id, row.id))
    .returning();

  return NextResponse.json(updated);
}
