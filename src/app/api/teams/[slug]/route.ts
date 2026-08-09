import { NextResponse } from "next/server";
import { eq, notInArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";
import { isTeamCheckedIn, isTeamPaid } from "@/lib/teamStatus";
import { MAX_PLAYERS_PER_TEAM, REQUIRED_PLAYERS_PER_TEAM } from "@/lib/constants";

async function getTeamBySlug(slug: string) {
  return db.query.teams.findFirst({
    where: eq(teams.slug, slug),
    with: { players: true },
  });
}

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...team,
    checkedIn: isTeamCheckedIn(team.players),
    paid: isTeamPaid(team.players),
  });
}

type PatchBody = {
  name?: string;
  players?: { id?: number; name: string; isRequired: boolean; phone?: string | null }[];
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const body = (await request.json()) as PatchBody;

  const existing = await getTeamBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (body.players && body.players.length > MAX_PLAYERS_PER_TEAM) {
    return NextResponse.json(
      { error: `A team can have at most ${MAX_PLAYERS_PER_TEAM} players` },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    if (body.name?.trim()) {
      await tx.update(teams).set({ name: body.name.trim() }).where(eq(teams.id, existing.id));
    }

    if (body.players) {
      const keepIds = body.players.filter((p) => p.id != null).map((p) => p.id!);

      // Remove players dropped from the roster (e.g. a sub taken back off).
      if (keepIds.length > 0) {
        await tx
          .delete(players)
          .where(and(eq(players.teamId, existing.id), notInArray(players.id, keepIds)));
      } else {
        await tx.delete(players).where(eq(players.teamId, existing.id));
      }

      for (const [i, p] of body.players.entries()) {
        const isRequired = i < REQUIRED_PLAYERS_PER_TEAM;
        const phone = p.phone?.trim() || null;
        if (p.id != null) {
          await tx
            .update(players)
            .set({ name: p.name.trim(), isRequired, phone })
            .where(and(eq(players.id, p.id), eq(players.teamId, existing.id)));
        } else {
          await tx.insert(players).values({
            teamId: existing.id,
            name: p.name.trim(),
            isRequired,
            phone,
          });
        }
      }
    }
  });

  const updated = await getTeamBySlug(slug);
  return NextResponse.json({
    ...updated,
    checkedIn: isTeamCheckedIn(updated!.players),
    paid: isTeamPaid(updated!.players),
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const existing = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!existing) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(players).where(eq(players.teamId, existing.id));
    await tx.delete(teams).where(eq(teams.id, existing.id));
  });

  return NextResponse.json({ ok: true });
}
