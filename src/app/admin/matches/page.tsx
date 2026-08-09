"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchWithNames, Team } from "@/lib/types";

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchWithNames[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filter, setFilter] = useState("");
  const [edits, setEdits] = useState<Record<number, { scoreA: string; scoreB: string }>>({});

  function reload() {
    fetch("/api/matches").then((r) => r.json()).then(setMatches);
    fetch("/api/teams").then((r) => r.json()).then(setTeams);
  }

  useEffect(reload, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) => m.teamA?.name.toLowerCase().includes(q) || m.teamB?.name.toLowerCase().includes(q),
    );
  }, [matches, filter]);

  function editFor(m: MatchWithNames) {
    return edits[m.id] ?? { scoreA: String(m.scoreA), scoreB: String(m.scoreB) };
  }

  async function saveScore(m: MatchWithNames) {
    const e = editFor(m);
    await fetch(`/api/matches/${m.id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreA: Number(e.scoreA), scoreB: Number(e.scoreB) }),
    });
    reload();
  }

  async function reassignTeam(m: MatchWithNames, slot: "teamAId" | "teamBId", teamId: string) {
    await fetch(`/api/matches/${m.id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [slot]: teamId ? Number(teamId) : null }),
    });
    reload();
  }

  async function unfinalize(m: MatchWithNames) {
    await fetch(`/api/matches/${m.id}/unfinalize`, { method: "POST" });
    reload();
  }

  async function unlock(m: MatchWithNames) {
    await fetch(`/api/matches/${m.id}/unlock`, { method: "POST" });
    reload();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Match Overrides</h2>
      <input
        className="w-full max-w-sm rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
        placeholder="Filter by team name…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="space-y-3">
        {filtered.map((m) => {
          const e = editFor(m);
          return (
            <div key={m.id} className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-400">
                <span>
                  #{m.id} · {m.phase} · {m.group?.label ? `Group ${m.group.label} · ` : ""}
                  {m.roundLabel}
                </span>
                <span>{m.status}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <TeamSelect teams={teams} value={m.teamAId} onChange={(v) => reassignTeam(m, "teamAId", v)} />
                <span>vs</span>
                <TeamSelect teams={teams} value={m.teamBId} onChange={(v) => reassignTeam(m, "teamBId", v)} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="w-16 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                  type="number"
                  value={e.scoreA}
                  onChange={(ev) => setEdits((s) => ({ ...s, [m.id]: { ...e, scoreA: ev.target.value } }))}
                />
                <span>-</span>
                <input
                  className="w-16 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                  type="number"
                  value={e.scoreB}
                  onChange={(ev) => setEdits((s) => ({ ...s, [m.id]: { ...e, scoreB: ev.target.value } }))}
                />
                <button
                  onClick={() => saveScore(m)}
                  className="rounded bg-blue-700 px-3 py-1 text-sm font-medium"
                >
                  Save score
                </button>
                {m.status === "final" && (
                  <button
                    onClick={() => unfinalize(m)}
                    className="rounded bg-amber-800 px-3 py-1 text-sm font-medium"
                  >
                    Un-finalize
                  </button>
                )}
                {m.status === "in_progress" && (
                  <button
                    onClick={() => unlock(m)}
                    className="rounded bg-neutral-700 px-3 py-1 text-sm font-medium"
                  >
                    Unlock
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-neutral-400">No matches found.</p>}
      </div>
    </div>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: number | null;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">TBD</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
