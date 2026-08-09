export type UnscheduledMatch = {
  teamAId: number;
  teamBId: number;
};

export type ScheduledMatch = UnscheduledMatch & {
  roundIndex: number; // 0-based index into the round-time-slot list
  courtIndex: number; // 0-based index into the courts list
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Greedy first-fit: for each match (in the given order), place it in the
 * first round (tried in `roundOrder`) that still has an open court, doesn't
 * already have either team playing, and isn't immediately adjacent to a
 * round either team is already booked in (no team plays back-to-back
 * rounds — their next game must skip at least one round). A match that
 * can't be placed anywhere within `numRounds` (not enough capacity, or an
 * unlucky ordering) is returned in `unscheduled` rather than skipped
 * silently, so the caller can flag it for manual scheduling.
 */
function attemptSchedule(
  matches: UnscheduledMatch[],
  numCourts: number,
  numRounds: number,
  roundOrder: number[],
): { scheduled: ScheduledMatch[]; unscheduled: UnscheduledMatch[] } {
  const roundTeams: Set<number>[] = Array.from({ length: numRounds }, () => new Set());
  const roundCourtCount: number[] = Array(numRounds).fill(0);
  const teamRounds = new Map<number, number[]>();
  const scheduled: ScheduledMatch[] = [];
  const unscheduled: UnscheduledMatch[] = [];

  function isBackToBack(teamId: number, r: number) {
    const used = teamRounds.get(teamId);
    return !!used && used.some((ur) => Math.abs(ur - r) === 1);
  }

  for (const m of matches) {
    let placed = false;
    for (const r of roundOrder) {
      if (roundCourtCount[r] >= numCourts) continue;
      if (roundTeams[r].has(m.teamAId) || roundTeams[r].has(m.teamBId)) continue;
      if (isBackToBack(m.teamAId, r) || isBackToBack(m.teamBId, r)) continue;

      scheduled.push({ ...m, roundIndex: r, courtIndex: roundCourtCount[r] });
      roundTeams[r].add(m.teamAId);
      roundTeams[r].add(m.teamBId);
      roundCourtCount[r]++;
      teamRounds.set(m.teamAId, [...(teamRounds.get(m.teamAId) ?? []), r]);
      teamRounds.set(m.teamBId, [...(teamRounds.get(m.teamBId) ?? []), r]);
      placed = true;
      break;
    }
    if (!placed) unscheduled.push(m);
  }

  return { scheduled, unscheduled };
}

// The back-to-back constraint leaves zero slack when round*court capacity
// exactly matches the match count (the common case), so a plain greedy
// first-fit needs many more randomized shots at it than the old
// same-round-only constraint did before reliably landing a full packing.
const MAX_ATTEMPTS = 20000;

/**
 * Assigns each match a (round, court) slot so that no team plays twice in
 * the same round, no team plays two rounds in a row, and at most
 * `numCourts` matches run per round. Retries with a reshuffled match order
 * AND round try-order (same pattern as the pairing algorithm's
 * retry-on-reject approach) since greedy first-fit is order-sensitive and
 * an unlucky order can leave a match unplaced even when a full assignment
 * exists. Keeps the best attempt seen (fewest unscheduled, zero if any
 * attempt fully succeeds) rather than the first.
 */
export function assignMatchSchedule(
  matches: UnscheduledMatch[],
  numCourts: number,
  numRounds: number,
): { scheduled: ScheduledMatch[]; unscheduled: UnscheduledMatch[] } {
  const naturalRoundOrder = range(numRounds);
  let best = attemptSchedule(matches, numCourts, numRounds, naturalRoundOrder);

  for (let attempt = 0; attempt < MAX_ATTEMPTS && best.unscheduled.length > 0; attempt++) {
    const candidate = attemptSchedule(shuffle(matches), numCourts, numRounds, shuffle(naturalRoundOrder));
    if (candidate.unscheduled.length < best.unscheduled.length) best = candidate;
  }

  return best;
}
