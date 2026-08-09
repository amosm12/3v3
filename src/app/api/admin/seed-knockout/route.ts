import { NextResponse } from "next/server";
import { attemptKnockoutSeeding } from "@/lib/knockoutSeeding";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = (body as { force?: boolean } | null)?.force === true;
  const result = await attemptKnockoutSeeding({ force });

  if (!result.seeded) {
    switch (result.reason) {
      case "NO_GROUP_FORMAT":
        return NextResponse.json(
          { error: "Generate groups or pairing before seeding the knockout bracket." },
          { status: 400 },
        );
      case "ALREADY_SEEDED":
        return NextResponse.json(
          { error: "Knockout bracket already exists. Reset tournament data before reseeding." },
          { status: 409 },
        );
      case "GROUP_STAGE_INCOMPLETE":
        return NextResponse.json(
          {
            error: `${result.pendingCount} group-stage match(es) are not final yet. Finish the group stage before seeding.`,
          },
          { status: 400 },
        );
      case "INSUFFICIENT_TEAMS":
        return NextResponse.json(
          { error: `Need exactly 16 advancing teams to seed a knockout bracket; found ${result.seedCount}.` },
          { status: 400 },
        );
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled seed attempt result: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    seeds: result.seeds.map((s) => ({ seed: s.seed, teamId: s.teamId })),
    unresolvedSeeds: result.unresolvedSeeds,
  });
}
