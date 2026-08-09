"use client";

import { useEffect, useState } from "react";
import type { TournamentStatus } from "@/lib/types";

const PHASES: TournamentStatus[] = ["setup", "checkin", "group_stage", "knockout", "complete"];

export default function AdminSettingsPage() {
  const [tournament, setTournament] = useState<{ status: TournamentStatus; groupFormat: string | null } | null>(
    null,
  );
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function reload() {
    fetch("/api/admin/tournament").then((r) => r.json()).then(setTournament);
  }

  useEffect(reload, []);

  async function setPhase(status: TournamentStatus) {
    await fetch("/api/admin/tournament", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function resetData() {
    if (
      !confirm(
        "Reset tournament data? This wipes all matches, scores, and groups. Teams, rosters, payment/check-in status, refs, and courts are kept.",
      )
    )
      return;
    setResetting(true);
    setMessage(null);
    try {
      await fetch("/api/admin/reset", { method: "POST" });
      setMessage("Tournament data reset.");
      reload();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-xl font-bold">Tournament Phase</h2>
        <p className="mt-1 text-neutral-400">Current: {tournament?.status ?? "…"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                tournament?.status === p ? "bg-blue-700" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-red-400">Reset Tournament Data</h2>
        <p className="mt-1 text-neutral-400">
          Wipes matches, scores, and groups. Use this after the morning dry run, before real check-in
          starts. Teams, rosters, payment/check-in status, refs, and courts are kept.
        </p>
        <button
          onClick={resetData}
          disabled={resetting}
          className="mt-3 rounded bg-red-800 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {resetting ? "Resetting…" : "Reset Tournament Data"}
        </button>
        {message && <p className="mt-2 text-green-400">{message}</p>}
      </div>
    </div>
  );
}
