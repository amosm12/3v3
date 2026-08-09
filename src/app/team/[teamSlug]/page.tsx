"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/components/usePolling";
import type { MatchWithNames } from "@/lib/types";

type TeamSchedule = {
  team: { id: number; slug: string; name: string };
  groupMatches: MatchWithNames[];
  knockoutMatches: MatchWithNames[];
  bracketStatus: "not_in_knockout" | "alive" | "eliminated" | "champion";
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-neutral-700 text-neutral-200",
  final: "bg-green-800 text-green-100",
};

function opponentOf(m: MatchWithNames, teamId: number) {
  return m.teamAId === teamId ? m.teamB : m.teamA;
}

function MatchRow({ match, teamId }: { match: MatchWithNames; teamId: number }) {
  const opponent = opponentOf(match, teamId);
  const myScore = match.teamAId === teamId ? match.scoreA : match.scoreB;
  const oppScore = match.teamAId === teamId ? match.scoreB : match.scoreA;
  const won = match.status === "final" && match.winnerId === teamId;
  const lost = match.status === "final" && match.winnerId != null && match.winnerId !== teamId;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>
          {match.group?.label ? `Group ${match.group.label} · ` : ""}
          {match.roundLabel}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[match.status]}`}>
          {match.status.replace("_", " ")}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-lg font-semibold">vs {opponent?.name ?? "TBD"}</span>
        {match.status !== "scheduled" && (
          <span className={`text-lg font-bold tabular-nums ${won ? "text-green-400" : lost ? "text-red-400" : ""}`}>
            {myScore}–{oppScore}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-neutral-500">
        {match.court?.label ?? "Court TBD"}
        {match.scheduledTime ? ` · ${new Date(match.scheduledTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
      </div>
    </div>
  );
}

export default function TeamSchedulePage() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { data, loading } = usePolling<TeamSchedule>(`/api/teams/${teamSlug}/schedule`);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <Link href="/team" className="text-sm text-blue-400 hover:text-blue-300">
        &larr; Back to teams
      </Link>

      {loading && <p className="mt-4 text-neutral-400">Loading…</p>}

      {data && (
        <>
          <h1 className="mt-2 text-2xl font-bold">{data.team.name}</h1>

          {data.bracketStatus !== "not_in_knockout" && (
            <div className="mt-3">
              {data.bracketStatus === "champion" && (
                <span className="rounded bg-amber-700 px-3 py-1 text-sm font-bold text-amber-100">Champion</span>
              )}
              {data.bracketStatus === "eliminated" && (
                <span className="rounded bg-neutral-700 px-3 py-1 text-sm font-medium text-neutral-200">Eliminated</span>
              )}
              {data.bracketStatus === "alive" && (
                <span className="rounded bg-green-800 px-3 py-1 text-sm font-medium text-green-100">
                  Still alive in the bracket
                </span>
              )}
            </div>
          )}

          {data.knockoutMatches.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-lg font-semibold text-neutral-300">Knockout</h2>
              <div className="space-y-2">
                {data.knockoutMatches.map((m) => (
                  <MatchRow key={m.id} match={m} teamId={data.team.id} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <h2 className="mb-2 text-lg font-semibold text-neutral-300">Group Stage</h2>
            <div className="space-y-2">
              {data.groupMatches.map((m) => (
                <MatchRow key={m.id} match={m} teamId={data.team.id} />
              ))}
              {data.groupMatches.length === 0 && (
                <p className="text-neutral-400">No matches scheduled yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
