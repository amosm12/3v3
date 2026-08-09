import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, tournament } from "@/lib/db/schema";

// Narrower than /api/admin/reset — wipes only the 15 knockout matches and
// reverts the tournament to group_stage, leaving group-stage matches,
// scores, and groups untouched. Lets an admin reseed after a bad seed or
// to pick up a schedule/ref-rotation change, without losing the group
// stage the way "Reset Tournament Data" would.
export async function POST() {
  const [tour] = await db.select().from(tournament).limit(1);

  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.phase, "knockout"));
    if (tour) {
      await tx.update(tournament).set({ status: "group_stage" }).where(eq(tournament.id, tour.id));
    }
  });

  return NextResponse.json({ ok: true });
}
