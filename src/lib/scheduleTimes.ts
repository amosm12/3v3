// Fixed event-day schedule, confirmed by the organizer. Times are anchored
// to US Eastern (the venue's timezone) via an explicit UTC offset — NOT the
// server's runtime-local timezone. On Vercel that runtime defaults to UTC,
// so building these with the local Date constructor (new Date(y,m,d,h,min))
// would silently shift every match time by 4-5 hours in production even
// though it happens to look correct in local dev on an Eastern-time machine.
//
// August 9, 2026 falls within US Eastern Daylight Time (EDT = UTC-4).
const EASTERN_UTC_OFFSET_HOURS = 4;

function eventTime(hourEastern: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 9, hourEastern + EASTERN_UTC_OFFSET_HOURS, minute));
}

// 1:15–1:30, 1:40–1:55, 2:05–2:20, 2:30–2:45, 2:55–3:10, 3:20–3:35,
// 3:45–4:00, 4:10–4:25, 4:35–4:50 PM Eastern — start time of each 15-minute
// slot.
export const GROUP_STAGE_START_TIMES: Date[] = [
  eventTime(13, 15),
  eventTime(13, 40),
  eventTime(14, 5),
  eventTime(14, 30),
  eventTime(14, 55),
  eventTime(15, 20),
  eventTime(15, 45),
  eventTime(16, 10),
  eventTime(16, 35),
];

export const KNOCKOUT_ROUND_TIMES = {
  r16Wave1: eventTime(17, 5), // 5:05–5:20 PM
  r16Wave2: eventTime(17, 30), // 5:30–5:45 PM
  quarterfinal: eventTime(17, 55), // 5:55–6:10 PM
  semifinal: eventTime(18, 20), // 6:20–6:35 PM
  final: eventTime(18, 45), // 6:45–7:20 PM (longer: two-half championship format)
};

// Reverse lookup: given a match's new scheduledTime, what roundLabel does
// that slot correspond to on the canonical grid above? Used to keep
// roundLabel in sync when an admin manually edits a match's time (e.g. a
// swap) — mirrors how getCourtRefs re-derives refs from a court change.
// Returns null for a time that isn't an exact hit on the grid (a fully
// custom off-grid time), in which case callers should leave the existing
// roundLabel untouched rather than guessing.
export function deriveRoundLabelFromTime(time: Date): string | null {
  const t = time.getTime();

  const groupIndex = GROUP_STAGE_START_TIMES.findIndex((slot) => slot.getTime() === t);
  if (groupIndex !== -1) return `Group Stage ${groupIndex + 1}`;

  if (t === KNOCKOUT_ROUND_TIMES.r16Wave1.getTime() || t === KNOCKOUT_ROUND_TIMES.r16Wave2.getTime()) {
    return "Round of 16";
  }
  if (t === KNOCKOUT_ROUND_TIMES.quarterfinal.getTime()) return "Quarterfinal";
  if (t === KNOCKOUT_ROUND_TIMES.semifinal.getTime()) return "Semifinal";
  if (t === KNOCKOUT_ROUND_TIMES.final.getTime()) return "Final";

  return null;
}
