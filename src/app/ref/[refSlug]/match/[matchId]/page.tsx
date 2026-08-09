"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { usePolling } from "@/components/usePolling";
import type { MatchWithNames } from "@/lib/types";

export default function ScorekeepingPage() {
  const { refSlug, matchId } = useParams<{ refSlug: string; matchId: string }>();
  const { data: match, loading } = usePolling<MatchWithNames>(`/api/matches/${matchId}`, 5000);

  const [scoreAInput, setScoreAInput] = useState<string | null>(null);
  const [scoreBInput, setScoreBInput] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function resetScore() {
    if (!match) return;
    if (
      !confirm(
        `Reset the final score for ${match.teamA?.name ?? "Team A"} vs ${match.teamB?.name ?? "Team B"}? You'll need to resubmit.`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/unfinalize`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner(body.message ?? "Could not reset score.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!match) return;
    const scoreA = Number(scoreAInput ?? match.scoreA);
    const scoreB = Number(scoreBInput ?? match.scoreB);

    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      setBanner("Enter a valid score for both teams.");
      return;
    }
    if (scoreA === scoreB) {
      setBanner("Scores can't be tied — double check and re-enter.");
      return;
    }
    const winnerName = scoreA > scoreB ? match.teamA?.name : match.teamB?.name;
    if (!confirm(`Submit final score — ${match.teamA?.name ?? "Team A"} ${scoreA} - ${scoreB} ${match.teamB?.name ?? "Team B"} (${winnerName ?? "winner"} wins)?`)) {
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreA, scoreB }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBanner(body.message ?? "Could not submit score.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !match) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
        <p className="text-neutral-400">Loading…</p>
      </div>
    );
  }

  const isFinal = match.status === "final";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <Link href={`/ref/${refSlug}`} className="text-sm text-blue-400 hover:text-blue-300">
        &larr; Back to your matches
      </Link>

      <p className="mt-2 text-sm text-neutral-400">
        {match.group?.label ? `Group ${match.group.label} · ` : ""}
        {match.roundLabel}
      </p>
      <p className="text-lg font-bold text-blue-400">
        {match.court ? match.court.label : "No court assigned"}
        {match.scheduledTime
          ? ` · ${new Date(match.scheduledTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : ""}
      </p>

      {banner && (
        <div className="mt-3 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-amber-200">
          {banner}
        </div>
      )}

      <div className="mt-4 text-center text-2xl font-bold">
        {match.teamA?.name ?? "TBD"} vs {match.teamB?.name ?? "TBD"}
      </div>

      {isFinal && (
        <>
          <p className="mt-3 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-neutral-300">
            This match is final.
          </p>
          <button
            onClick={resetScore}
            disabled={submitting}
            className="mt-3 w-full rounded-lg border border-amber-700 bg-amber-950 py-3 text-base font-semibold text-amber-200 disabled:opacity-40"
          >
            {submitting ? "Resetting…" : "Reset score"}
          </button>
        </>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <TeamScorePanel
          name={match.teamA?.name ?? "Team A"}
          checkedIn={match.teamA?.checkedIn}
          score={match.scoreA}
          isWinner={isFinal && match.winnerId === match.teamAId}
          readOnly={isFinal}
          value={scoreAInput ?? String(match.scoreA)}
          onChange={setScoreAInput}
        />
        <TeamScorePanel
          name={match.teamB?.name ?? "Team B"}
          checkedIn={match.teamB?.checkedIn}
          score={match.scoreB}
          isWinner={isFinal && match.winnerId === match.teamBId}
          readOnly={isFinal}
          value={scoreBInput ?? String(match.scoreB)}
          onChange={setScoreBInput}
        />
      </div>

      {!isFinal && (
        <>
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-blue-700 py-4 text-xl font-bold disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit Final Score"}
          </button>
          <p className="mt-4 text-center text-sm text-neutral-500">
            Enter the final score from the scoreboard once the game ends.
          </p>
        </>
      )}
    </div>
  );
}

function TeamScorePanel({
  name,
  checkedIn,
  score,
  isWinner,
  readOnly,
  value,
  onChange,
}: {
  name: string;
  checkedIn?: boolean;
  score: number;
  isWinner: boolean;
  readOnly: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        isWinner ? "border-green-500 bg-green-950" : "border-neutral-700 bg-neutral-900"
      }`}
    >
      <div className="truncate text-lg font-semibold">{name}</div>
      <div className={`text-xs font-medium ${checkedIn ? "text-green-400" : "text-red-400"}`}>
        {checkedIn ? "✓ Checked in" : "✗ Not checked in"}
      </div>
      {readOnly ? (
        <div className="my-3 text-6xl font-black tabular-nums">{score}</div>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="my-3 w-full rounded-lg border border-neutral-600 bg-neutral-800 py-2 text-center text-5xl font-black tabular-nums"
        />
      )}
    </div>
  );
}
