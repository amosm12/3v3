import { eq } from "drizzle-orm";
import { after } from "next/server";
import type { db as Db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { attemptKnockoutSeeding } from "@/lib/knockoutSeeding";

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

/**
 * If `match` is a knockout match that feeds into another bracket slot,
 * writes the winner into that slot. Callers finalize (status/winnerId) the
 * match itself first, in the same transaction, so both writes commit or
 * roll back together.
 */
export async function propagateWinnerInTransaction(
  tx: Tx,
  match: typeof matches.$inferSelect,
  winnerId: number,
) {
  if (match.phase === "knockout" && match.feedsIntoMatchId && match.feedsIntoSlot) {
    await tx
      .update(matches)
      .set(match.feedsIntoSlot === "A" ? { teamAId: winnerId } : { teamBId: winnerId })
      .where(eq(matches.id, match.feedsIntoMatchId));
  }
}

/**
 * Best-effort, fire-and-forget from the caller's perspective: never throws,
 * never adds latency to the match-finalize response (runs via `after()`,
 * once the response has already been sent). Failures are logged; the manual
 * "Generate Knockout Bracket" button on /admin/seeding is the fallback if
 * this doesn't fire for some reason.
 *
 * `previousStatus` matters for callers (like the override route) that can
 * also touch an already-final match for unrelated reasons — pass it so we
 * only attempt seeding when this call is what caused the group→final
 * transition, not on every unrelated edit to an old match.
 */
export function maybeAutoSeedKnockout(match: typeof matches.$inferSelect, previousStatus?: string) {
  if (match.phase !== "group" || match.status !== "final") return;
  if (previousStatus === "final") return;

  after(async () => {
    try {
      await attemptKnockoutSeeding();
    } catch (err) {
      console.error("Auto-seed knockout attempt failed:", err);
    }
  });
}
