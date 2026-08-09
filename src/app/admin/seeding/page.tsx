"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BracketTree from "@/components/BracketTree";
import { usePolling } from "@/components/usePolling";
import type { MatchWithNames, StandingsResponse } from "@/lib/types";

type Tournament = { id: number; status: string; groupFormat: string | null };

export default function AdminSeedingPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<StandingsResponse | null>(null);
  const [bracket, setBracket] = useState<MatchWithNames[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live-polled (not the one-shot `reload()` below) so the "Generate
  // Knockout Bracket" button actually pops up on its own the moment the
  // last group-stage match goes final, for whoever's already sitting on
  // this page watching it happen — no more silent background generation.
  const { data: pendingGroupMatches } = usePolling<MatchWithNames[]>(
    "/api/matches?phase=group&status=scheduled",
  );

  function reload() {
    fetch("/api/admin/tournament").then((r) => r.json()).then(setTournament);
    fetch("/api/standings").then((r) => r.json()).then(setStandings);
    fetch("/api/matches?phase=knockout").then((r) => r.json()).then(setBracket);
  }

  useEffect(reload, []);

  async function seed(force = false) {
    if (force && !confirm("Generate the bracket now using current standings? Any group-stage match still not final will be skipped and won't count.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seed-knockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Seeding failed");
        return;
      }
      reload();
    } finally {
      setBusy(false);
    }
  }

  const alreadySeeded = bracket.length > 0;
  const groupStageStarted = tournament?.groupFormat != null;
  const groupStageReady = groupStageStarted && pendingGroupMatches != null && pendingGroupMatches.length === 0;
  const r16Matches = useMemo(() => bracket.filter((m) => m.roundLabel === "Round of 16"), [bracket]);

  // Derived from the loaded bracket + standings rather than the seed()
  // click's response, so it's accurate however the bracket got generated.
  const wildcardTeamNames = useMemo(() => {
    if (!alreadySeeded || standings?.format !== "groups_of_4") return [];
    const autoQualifiedIds = new Set(
      standings.groups.flatMap((g) => g.standings.filter((s) => s.rank <= 2).map((s) => s.teamId)),
    );
    return r16Matches
      .flatMap((m) => [m.teamA, m.teamB])
      .filter((t): t is NonNullable<typeof t> => !!t && !autoQualifiedIds.has(t.id))
      .map((t) => t.name);
  }, [alreadySeeded, standings, r16Matches]);

  const collisionMatchups = useMemo(
    () =>
      r16Matches
        .filter((m) => m.teamA && m.teamB && m.teamA.groupId != null && m.teamA.groupId === m.teamB.groupId)
        .map((m) => `${m.teamA!.name} vs ${m.teamB!.name}`),
    [r16Matches],
  );

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-bold">Knockout Seeding</h2>
      <p className="text-neutral-400">
        Tournament status: <strong>{tournament?.status ?? "…"}</strong> · Format:{" "}
        <strong>{tournament?.groupFormat ?? "not set"}</strong>
      </p>

      {!alreadySeeded && !groupStageStarted && (
        <p className="text-sm text-neutral-500">
          Generate groups or a pairing pool on the Format page first.
        </p>
      )}

      {!alreadySeeded && groupStageStarted && !groupStageReady && (
        <>
          <p className="text-sm text-neutral-500">
            Waiting for the group stage to finish
            {pendingGroupMatches != null && ` — ${pendingGroupMatches.length} match(es) not final yet`}.
            The button to generate the bracket will appear here on its own as soon as the last one is
            submitted — or generate it now anyway using current standings.
          </p>
          <button
            onClick={() => seed(true)}
            disabled={busy}
            className="rounded border border-amber-700 bg-amber-950 px-4 py-2 text-sm font-medium text-amber-200 disabled:opacity-40"
          >
            {busy ? "Seeding…" : "Generate Bracket Now (skip remaining group games)"}
          </button>
        </>
      )}

      {!alreadySeeded && groupStageReady && (
        <>
          <p className="text-sm text-green-400">Group stage complete — ready to seed the bracket.</p>
          <button
            onClick={() => seed(false)}
            disabled={busy}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Seeding…" : "Generate Knockout Bracket (Top 16)"}
          </button>
        </>
      )}

      {error && <p className="text-red-400">{error}</p>}

      {alreadySeeded && (
        <div>
          <p className="mb-1 text-sm text-neutral-400">
            To adjust an individual matchup, use{" "}
            <Link href="/admin/matches" className="text-blue-400 hover:text-blue-300">
              Match Overrides
            </Link>
            . To reseed from scratch, use Reset Tournament Data on the Phase &amp; Reset page.
          </p>
          {wildcardTeamNames.length > 0 && (
            <p className="mb-1 text-sm text-neutral-400">
              Wildcards (best non-top-2 records, filling the slots below 2-per-group): {wildcardTeamNames.join(", ")}.
            </p>
          )}
          {collisionMatchups.length > 0 && (
            <p className="mb-3 text-sm text-amber-400">
              Same-group Round of 16 matchup{collisionMatchups.length > 1 ? "s" : ""} — adjust manually on
              Match Overrides if needed: {collisionMatchups.join(", ")}.
            </p>
          )}
          <BracketTree matches={bracket} />
        </div>
      )}

      {!alreadySeeded && standings && (
        <div>
          <h3 className="mb-2 font-semibold text-neutral-300">Current standings preview</h3>
          {standings.groups.map((g) => (
            <div key={g.groupLabel} className="mb-2 text-sm text-neutral-400">
              Group {g.groupLabel}: {g.standings.map((s) => `${s.rank}. ${s.teamName}`).join(" · ")}
            </div>
          ))}
          {standings.global && (
            <div className="text-sm text-neutral-400">
              {standings.global.map((s) => `${s.rank}. ${s.teamName}`).join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
