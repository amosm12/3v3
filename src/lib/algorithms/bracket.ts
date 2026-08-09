import type { SeedEntry } from "./seeding";

export type BracketMatchSpec = {
  key: string;
  roundLabel: string;
  teamAId: number | null;
  teamBId: number | null;
  feedsIntoKey: string | null;
  feedsIntoSlot: "A" | "B" | null;
};

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

  const specs: BracketMatchSpec[] = [];

  specs.push({
    key: "F-0",
    roundLabel: "Final",
    teamAId: null,
    teamBId: null,
    feedsIntoKey: null,
    feedsIntoSlot: null,
  });

  for (let k = 0; k < 2; k++) {
    specs.push({
      key: `SF-${k}`,
      roundLabel: "Semifinal",
      teamAId: null,
      teamBId: null,
      feedsIntoKey: "F-0",
      feedsIntoSlot: k === 0 ? "A" : "B",
    });
  }

  for (let j = 0; j < 4; j++) {
    specs.push({
      key: `QF-${j}`,
      roundLabel: "Quarterfinal",
      teamAId: null,
      teamBId: null,
      feedsIntoKey: `SF-${Math.floor(j / 2)}`,
      feedsIntoSlot: j % 2 === 0 ? "A" : "B",
    });
  }

  for (let i = 0; i < 8; i++) {
    const [a, b] = r16Pairs[i];
    specs.push({
      key: `R16-${i}`,
      roundLabel: "Round of 16",
      teamAId: a.teamId,
      teamBId: b.teamId,
      feedsIntoKey: `QF-${Math.floor(i / 2)}`,
      feedsIntoSlot: i % 2 === 0 ? "A" : "B",
    });
  }

  return specs;
}
