"use client";

import { useMemo, useState } from "react";
import { usePolling } from "@/components/usePolling";
import { TeamRosterEditor } from "@/components/TeamRosterEditor";
import type { Team } from "@/lib/types";

export default function CheckinPage() {
  const { data: teams, loading } = usePolling<Team[]>("/api/teams");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Team>>({});

  const displayTeams = useMemo(
    () => (teams ?? []).map((t) => overrides[t.id] ?? t),
    [teams, overrides],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayTeams;
    return displayTeams.filter((t) => t.name.toLowerCase().includes(q));
  }, [displayTeams, search]);

  const checkedIn = displayTeams.filter((t) => t.checkedIn).length;
  const total = displayTeams.length;

  function handleTeamUpdated(updated: Team) {
    setOverrides((o) => ({ ...o, [updated.id]: updated }));
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <h1 className="text-2xl font-bold">Check-in</h1>
      <p className="mt-1 text-lg text-neutral-300">
        {loading ? "Loading…" : `${checkedIn} / ${total} teams checked in`}
      </p>

      <input
        autoFocus
        className="mt-4 w-full rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-3 text-lg"
        placeholder="Search team name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ul className="mt-3 space-y-2">
        {filtered.map((team) => {
          const isExpanded = expandedId === team.id;
          return (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : team.id)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-left hover:bg-neutral-800 active:bg-neutral-700"
              >
                <span className="text-lg">{team.name}</span>
                <span className="text-sm text-neutral-400">
                  {team.checkedIn ? "Checked in" : "Not checked in"} ·{" "}
                  {team.paid ? "Paid" : "Unpaid"}
                </span>
              </button>
              {isExpanded && (
                <div className="mt-2">
                  <TeamRosterEditor
                    team={team}
                    showCheckin
                    source="checkin"
                    onTeamUpdated={handleTeamUpdated}
                  />
                </div>
              )}
            </li>
          );
        })}
        {teams && filtered.length === 0 && (
          <li className="rounded-lg border border-neutral-800 px-4 py-3 text-neutral-400">
            No results.
          </li>
        )}
      </ul>
    </div>
  );
}
