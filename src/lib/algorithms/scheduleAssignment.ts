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

/**
 * Greedy first-fit: for each match (in the given order), place it in the
 * earliest round that still has an open court AND doesn't already have
 * either of its teams playing. A match that can't be placed anywhere within
 * `numRounds` (not enough capacity — more games than rounds*courts allows,
 * or an unlucky ordering) is returned in `unscheduled` rather than
 * skipped silently, so the caller can flag it for manual scheduling.
 */
function attemptSchedule(
  matches: UnscheduledMatch[],
  numCourts: number,
  numRounds: number,
): { scheduled: ScheduledMatch[]; unscheduled: UnscheduledMatch[] } {
  const roundTeams: Set<number>[] = Array.from({ length: numRounds }, () => new Set());
  const roundCourtCount: number[] = Array(numRounds).fill(0);
  const scheduled: ScheduledMatch[] = [];
  const unscheduled: UnscheduledMatch[] = [];

  for (const m of matches) {
    let placed = false;
    for (let r = 0; r < numRounds; r++) {
      if (roundCourtCount[r] >= numCourts) continue;
      if (roundTeams[r].has(m.teamAId) || roundTeams[r].has(m.teamBId)) continue;
      scheduled.push({ ...m, roundIndex: r, courtIndex: roundCourtCount[r] });
      roundTeams[r].add(m.teamAId);
      roundTeams[r].add(m.teamBId);
      roundCourtCount[r]++;
      placed = true;
      break;
    }
    if (!placed) unscheduled.push(m);
  }

  return { scheduled, unscheduled };
}

const MAX_ATTEMPTS = 50;

/**
 * Assigns each match a (round, court) slot so that no team plays twice in
 * the same round and at most `numCourts` matches run per round. Retries
 * with a reshuffled match order (same pattern as the pairing algorithm's
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
  let best = attemptSchedule(matches, numCourts, numRounds);

  for (let attempt = 0; attempt < MAX_ATTEMPTS && best.unscheduled.length > 0; attempt++) {
    const candidate = attemptSchedule(shuffle(matches), numCourts, numRounds);
    if (candidate.unscheduled.length < best.unscheduled.length) best = candidate;
  }

  return best;
}
