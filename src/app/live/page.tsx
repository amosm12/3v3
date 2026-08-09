"use client";

import { usePolling } from "@/components/usePolling";
import BracketTree from "@/components/BracketTree";
import AutoScroll from "@/components/AutoScroll";
import { buildSeedList } from "@/lib/algorithms/seeding";
import type { LiveSnapshot } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const EMPTY_GROUP_MAP = new Map<number, number | null>();

export default function LivePage() {
  const { data, error, loading } = usePolling<LiveSnapshot>("/api/live/snapshot");

  const inKnockout = data?.tournament?.status === "knockout" || data?.tournament?.status === "complete";
  const bracket = data?.bracket && data.bracket.length > 0 ? data.bracket : null;
  const liveTeamIds = new Set(
    (data?.liveMatches ?? []).flatMap((m) => [m.teamAId, m.teamBId]).filter((id): id is number => id != null),
  );
  // Same top-16 computation used to actually build the bracket (group
  // winners/runners-up + best-record wildcards, or the flat global top 16),
  // reused here just to mark who's currently on pace to advance.
  const advancingTeamIds = data
    ? new Set(buildSeedList(data.standings, EMPTY_GROUP_MAP).map((s) => s.teamId))
    : new Set<number>();

  return (
    <div
      className="flex h-screen flex-col overflow-hidden px-4 py-4 text-white sm:px-8 sm:py-6"
      style={{ background: "radial-gradient(ellipse at top, #17120a 0%, #000 60%)" }}
    >
      {error && (
        <div className="mb-2 shrink-0 text-center text-sm text-amber-400">
          Connection hiccup — showing last update
        </div>
      )}

      {loading && !data && <p className="text-2xl text-neutral-400">Loading…</p>}

      {data && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <LiveMatchesSection matches={data.liveMatches} />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            {inKnockout && bracket ? (
              <BracketSection matches={bracket} />
            ) : (
              <StandingsSection
                standings={data.standings}
                liveTeamIds={liveTeamIds}
                advancingTeamIds={advancingTeamIds}
              />
            )}
            <ThreePointSection attempts={data.threePoint} />
          </div>
        </div>
      )}
    </div>
  );
}

// Matches the "● LIVE" badge used on the Live Now cards, reused anywhere
// else we need to flag something as currently in progress.
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-base font-bold text-red-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      LIVE
    </span>
  );
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h2 className="mb-2 flex shrink-0 items-center gap-2 text-xl font-bold uppercase tracking-wide text-neutral-200">
      <span className={`h-5 w-1.5 rounded-full ${accent}`} />
      {children}
    </h2>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-linear-to-b from-neutral-900/60 to-black/60 p-4 shadow-xl shadow-black/50 ${className}`}
    >
      {children}
    </div>
  );
}

function LiveMatchesSection({ matches }: { matches: LiveSnapshot["liveMatches"] }) {
  return (
    <Panel className="shrink-0">
      <SectionTitle accent="bg-red-500">Live Now</SectionTitle>
      {matches.length === 0 && <p className="text-xl text-neutral-500">No games in progress.</p>}
      {matches.length > 0 && (
        <AutoScroll className="max-h-[24vh]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {matches.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border-2 border-red-600 bg-linear-to-br from-neutral-900 to-neutral-950 p-4 shadow-lg shadow-red-950/60"
              >
                <div className="flex items-center justify-between text-base text-neutral-400">
                  <span>{m.court?.label ?? "Court TBD"}</span>
                  <LiveBadge />
                </div>
                <div className="mt-1 flex items-center justify-between text-2xl font-bold">
                  <span className="truncate">{m.teamA?.name ?? "TBD"}</span>
                  <span className="tabular-nums">{m.scoreA}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-2xl font-bold">
                  <span className="truncate">{m.teamB?.name ?? "TBD"}</span>
                  <span className="tabular-nums">{m.scoreB}</span>
                </div>
              </div>
            ))}
          </div>
        </AutoScroll>
      )}
    </Panel>
  );
}

function StandingsSection({
  standings,
  liveTeamIds,
  advancingTeamIds,
}: {
  standings: LiveSnapshot["standings"];
  liveTeamIds: Set<number>;
  advancingTeamIds: Set<number>;
}) {
  if (!standings.format) {
    return (
      <Panel className="flex h-full min-h-0 min-w-0 flex-col">
        <SectionTitle accent="bg-amber-500">Standings</SectionTitle>
        <p className="text-xl text-neutral-500">Not generated yet.</p>
      </Panel>
    );
  }
  return (
    <Panel className="flex h-full min-h-0 min-w-0 flex-col">
      <SectionTitle accent="bg-amber-500">Standings</SectionTitle>
      <AutoScroll className="min-h-0 flex-1 space-y-6 pr-1">
        {standings.global && (
          <StandingsTable rows={standings.global} liveTeamIds={liveTeamIds} advancingTeamIds={advancingTeamIds} />
        )}
        {standings.groups.map((g) => (
          <div key={g.groupLabel}>
            <h3 className="mb-1 text-lg font-semibold text-neutral-300">Group {g.groupLabel}</h3>
            <StandingsTable rows={g.standings} liveTeamIds={liveTeamIds} advancingTeamIds={advancingTeamIds} />
          </div>
        ))}
      </AutoScroll>
    </Panel>
  );
}

function StandingsTable({
  rows,
  liveTeamIds,
  advancingTeamIds,
}: {
  rows: LiveSnapshot["standings"]["global"];
  liveTeamIds: Set<number>;
  advancingTeamIds: Set<number>;
}) {
  if (!rows) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full min-w-[520px] text-lg">
        <thead className="bg-neutral-900 text-left text-neutral-400">
          <tr className="border-b-2 border-amber-500/40">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">W-L</th>
            <th className="px-3 py-2 text-right">Diff</th>
            <th className="px-3 py-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => {
            const advancing = advancingTeamIds.has(r.teamId);
            return (
              <tr key={r.teamId} className={r.rank % 2 === 0 ? "bg-white/1.5" : ""}>
                <td className="px-3 py-2 font-bold">
                  {advancing ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-sm text-black">
                      {r.rank}
                    </span>
                  ) : (
                    r.rank
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    {r.teamName}
                    {liveTeamIds.has(r.teamId) && <LiveBadge />}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.wins}-{r.losses}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pointsFor}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ThreePointSection({ attempts }: { attempts: LiveSnapshot["threePoint"] }) {
  return (
    <Panel className="flex h-full min-h-0 min-w-0 flex-col">
      <SectionTitle accent="bg-violet-500">3-Point Contest</SectionTitle>
      {attempts.length === 0 ? (
        <p className="text-xl text-neutral-500">No entries yet.</p>
      ) : (
        <AutoScroll className="min-h-0 flex-1">
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[280px] text-lg">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr className="border-b-2 border-violet-500/40">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {attempts.map((a, i) => (
                  <tr key={a.id} className={i < 3 ? "bg-violet-500/6" : i % 2 === 0 ? "bg-white/1.5" : ""}>
                    <td className="px-3 py-2 font-bold">{i < 3 ? MEDALS[i] : i + 1}</td>
                    <td className="px-3 py-2">{a.entrantName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AutoScroll>
      )}
    </Panel>
  );
}

function BracketSection({ matches }: { matches: LiveSnapshot["bracket"] }) {
  if (!matches) return null;
  return (
    <Panel className="flex h-full min-h-0 min-w-0 flex-col">
      <SectionTitle accent="bg-amber-500">Bracket</SectionTitle>
      <div className="min-h-0 flex-1">
        <BracketTree matches={matches} />
      </div>
    </Panel>
  );
}
