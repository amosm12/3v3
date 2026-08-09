export type TournamentStatus =
  | "setup"
  | "checkin"
  | "group_stage"
  | "knockout"
  | "complete";

export type GroupFormat = "groups_of_4" | "single_bracket_random_3";

export type MatchPhase = "group" | "knockout";
export type MatchStatus = "scheduled" | "in_progress" | "final";

export type Player = {
  id: number;
  teamId: number;
  name: string;
  isRequired: boolean;
  paid: boolean;
  paidByAdmin: boolean; // true only when the current paid:true was set from /admin
  checkedIn: boolean;
  phone: string | null;
};

export type Team = {
  id: number;
  slug: string;
  name: string;
  groupId: number | null;
  players: Player[];
  checkedIn: boolean; // computed: every required player checked in
  paid: boolean; // computed: every required player paid
};

export type Ref = {
  id: number;
  slug: string;
  name: string;
  assignedCourtId: number | null;
};

export type Court = {
  id: number;
  label: string;
};

export type Group = {
  id: number;
  label: string;
};

export type Match = {
  id: number;
  phase: MatchPhase;
  groupId: number | null;
  roundLabel: string;
  bracketSlot: number | null;
  teamAId: number | null;
  teamBId: number | null;
  courtId: number | null;
  refId: number | null;
  scheduledTime: string | null;
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  winnerId: number | null;
  feedsIntoMatchId: number | null;
  feedsIntoSlot: "A" | "B" | null;
  bonusGame: boolean;
  lockToken: string | null;
};

export type ThreePointAttempt = {
  id: number;
  entrantName: string;
  score: number;
  enteredAt: string;
};

export type TeamRef = {
  id: number;
  slug: string;
  name: string;
  groupId: number | null;
};

export type MatchWithNames = Match & {
  teamA: TeamRef | null;
  teamB: TeamRef | null;
  court: Court | null;
  ref: Ref | null;
  group: Group | null;
};

export type StandingsRow = {
  teamId: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
};

export type StandingsRowWithTeam = StandingsRow & {
  teamName: string;
  teamSlug: string | null;
};

export type StandingsResponse = {
  format: GroupFormat | null;
  groups: { groupLabel: string; standings: StandingsRowWithTeam[] }[];
  global: StandingsRowWithTeam[] | null;
};

export type LiveSnapshot = {
  tournament: { id: number; name: string; status: TournamentStatus; groupFormat: GroupFormat | null } | null;
  liveMatches: MatchWithNames[];
  standings: StandingsResponse;
  threePoint: ThreePointAttempt[];
  bracket: MatchWithNames[] | null;
};
