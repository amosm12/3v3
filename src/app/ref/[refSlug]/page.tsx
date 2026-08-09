"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/components/usePolling";
import type { MatchWithNames } from "@/lib/types";

type RefDetail = { id: number; slug: string; name: string; matches: MatchWithNames[] };

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  final: "Final",
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-neutral-700 text-neutral-200",
  final: "bg-green-800 text-green-100",
};

export default function RefDetailPage() {
  const { refSlug } = useParams<{ refSlug: string }>();
  const { data: ref, loading, error } = usePolling<RefDetail>(`/api/refs/${refSlug}`);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <Link href="/ref" className="text-sm text-blue-400 hover:text-blue-300">
        &larr; Back to refs
      </Link>

      {loading && <p className="mt-4 text-neutral-400">Loading…</p>}
      {error && !ref && <p className="mt-4 text-red-400">Couldn&apos;t load matches.</p>}
      {ref && (
        <>
          <h1 className="mt-2 text-2xl font-bold">{ref.name}</h1>
          <p className="text-neutral-400">Your matches today</p>

          <ul className="mt-4 space-y-2">
            {ref.matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/ref/${refSlug}/match/${m.id}`}
                  className="block rounded-lg border border-neutral-700 bg-neutral-900 p-4 hover:border-neutral-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">
                      {m.group?.label ? `Group ${m.group.label} · ` : ""}
                      {m.roundLabel}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {m.teamA?.name ?? "TBD"} vs {m.teamB?.name ?? "TBD"}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-blue-400">
                    {m.court ? m.court.label : "No court assigned"}
                  </div>
                  {(m.ref || m.ref2) && (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      Refs: {[m.ref?.name, m.ref2?.name].filter(Boolean).join(" & ")}
                    </div>
                  )}
                  {m.status !== "scheduled" && (
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {m.scoreA} – {m.scoreB}
                    </div>
                  )}
                </Link>
              </li>
            ))}
            {ref.matches.length === 0 && (
              <p className="text-neutral-400">No matches assigned yet.</p>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
