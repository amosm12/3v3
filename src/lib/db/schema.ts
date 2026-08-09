import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const tournament = pgTable("tournament", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("setup"), // setup|checkin|group_stage|knockout|complete
  groupFormat: text("group_format"), // groups_of_4|single_bracket_random_3|null
});

export const courts = pgTable("courts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    groupId: integer("group_id").references(() => groups.id),
  },
  (t) => [index("teams_group_idx").on(t.groupId)],
);

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    name: text("name").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    paid: boolean("paid").notNull().default(false),
    // True only when the current `paid: true` was set from /admin — locks the
    // checkbox from being unmarked on /checkin. A checkin-sourced mark stays
    // false, so checkin staff can still undo their own mistake.
    paidByAdmin: boolean("paid_by_admin").notNull().default(false),
    checkedIn: boolean("checked_in").notNull().default(false),
    phone: text("phone"), // optional contact number, admin-managed
  },
  (t) => [index("players_team_idx").on(t.teamId)],
);

export const refs = pgTable("refs", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  assignedCourtId: integer("assigned_court_id").references(() => courts.id),
});

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    phase: text("phase").notNull(), // group|knockout
    groupId: integer("group_id").references(() => groups.id),
    roundLabel: text("round_label").notNull(),
    bracketSlot: integer("bracket_slot"),
    teamAId: integer("team_a_id").references(() => teams.id),
    teamBId: integer("team_b_id").references(() => teams.id),
    courtId: integer("court_id").references(() => courts.id),
    refId: integer("ref_id").references(() => refs.id),
    scheduledTime: timestamp("scheduled_time"),
    status: text("status").notNull().default("scheduled"), // scheduled|in_progress|final
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winnerId: integer("winner_id").references(() => teams.id),
    feedsIntoMatchId: integer("feeds_into_match_id"),
    feedsIntoSlot: text("feeds_into_slot"), // 'A'|'B'
    lockToken: text("lock_token"),
    bonusGame: boolean("bonus_game").notNull().default(false), // odd-N pairing exception, see randomPairing.ts
  },
  (t) => [
    index("matches_status_idx").on(t.status),
    index("matches_ref_idx").on(t.refId),
    index("matches_group_idx").on(t.groupId),
    index("matches_phase_idx").on(t.phase),
  ],
);

export const threePointAttempts = pgTable("three_point_attempts", {
  id: serial("id").primaryKey(),
  entrantName: text("entrant_name").notNull(),
  score: integer("score").notNull(),
  enteredAt: timestamp("entered_at").notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  group: one(groups, { fields: [teams.groupId], references: [groups.id] }),
  players: many(players),
}));

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  teams: many(teams),
  matches: many(matches),
}));

export const refsRelations = relations(refs, ({ one, many }) => ({
  assignedCourt: one(courts, {
    fields: [refs.assignedCourtId],
    references: [courts.id],
  }),
  matches: many(matches),
}));

export const courtsRelations = relations(courts, ({ many }) => ({
  refs: many(refs),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  group: one(groups, { fields: [matches.groupId], references: [groups.id] }),
  court: one(courts, { fields: [matches.courtId], references: [courts.id] }),
  ref: one(refs, { fields: [matches.refId], references: [refs.id] }),
  teamA: one(teams, {
    fields: [matches.teamAId],
    references: [teams.id],
    relationName: "teamA",
  }),
  teamB: one(teams, {
    fields: [matches.teamBId],
    references: [teams.id],
    relationName: "teamB",
  }),
  winner: one(teams, {
    fields: [matches.winnerId],
    references: [teams.id],
    relationName: "winner",
  }),
}));
