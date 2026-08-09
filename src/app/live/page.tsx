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
  // Same top-16 computation used to actually build the bracket (group
  // winners/runners-up + best-record wildcards, or the flat global top 16),
  // reused here just to mark who's currently on pace to advance.
  const advancingTeamIds = data
    ? new Set(buildSeedList(data.standings, EMPTY_GROUP_MAP).map((s) => s.teamId))
    : new Set<number>();

  return (
    <div
      className="flex min-h-screen flex-col overflow-y-auto px-4 py-4 text-neutral-900 sm:h-screen sm:overflow-hidden sm:px-8 sm:py-6"
      style={{ background: "radial-gradient(ellipse at top, #fffaf0 0%, #f4f4f5 60%)" }}
    >
      {error && (
        <div className="mb-2 shrink-0 text-center text-sm text-amber-700">
          Connection hiccup — showing last update
        </div>
      )}

      {loading && !data && <p className="text-2xl text-neutral-500">Loading…</p>}

      {data && (
        <div className="grid flex-1 grid-cols-1 gap-4 sm:min-h-0 sm:grid-cols-[2fr_1fr]">
          {inKnockout && bracket ? (
            <BracketSection matches={bracket} />
          ) : (
            <StandingsSection standings={data.standings} advancingTeamIds={advancingTeamIds} />
          )}
          <ThreePointSection attempts={data.threePoint} />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h2 className="mb-2 flex shrink-0 items-center gap-2 text-xl font-bold uppercase tracking-wide text-neutral-800">
      <span className={`h-5 w-1.5 rounded-full ${accent}`} />
      {children}
    </h2>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-linear-to-b from-white to-neutral-50 p-4 shadow-xl shadow-black/5 ${className}`}
    >
      {children}
    </div>
  );
}

function StandingsSection({
  standings,
  advancingTeamIds,
}: {
  standings: LiveSnapshot["standings"];
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
        {standings.global && <StandingsTable rows={standings.global} advancingTeamIds={advancingTeamIds} />}
        {standings.groups.map((g) => (
          <div key={g.groupLabel}>
            <h3 className="mb-1 text-lg font-semibold text-neutral-700">Group {g.groupLabel}</h3>
            <StandingsTable rows={g.standings} advancingTeamIds={advancingTeamIds} />
          </div>
        ))}
      </AutoScroll>
    </Panel>
  );
}

function StandingsTable({
  rows,
  advancingTeamIds,
}: {
  rows: LiveSnapshot["standings"]["global"];
  advancingTeamIds: Set<number>;
}) {
  if (!rows) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[520px] text-lg">
        <thead className="bg-neutral-100 text-left text-neutral-600">
          <tr className="border-b-2 border-amber-500/60">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">W-L</th>
            <th className="px-3 py-2 text-right">Diff</th>
            <th className="px-3 py-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((r) => {
            const advancing = advancingTeamIds.has(r.teamId);
            return (
              <tr key={r.teamId} className={r.rank % 2 === 0 ? "bg-black/2" : ""}>
                <td className="px-3 py-2 font-bold">
                  {advancing ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm text-white">
                      {r.rank}
                    </span>
                  ) : (
                    r.rank
                  )}
                </td>
                <td className="px-3 py-2">{r.teamName}</td>
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
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[280px] text-lg">
              <thead className="bg-neutral-100 text-left text-neutral-600">
                <tr className="border-b-2 border-violet-500/50">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {attempts.map((a, i) => (
                  <tr key={a.id} className={i < 3 ? "bg-violet-500/10" : i % 2 === 0 ? "bg-black/2" : ""}>
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
      <div className="min-h-105 flex-1 sm:min-h-0">
        <BracketTree matches={matches} light />
      </div>
    </Panel>
  );
}
