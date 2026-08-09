import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courts as courtsTable, knockoutRefPlan } from "@/lib/db/schema";
import { KNOCKOUT_SLOT_STRUCTURE } from "@/lib/algorithms/bracket";
import { scheduleForSpec } from "@/lib/knockoutSeeding";

// Lets an admin pre-assign the 2 refs for each of the 15 bracket slots
// (Round of 16 through Final) before the knockout stage exists — i.e.
// before it's known which teams will actually land in each slot. The plan
// is consulted at bracket-seeding time (see knockoutSeeding.ts) to set each
// new match's refId/refId2 as it's created.
export async function GET() {
  const courtRows = await db.select().from(courtsTable).orderBy(courtsTable.id);
  const planRows = await db.select().from(knockoutRefPlan);
  const planBySlot = new Map(planRows.map((p) => [p.slotKey, p]));

  const slots = KNOCKOUT_SLOT_STRUCTURE.map((spec) => {
    const { scheduledTime, courtId } = scheduleForSpec(spec, courtRows);
    const court = courtRows.find((c) => c.id === courtId) ?? null;
    const plan = planBySlot.get(spec.key);
    return {
      slotKey: spec.key,
      roundLabel: spec.roundLabel,
      expectedTime: scheduledTime,
      expectedCourtLabel: court?.label ?? null,
      refId: plan?.refId ?? null,
      refId2: plan?.refId2 ?? null,
    };
  });

  return NextResponse.json(slots);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { slotKey, refId, refId2 } = body as {
    slotKey?: string;
    refId?: number | null;
    refId2?: number | null;
  };

  if (!slotKey || !KNOCKOUT_SLOT_STRUCTURE.some((s) => s.key === slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  // Only touch the field(s) actually sent, so setting one ref doesn't wipe
  // out the other one already saved for this slot.
  const setClause: Partial<{ refId: number | null; refId2: number | null }> = {};
  if ("refId" in body) setClause.refId = refId ?? null;
  if ("refId2" in body) setClause.refId2 = refId2 ?? null;

  await db
    .insert(knockoutRefPlan)
    .values({ slotKey, refId: refId ?? null, refId2: refId2 ?? null })
    .onConflictDoUpdate({ target: knockoutRefPlan.slotKey, set: setClause });

  return NextResponse.json({ ok: true });
}
