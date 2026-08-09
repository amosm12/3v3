"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Team } from "@/lib/types";
import { TeamRosterEditor } from "@/components/TeamRosterEditor";
import { REQUIRED_PLAYERS_PER_TEAM } from "@/lib/constants";

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function reload() {
    return fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [teams, search],
  );

  return (
    <div className="space-y-6">
      <AddTeamForm onCreated={reload} />
      <BulkImportTeams onImported={reload} />

      <div>
        <input
          className="w-full max-w-sm rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-neutral-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((team) => (
            <TeamRosterEditor
              key={team.id}
              team={team}
              showCheckin={false}
              source="admin"
              onTeamUpdated={(updated) =>
                setTeams((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
              }
              onTeamDeleted={() => setTeams((ts) => ts.filter((t) => t.id !== team.id))}
            />
          ))}
          {filtered.length === 0 && <p className="text-neutral-400">No teams found.</p>}
        </div>
      )}
    </div>
  );
}

function AddTeamForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [playerNames, setPlayerNames] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          players: playerNames
            .map((n, i) => ({ name: n, isRequired: i < REQUIRED_PLAYERS_PER_TEAM }))
            .filter((p) => p.name.trim()),
        }),
      });
      if (res.ok) {
        setName("");
        setPlayerNames(["", "", "", ""]);
        onCreated();
      } else {
        const body = await res.json();
        setError(body.error ?? "Failed to create team");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4"
    >
      <h2 className="font-semibold">Add Team</h2>
      <input
        className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
        placeholder="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {playerNames.map((v, i) => (
          <input
            key={i}
            className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
            placeholder={i < REQUIRED_PLAYERS_PER_TEAM ? `Player ${i + 1}` : "Sub (optional)"}
            value={v}
            onChange={(e) =>
              setPlayerNames((names) => names.map((n, idx) => (idx === i ? e.target.value : n)))
            }
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        {submitting ? "Adding…" : "Add Team"}
      </button>
    </form>
  );
}

type ImportResult = {
  importedCount: number;
  imported: { name: string; slug: string }[];
  skipped: { teamName: string; reason: string }[];
};

function BulkImportTeams({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError("That file isn't valid JSON.");
        return;
      }
      const res = await fetch("/api/admin/import-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Import failed");
        return;
      }
      setResult(body);
      onImported();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <h2 className="font-semibold">Bulk Import Teams (JSON)</h2>
      <p className="text-sm text-neutral-400">
        Upload a JSON file shaped like{" "}
        <code className="rounded bg-neutral-800 px-1">
          {`{ "teams": [{ "team_name", "players": [{ "name", "phone" }] }] }`}
        </code>
        . The first 3 named players per team become required roster slots, a 4th is the free sub.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFile}
        disabled={busy}
        className="text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-blue-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
      />
      {busy && <p className="text-sm text-neutral-400">Importing…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className="text-sm">
          <p className="text-green-400">Imported {result.importedCount} team(s).</p>
          {result.skipped.length > 0 && (
            <div className="mt-1 text-amber-400">
              <p>Skipped {result.skipped.length}:</p>
              <ul className="ml-4 list-disc">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.teamName}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
