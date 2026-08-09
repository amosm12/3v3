export type GeneratedPairingMatch = {
  teamAId: number;
  teamBId: number;
  bonusGame: boolean;
};

export type RandomPairingResult = {
  matches: GeneratedPairingMatch[];
  floaterTeamId: number | null;
  bonusTeamIds: number[];
};

const MAX_STUB_MATCHING_ATTEMPTS = 2000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Attempts one randomized stub-matching pass: each team appears 3 times in
 * the stub list, the list is shuffled, and consecutive pairs become edges.
 * Returns null (a "reject the whole attempt") on any self-pair or duplicate
 * pair, so the caller can reshuffle and retry.
 */
function tryStubMatching(teamIds: number[]): [number, number][] | null {
  const stubs = shuffle(teamIds.flatMap((id) => [id, id, id]));
  const seen = new Set<string>();
  const edges: [number, number][] = [];

  for (let i = 0; i < stubs.length; i += 2) {
    const a = stubs[i];
    const b = stubs[i + 1];
    if (a === b) return null;
    const key = pairKey(a, b);
    if (seen.has(key)) return null;
    seen.add(key);
    edges.push([a, b]);
  }

  return edges;
}

/**
 * Deterministic fallback: a cycle (each team plays its two neighbors) plus
 * the "diameter" chord (each team also plays the team directly opposite it).
 * Always valid for even N >= 4 — provably 3-regular, no self-pairs, no
 * duplicate edges — used only if randomized retries are somehow exhausted.
 */
function circulantFallback(teamIds: number[]): [number, number][] {
  const order = shuffle(teamIds);
  const n = order.length;
  const edges: [number, number][] = [];
  const seen = new Set<string>();

  function addEdge(a: number, b: number) {
    const key = pairKey(a, b);
    if (!seen.has(key)) {
      seen.add(key);
      edges.push([a, b]);
    }
  }

  for (let i = 0; i < n; i++) {
    addEdge(order[i], order[(i + 1) % n]);
    addEdge(order[i], order[(i + n / 2) % n]);
  }

  return edges;
}

function generateEvenPairing(teamIds: number[]): [number, number][] {
  if (teamIds.length % 2 !== 0) {
    throw new Error("generateEvenPairing requires an even team count");
  }
  for (let attempt = 0; attempt < MAX_STUB_MATCHING_ATTEMPTS; attempt++) {
    const edges = tryStubMatching(teamIds);
    if (edges) return edges;
  }
  return circulantFallback(teamIds);
}

function assertValidPairing(
  teamIds: number[],
  matches: GeneratedPairingMatch[],
  expectedGames: Map<number, number>,
) {
  const gamesPlayed = new Map<number, number>(teamIds.map((id) => [id, 0]));
  const seenPairs = new Set<string>();

  for (const m of matches) {
    if (m.teamAId === m.teamBId) {
      throw new Error(`Invalid pairing: team ${m.teamAId} paired against itself`);
    }
    const key = pairKey(m.teamAId, m.teamBId);
    if (seenPairs.has(key)) {
      throw new Error(`Invalid pairing: duplicate matchup ${key}`);
    }
    seenPairs.add(key);
    gamesPlayed.set(m.teamAId, (gamesPlayed.get(m.teamAId) ?? 0) + 1);
    gamesPlayed.set(m.teamBId, (gamesPlayed.get(m.teamBId) ?? 0) + 1);
  }

  for (const id of teamIds) {
    if (gamesPlayed.get(id) !== expectedGames.get(id)) {
      throw new Error(
        `Invalid pairing: team ${id} played ${gamesPlayed.get(id)} games, expected ${expectedGames.get(id)}`,
      );
    }
  }
}

/**
 * Generates the single_bracket_random_3 fallback format: every team plays 3
 * games against randomly assigned opponents, no repeat matchups, no
 * self-play. For odd N (impossible to give every team exactly 3 games with a
 * simple graph — handshake lemma), one "floater" team is set aside, a clean
 * 3-regular pairing is built on the remaining N-1 teams, and the floater
 * plays 3 fresh games against 3 randomly chosen teams from that pool. Those
 * 3 teams end up with a bonus 4th game (flagged via bonusGame) rather than
 * any team playing fewer than 3 or any matchup repeating.
 */
export function generateRandomPairing(teamIds: number[]): RandomPairingResult {
  const n = teamIds.length;
  if (n < 4) {
    throw new Error(
      `single_bracket_random_3 requires at least 4 teams to give everyone 3 distinct opponents (got ${n}).`,
    );
  }

  const expectedGames = new Map<number, number>(teamIds.map((id) => [id, 3]));

  if (n % 2 === 0) {
    const edges = generateEvenPairing(teamIds);
    const matches = edges.map(([a, b]) => ({ teamAId: a, teamBId: b, bonusGame: false }));
    assertValidPairing(teamIds, matches, expectedGames);
    return { matches, floaterTeamId: null, bonusTeamIds: [] };
  }

  const shuffled = shuffle(teamIds);
  const floaterTeamId = shuffled[0];
  const pool = shuffled.slice(1);

  const poolEdges = generateEvenPairing(pool);
  const bonusTeamIds = shuffle(pool).slice(0, 3);
  expectedGames.set(floaterTeamId, 3);
  for (const id of bonusTeamIds) expectedGames.set(id, 4);

  const matches: GeneratedPairingMatch[] = [
    ...poolEdges.map(([a, b]) => ({ teamAId: a, teamBId: b, bonusGame: false })),
    ...bonusTeamIds.map((teamId) => ({
      teamAId: floaterTeamId,
      teamBId: teamId,
      bonusGame: true,
    })),
  ];

  assertValidPairing(teamIds, matches, expectedGames);
  return { matches, floaterTeamId, bonusTeamIds };
}
