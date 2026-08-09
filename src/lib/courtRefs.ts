import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { refs as refsTable, matches as matchesTable } from "@/lib/db/schema";

export type CourtRefAssignment = { refId: number | null; refId2: number | null };

/**
 * Maps each of the given court ids to its up-to-2 assigned refs (ordered by
 * ref id for determinism). A ref is tied to exactly one court for the
 * whole event (`refs.assignedCourtId`), so this is the single source of
 * truth for who refs a match — every match on that court gets these same
 * two refs, whichever teams end up playing there.
 */
export async function getCourtRefsMap(courtIds: number[]): Promise<Map<number, CourtRefAssignment>> {
  const map = new Map<number, CourtRefAssignment>();
  if (courtIds.length === 0) return map;

  const rows = await db
    .select()
    .from(refsTable)
    .where(inArray(refsTable.assignedCourtId, courtIds))
    .orderBy(refsTable.id);

  for (const r of rows) {
    if (r.assignedCourtId == null) continue;
    const cur = map.get(r.assignedCourtId) ?? { refId: null, refId2: null };
    if (cur.refId == null) cur.refId = r.id;
    else if (cur.refId2 == null) cur.refId2 = r.id;
    map.set(r.assignedCourtId, cur);
  }
  return map;
}

export async function getCourtRefs(courtId: number | null): Promise<CourtRefAssignment> {
  if (courtId == null) return { refId: null, refId2: null };
  const map = await getCourtRefsMap([courtId]);
  return map.get(courtId) ?? { refId: null, refId2: null };
}

/**
 * Re-derives refId/refId2 from `courtId`'s current refs for every match on
 * that court that hasn't started yet — called whenever a ref's own court
 * assignment changes, or a match's court changes, so both stay in sync.
 * Scoped to `status: 'scheduled'` only; in-progress/final matches keep
 * whichever ref actually ran them, not whoever the court says now.
 */
export async function syncScheduledMatchRefsForCourt(courtId: number) {
  const { refId, refId2 } = await getCourtRefs(courtId);
  await db
    .update(matchesTable)
    .set({ refId, refId2 })
    .where(and(eq(matchesTable.courtId, courtId), eq(matchesTable.status, "scheduled")));
}
