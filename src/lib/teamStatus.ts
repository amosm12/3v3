import type { Player } from "./types";

export function isTeamCheckedIn(players: Pick<Player, "isRequired" | "checkedIn">[]) {
  const required = players.filter((p) => p.isRequired);
  return required.length > 0 && required.every((p) => p.checkedIn);
}

export function isTeamPaid(players: Pick<Player, "isRequired" | "paid">[]) {
  const required = players.filter((p) => p.isRequired);
  return required.length > 0 && required.every((p) => p.paid);
}
