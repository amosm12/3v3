import type { SeedEntry } from "./seeding";

export type BracketMatchSpec = {
  key: string;
  roundLabel: string;
  teamAId: number | null;
  teamBId: number | null;
  feedsIntoKey: string | null;
  feedsIntoSlot: "A" | "B" | null;
};

export type BracketSlotSpec = {
  key: string;
  roundLabel: string;
  feedsIntoKey: string | null;
  feedsIntoSlot: "A" | "B" | null;
};

/**
 * The 15-slot bracket shape, independent of which teams end up in it. Order
 * matters: parents (Final, then Semifinals, then Quarterfinals) always
 * appear before the children that feed into them, since callers resolve
 * `feedsIntoKey` to a real DB id while inserting in this same order.
 * Exported so slots can be listed (e.g. for pre-assigning refs) before the
 * bracket is actually seeded.
 */
export const KNOCKOUT_SLOT_STRUCTURE: BracketSlotSpec[] = [
  { key: "F-0", roundLabel: "Final", feedsIntoKey: null, feedsIntoSlot: null },
  ...[0, 1].map((k) => ({
    key: `SF-${k}`,
    roundLabel: "Semifinal",
    feedsIntoKey: "F-0",
    feedsIntoSlot: (k === 0 ? "A" : "B") as "A" | "B",
  })),
  ...[0, 1, 2, 3].map((j) => ({
    key: `QF-${j}`,
    roundLabel: "Quarterfinal",
    feedsIntoKey: `SF-${Math.floor(j / 2)}`,
    feedsIntoSlot: (j % 2 === 0 ? "A" : "B") as "A" | "B",
  })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    key: `R16-${i}`,
    roundLabel: "Round of 16",
    feedsIntoKey: `QF-${Math.floor(i / 2)}`,
    feedsIntoSlot: (i % 2 === 0 ? "A" : "B") as "A" | "B",
  })),
];

/**
 * Builds the full 15-match single-elimination tree from 8 seeded Round-of-16
 * pairs: 8 R16 (teams filled in) + 4 QF + 2 SF + 1 Final (empty until R16
 * winners are known). Each match references its parent via a symbolic key
 * (`feedsIntoKey`/`feedsIntoSlot`) — the caller resolves these to real DB
 * ids when inserting, in reverse round order (Final first).
 */
export function buildKnockoutBracket(r16Pairs: [SeedEntry, SeedEntry][]): BracketMatchSpec[] {
  if (r16Pairs.length !== 8) {
    throw new Error(`buildKnockoutBracket requires exactly 8 Round-of-16 pairs, got ${r16Pairs.length}`);
  }

  return KNOCKOUT_SLOT_STRUCTURE.map((slot) => {
    if (!slot.key.startsWith("R16-")) {
      return { ...slot, teamAId: null, teamBId: null };
    }
    const i = Number(slot.key.split("-")[1]);
    const [a, b] = r16Pairs[i];
    return { ...slot, teamAId: a.teamId, teamBId: b.teamId };
  });
}
