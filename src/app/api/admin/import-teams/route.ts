import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";
import { generateSlug } from "@/lib/slug";
import { REQUIRED_PLAYERS_PER_TEAM, MAX_PLAYERS_PER_TEAM } from "@/lib/constants";

type ImportPlayer = { name?: string; phone?: string | null };
type ImportTeam = { team_name?: string; players?: ImportPlayer[] };
type ImportBody = { teams?: ImportTeam[] };

// Bulk-creates teams from an uploaded JSON file:
// { "teams": [{ "team_name": "...", "players": [{ "name": "...", "phone": "..." | null }] }] }
// The first 3 named players become required (roster) slots, a 4th is the
// free sub — same convention as the single-team "Add Team" form. Imports
// what it can and reports the rest, rather than failing the whole batch
// over one bad record — this is meant to run against real, possibly messy
// registration exports the night before the event.
export async function POST(request: Request) {
  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "That file isn't valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.teams)) {
    return NextResponse.json(
      { error: 'JSON must have a top-level "teams" array.' },
      { status: 400 },
    );
  }

  const imported: { name: string; slug: string }[] = [];
  const skipped: { teamName: string; reason: string }[] = [];

  for (const [index, entry] of body.teams.entries()) {
    const teamName = entry?.team_name?.trim();
    const label = teamName || `Team #${index + 1} (unnamed)`;

    if (!teamName) {
      skipped.push({ teamName: label, reason: "Missing team_name" });
      continue;
    }

    const rosterInput = (entry.players ?? []).filter((p) => p?.name?.trim());
    if (rosterInput.length === 0) {
      skipped.push({ teamName: label, reason: "No players with a name" });
      continue;
    }
    if (rosterInput.length > MAX_PLAYERS_PER_TEAM) {
      skipped.push({
        teamName: label,
        reason: `Too many players (${rosterInput.length}, max ${MAX_PLAYERS_PER_TEAM})`,
      });
      continue;
    }

    try {
      const team = await db.transaction(async (tx) => {
        const [row] = await tx.insert(teams).values({ name: teamName, slug: generateSlug() }).returning();
        const rosterRows = rosterInput.map((p, i) => ({
          teamId: row.id,
          name: p.name!.trim(),
          isRequired: i < REQUIRED_PLAYERS_PER_TEAM,
          phone: p.phone?.trim() || null,
        }));
        await tx.insert(players).values(rosterRows);
        return row;
      });
      imported.push({ name: team.name, slug: team.slug });
    } catch {
      skipped.push({ teamName: label, reason: "Unexpected error creating this team" });
    }
  }

  return NextResponse.json({ ok: true, importedCount: imported.length, imported, skipped });
}
