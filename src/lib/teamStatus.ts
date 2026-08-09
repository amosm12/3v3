import type { Player } from "./types";

export function isTeamCheckedIn(players: Pick<Player, "isRequired" | "checkedIn">[]) {
  const required = players.filter((p) => p.isRequired);
  return required.length > 0 && required.every((p) => p.checkedIn);
}

export function isTeamPaid(players: Pick<Player, "isRequired" | "paid">[]) {
  const required = players.filter((p) => p.isRequired);
  return required.length > 0 && required.every((p) => p.paid);
}

// Collapses a team row loaded with its players (via a nested Drizzle `with`)
// into the slim TeamRef shape plus a computed `checkedIn`, for match queries
// that need to show check-in status without exposing the full roster.
export function teamRefWithCheckedIn<T extends { players: Pick<Player, "isRequired" | "checkedIn">[] }>(
  team: T | null,
): (Omit<T, "players"> & { checkedIn: boolean }) | null {
  if (!team) return null;
  const { players, ...rest } = team;
  return { ...rest, checkedIn: isTeamCheckedIn(players) };
}
