export type GeneratedMatch = {
  groupLabel: string;
  roundLabel: string;
  teamAId: number;
  teamBId: number;
};

export type GeneratedGroup = {
  label: string;
  teamIds: number[];
};

export type GroupsOfFourResult = {
  groups: GeneratedGroup[];
  matches: GeneratedMatch[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupLabelFor(index: number): string {
  // Supports up to 26 groups (A-Z) — comfortably covers the 8-group, 32-team max.
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/**
 * Splits N teams (N % 4 === 0) into N/4 groups of 4 and generates the
 * standard 3-round circle-method round robin within each group:
 *   Round 1: 1v4, 2v3
 *   Round 2: 1v3, 4v2
 *   Round 3: 1v2, 3v4
 */
export function generateGroupsOfFour(teamIds: number[]): GroupsOfFourResult {
  const n = teamIds.length;
  if (n === 0 || n % 4 !== 0) {
    throw new Error(
      `groups_of_4 requires a team count divisible by 4 (got ${n}); use the random-pairing format instead.`,
    );
  }

  const shuffled = shuffle(teamIds);
  const groups: GeneratedGroup[] = [];
  const matches: GeneratedMatch[] = [];

  for (let g = 0; g < n / 4; g++) {
    const [t1, t2, t3, t4] = shuffled.slice(g * 4, g * 4 + 4);
    const label = groupLabelFor(g);
    groups.push({ label, teamIds: [t1, t2, t3, t4] });

    matches.push(
      { groupLabel: label, roundLabel: "Round 1", teamAId: t1, teamBId: t4 },
      { groupLabel: label, roundLabel: "Round 1", teamAId: t2, teamBId: t3 },
      { groupLabel: label, roundLabel: "Round 2", teamAId: t1, teamBId: t3 },
      { groupLabel: label, roundLabel: "Round 2", teamAId: t4, teamBId: t2 },
      { groupLabel: label, roundLabel: "Round 3", teamAId: t1, teamBId: t2 },
      { groupLabel: label, roundLabel: "Round 3", teamAId: t3, teamBId: t4 },
    );
  }

  return { groups, matches };
}
