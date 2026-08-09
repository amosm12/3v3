"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePolling } from "@/components/usePolling";
import type { MatchWithNames } from "@/lib/types";

function lockStorageKey(matchId: string) {
  return `match_lock_${matchId}`;
}

export default function ScorekeepingPage() {
  const { refSlug, matchId } = useParams<{ refSlug: string; matchId: string }>();
  const { data: polledMatch, loading } = usePolling<MatchWithNames>(`/api/matches/${matchId}`, 2500);

  const [myToken, setMyToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(lockStorageKey(matchId)) : null,
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Score taps render instantly against this local copy instead of waiting
  // on a round trip + the next poll tick. While a score request we fired is
  // still in flight, incoming poll data is ignored (it may be stale relative
  // to our own pending write) — `pendingScoreRequests` tracks that count, and
  // each request's own response reconciles `match` directly when it lands.
  const [match, setMatch] = useState<MatchWithNames | null>(null);
  const pendingScoreRequests = useRef(0);

  useEffect(() => {
    if (polledMatch && pendingScoreRequests.current === 0) {
      setMatch(polledMatch);
    }
  }, [polledMatch]);

  async function startMatch() {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/start`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setBanner(body.message ?? "Could not start match.");
        return;
      }
      localStorage.setItem(lockStorageKey(matchId), body.token);
      setMyToken(body.token);
    } finally {
      setBusy(false);
    }
  }

  function score(team: "A" | "B", delta: 1 | 2 | -1) {
    if (!myToken || !match || match.status !== "in_progress" || match.lockToken !== myToken) return;

    // Apply instantly, send in the background. The score endpoint applies
    // deltas atomically server-side (GREATEST(col + delta, 0) in one
    // conditional UPDATE), so concurrent/rapid taps stay correct without
    // needing to serialize them client-side — no reason to block the button
    // on the network round trip.
    const key = team === "A" ? "scoreA" : "scoreB";
    setBanner(null);
    setMatch((cur) => (cur ? { ...cur, [key]: Math.max(cur[key] + delta, 0) } : cur));
    pendingScoreRequests.current += 1;

    fetch(`/api/matches/${matchId}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: myToken, team, delta }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setBanner(body.message ?? "Could not update score.");
          return;
        }
        // The score route returns bare match columns (no team/court/ref
        // relations, to keep the hot path fast) — merge over the relations
        // we already have rather than replacing the whole object.
        setMatch((cur) => (cur ? { ...cur, ...body } : body));
      })
      .catch(() => setBanner("Network error — will resync shortly."))
      .finally(() => {
        pendingScoreRequests.current -= 1;
      });
  }

  async function finalizeManually() {
    if (!myToken || busy) return;
    if (!confirm("Finalize this match with the current score?")) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: myToken }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBanner(body.message ?? "Could not finalize match.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !match) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
        <p className="text-neutral-400">Loading…</p>
      </div>
    );
  }

  const iHoldLock = match.status === "in_progress" && !!myToken && match.lockToken === myToken;
  const isReadOnly = !iHoldLock;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <Link href={`/ref/${refSlug}`} className="text-sm text-blue-400 hover:text-blue-300">
        &larr; Back to your matches
      </Link>

      <p className="mt-2 text-sm text-neutral-400">
        {match.group?.label ? `Group ${match.group.label} · ` : ""}
        {match.roundLabel}
      </p>

      {banner && (
        <div className="mt-3 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-amber-200">
          {banner}
        </div>
      )}

      {match.status === "scheduled" && (
        <div className="mt-6 space-y-4 text-center">
          <div className="text-2xl font-bold">
            {match.teamA?.name ?? "TBD"} vs {match.teamB?.name ?? "TBD"}
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full rounded-lg bg-green-700 py-4 text-xl font-bold disabled:opacity-40"
          >
            Start Match
          </button>
        </div>
      )}

      {match.status !== "scheduled" && (
        <>
          {isReadOnly && (
            <p className="mt-3 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-300">
              {match.status === "final"
                ? "This match is final."
                : "Read-only — this match is being scored on another device. Ask admin to unlock if that's wrong."}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <TeamScorePanel
              name={match.teamA?.name ?? "Team A"}
              score={match.scoreA}
              isWinner={match.winnerId != null && match.winnerId === match.teamAId}
              readOnly={isReadOnly}
              busy={busy}
              onScore={(delta) => score("A", delta)}
            />
            <TeamScorePanel
              name={match.teamB?.name ?? "Team B"}
              score={match.scoreB}
              isWinner={match.winnerId != null && match.winnerId === match.teamBId}
              readOnly={isReadOnly}
              busy={busy}
              onScore={(delta) => score("B", delta)}
            />
          </div>

          {!isReadOnly && (
            <button
              onClick={finalizeManually}
              disabled={busy}
              className="mt-6 w-full rounded-lg bg-blue-800 py-3 text-lg font-semibold disabled:opacity-40"
            >
              Final
            </button>
          )}

          <p className="mt-4 text-center text-sm text-neutral-500">
            Tap Final when the game ends — scores don&apos;t finalize automatically.
          </p>
        </>
      )}
    </div>
  );
}

function TeamScorePanel({
  name,
  score,
  isWinner,
  readOnly,
  busy,
  onScore,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  readOnly: boolean;
  busy: boolean;
  onScore: (delta: 1 | 2 | -1) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        isWinner ? "border-green-500 bg-green-950" : "border-neutral-700 bg-neutral-900"
      }`}
    >
      <div className="truncate text-lg font-semibold">{name}</div>
      <div className="my-3 text-6xl font-black tabular-nums">{score}</div>
      {!readOnly && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onScore(1)}
              disabled={busy}
              className="rounded-lg bg-blue-700 py-4 text-2xl font-bold disabled:opacity-40"
            >
              +1
            </button>
            <button
              onClick={() => onScore(2)}
              disabled={busy}
              className="rounded-lg bg-blue-700 py-4 text-2xl font-bold disabled:opacity-40"
            >
              +2
            </button>
          </div>
          <button
            onClick={() => onScore(-1)}
            disabled={busy || score === 0}
            className="w-full rounded bg-neutral-700 py-2 text-sm font-medium disabled:opacity-40"
          >
            Undo (-1)
          </button>
        </div>
      )}
    </div>
  );
}
