"use client";

import { usePolling } from "@/components/usePolling";
import type { LiveSnapshot } from "@/lib/types";

export default function LivePage() {
  const { data, error, loading } = usePolling<LiveSnapshot>("/api/live/snapshot");

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-8">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Bethlehem SDA 3v3</h1>
        {error && <span className="text-lg text-amber-400">Connection hiccup — showing last update</span>}
      </header>

      {loading && !data && <p className="text-2xl text-neutral-400">Loading…</p>}

      {data && (
        <div className="space-y-12">
          <LiveMatchesSection matches={data.liveMatches} />
          {data.bracket && data.bracket.length > 0 && <BracketSection matches={data.bracket} />}
          <StandingsSection standings={data.standings} />
          <ThreePointSection attempts={data.threePoint} />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-3xl font-bold uppercase tracking-wide text-neutral-200">{children}</h2>;
}

function LiveMatchesSection({ matches }: { matches: LiveSnapshot["liveMatches"] }) {
  return (
    <section>
      <SectionTitle>Live Now</SectionTitle>
      {matches.length === 0 && <p className="text-2xl text-neutral-500">No games in progress.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {matches.map((m) => (
          <div key={m.id} className="rounded-xl border-2 border-red-600 bg-neutral-950 p-5">
            <div className="flex items-center justify-between text-lg text-neutral-400">
              <span>{m.court?.label ?? "Court TBD"}</span>
              <span className="text-red-500">● LIVE</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-3xl font-bold">
              <span className="truncate">{m.teamA?.name ?? "TBD"}</span>
              <span className="tabular-nums">{m.scoreA}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-3xl font-bold">
              <span className="truncate">{m.teamB?.name ?? "TBD"}</span>
              <span className="tabular-nums">{m.scoreB}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StandingsSection({ standings }: { standings: LiveSnapshot["standings"] }) {
  if (!standings.format) return null;
  return (
    <section>
      <SectionTitle>Standings</SectionTitle>
      {standings.global && <StandingsTable rows={standings.global} />}
      {standings.groups.length > 0 && (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {standings.groups.map((g) => (
            <div key={g.groupLabel}>
              <h3 className="mb-1 text-2xl font-semibold text-neutral-300">Group {g.groupLabel}</h3>
              <StandingsTable rows={g.standings} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StandingsTable({ rows }: { rows: LiveSnapshot["standings"]["global"] }) {
  if (!rows) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full min-w-[520px] text-xl">
        <thead className="bg-neutral-900 text-left text-neutral-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">W-L</th>
            <th className="px-3 py-2 text-right">Diff</th>
            <th className="px-3 py-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => (
            <tr key={r.teamId}>
              <td className="px-3 py-2 font-bold">{r.rank}</td>
              <td className="px-3 py-2">{r.teamName}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.wins}-{r.losses}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.pointsFor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThreePointSection({ attempts }: { attempts: LiveSnapshot["threePoint"] }) {
  return (
    <section>
      <SectionTitle>3-Point Contest</SectionTitle>
      {attempts.length === 0 ? (
        <p className="text-2xl text-neutral-500">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[420px] text-xl">
            <thead className="bg-neutral-900 text-left text-neutral-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {attempts.map((a, i) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-bold">{i + 1}</td>
                  <td className="px-3 py-2">{a.entrantName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BracketSection({ matches }: { matches: LiveSnapshot["bracket"] }) {
  if (!matches) return null;
  const rounds = [...new Set(matches.map((m) => m.roundLabel))];
  return (
    <section>
      <SectionTitle>Bracket</SectionTitle>
      <div className="flex gap-6 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round} className="min-w-[220px] shrink-0 space-y-3">
            <h3 className="text-xl font-semibold text-neutral-300">{round}</h3>
            {matches
              .filter((m) => m.roundLabel === round)
              .map((m) => (
                <div key={m.id} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3">
                  <div
                    className={`flex justify-between text-lg ${
                      m.winnerId != null && m.winnerId === m.teamAId ? "font-bold text-green-400" : ""
                    }`}
                  >
                    <span>{m.teamA?.name ?? "TBD"}</span>
                    <span>{m.status !== "scheduled" ? m.scoreA : ""}</span>
                  </div>
                  <div
                    className={`flex justify-between text-lg ${
                      m.winnerId != null && m.winnerId === m.teamBId ? "font-bold text-green-400" : ""
                    }`}
                  >
                    <span>{m.teamB?.name ?? "TBD"}</span>
                    <span>{m.status !== "scheduled" ? m.scoreB : ""}</span>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
