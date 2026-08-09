import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";
import { generateSlug } from "@/lib/slug";
import { isTeamCheckedIn, isTeamPaid } from "@/lib/teamStatus";
import { REQUIRED_PLAYERS_PER_TEAM, MAX_PLAYERS_PER_TEAM } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // The public /team search page just needs names to search against — not
  // every team's full roster, payment status, and phone numbers. That page
  // is plausibly the most-viewed one in the whole app (every player and
  // spectator browses it), so skip the roster join and the fields that
  // shouldn't be public anyway when only names are being asked for.
  if (searchParams.get("fields") === "names") {
    const rows = await db
      .select({ id: teams.id, slug: teams.slug, name: teams.name })
      .from(teams)
      .orderBy(teams.name);
    return NextResponse.json(rows);
  }

  const allTeams = await db.query.teams.findMany({
    with: { players: true },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const result = allTeams.map((team) => ({
    ...team,
    checkedIn: isTeamCheckedIn(team.players),
    paid: isTeamPaid(team.players),
  }));

  return NextResponse.json(result);
}

type CreateTeamBody = {
  name: string;
  players: { name: string; isRequired: boolean }[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateTeamBody;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }
  const rosterInput = (body.players ?? []).filter((p) => p.name?.trim());
  if (rosterInput.length === 0) {
    return NextResponse.json({ error: "At least one player is required" }, { status: 400 });
  }
  if (rosterInput.length > MAX_PLAYERS_PER_TEAM) {
    return NextResponse.json(
      { error: `A team can have at most ${MAX_PLAYERS_PER_TEAM} players` },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ name: body.name.trim(), slug: generateSlug() })
      .returning();

    const rosterRows = rosterInput.map((p, i) => ({
      teamId: team.id,
      name: p.name.trim(),
      isRequired: i < REQUIRED_PLAYERS_PER_TEAM,
    }));

    const insertedPlayers = await tx.insert(players).values(rosterRows).returning();

    return { ...team, players: insertedPlayers };
  });

  return NextResponse.json(
    { ...result, checkedIn: isTeamCheckedIn(result.players), paid: isTeamPaid(result.players) },
    { status: 201 },
  );
}
