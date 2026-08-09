import { eq } from "drizzle-orm";
import type { db as Db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

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
