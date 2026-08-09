"use client";

import { useEffect, useState } from "react";
import type { Team } from "@/lib/types";

type Tournament = { id: number; name: string; status: string; groupFormat: string | null };

export default function AdminFormatPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/admin/tournament").then((r) => r.json()),
    ]).then(([t, tour]) => {
      setTeams(t);
      setTournament(tour);
    });
  }

  useEffect(reload, []);

  const totalCount = teams.length;
  const checkedInCount = teams.filter((t) => t.checkedIn).length;
  const divisibleBy4 = totalCount > 0 && totalCount % 4 === 0;

  async function generate(kind: "groups" | "pairing") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/generate-${kind === "groups" ? "groups" : "pairing"}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Generation failed");
        return;
      }
      const unscheduledNote =
        body.unscheduledCount > 0
          ? ` ${body.unscheduledCount} match(es) didn't fit in the 9 group-stage time slots (5 courts × 9 rounds) — assign them a court/time manually on the Schedule page.`
          : "";
      if (kind === "groups") {
        setMessage(`Generated ${body.groups} groups, ${body.matches} matches.${unscheduledNote}`);
      } else {
        const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`;
        const bonusNote =
          body.bonusTeamIds?.length > 0
            ? ` Odd headcount: ${teamName(body.floaterTeamId)} played only 3 games (the floater); ${body.bonusTeamIds
                .map(teamName)
                .join(", ")} each got a bonus 4th game.`
            : "";
        setMessage(`Generated ${body.matches} matches.${bonusNote}${unscheduledNote}`);
      }
      reload();
    } finally {
      setBusy(false);
    }
  }

  const alreadyGenerated = tournament?.groupFormat != null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Format Decision</h2>
        <p className="mt-1 text-neutral-300">
          {totalCount} team{totalCount === 1 ? "" : "s"} registered
          {divisibleBy4 ? " — divisible by 4." : " — not divisible by 4."} ({checkedInCount} checked in
          so far)
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Generation uses every registered team, not just checked-in ones — the schedule can be built
          ahead of check-in.
        </p>
        {tournament?.groupFormat && (
          <p className="mt-1 text-green-400">
            Format already set: <strong>{tournament.groupFormat}</strong>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <h3 className="font-semibold">Groups of 4</h3>
          <p className="mt-1 text-sm text-neutral-400">
            8 groups of 4, round robin, top 2 advance. Requires a headcount divisible by 4.
          </p>
          <button
            disabled={busy || alreadyGenerated || !divisibleBy4}
            onClick={() => generate("groups")}
            className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Generate Groups of 4
          </button>
        </div>

        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <h3 className="font-semibold">Random Pairing (fallback)</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Every team plays 3 random opponents, no repeats. Works for any headcount ≥ 4.
          </p>
          <button
            disabled={busy || alreadyGenerated || totalCount < 4}
            onClick={() => generate("pairing")}
            className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Generate Random Pairing
          </button>
        </div>
      </div>

      {message && <p className="text-green-400">{message}</p>}
      {error && <p className="text-red-400">{error}</p>}

      {alreadyGenerated && (
        <p className="text-sm text-neutral-400">
          To regenerate, use &quot;Reset Tournament Data&quot; on the Phase &amp; Reset page first.
        </p>
      )}
    </div>
  );
}
