import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, groups, teams, tournament } from "@/lib/db/schema";

// Wipes matches/scores/groups only, per spec — teams, players (check-in and
// payment status), refs, and courts are left untouched.
export async function POST() {
  const [tour] = await db.select().from(tournament).limit(1);

  await db.transaction(async (tx) => {
    await tx.delete(matches);
    await tx.update(teams).set({ groupId: null }).where(isNotNull(teams.groupId));
    await tx.delete(groups);
    if (tour) {
      await tx
        .update(tournament)
        .set({ groupFormat: null, status: "setup" })
        .where(eq(tournament.id, tour.id));
    }
  });

  return NextResponse.json({ ok: true });
}
