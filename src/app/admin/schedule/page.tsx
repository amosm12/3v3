"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchWithNames, Court, Ref } from "@/lib/types";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function AdminSchedulePage() {
  const [matches, setMatches] = useState<MatchWithNames[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/courts").then((r) => r.json()),
      fetch("/api/refs").then((r) => r.json()),
    ]).then(([m, c, r]) => {
      setMatches(m);
      setCourts(c);
      setRefs(r);
      setLoading(false);
    });
  }

  useEffect(reload, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MatchWithNames[]>();
    for (const m of matches) {
      const key = m.group?.label ? `Group ${m.group.label}` : m.roundLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  async function updateMatch(id: number, patch: Record<string, unknown>) {
    setMatches((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    reload();
  }

  if (loading) return <p className="text-neutral-400">Loading…</p>;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">Schedule</h2>
      {matches.length === 0 && (
        <p className="text-neutral-400">
          No matches yet — generate groups or pairing on the Format page first.
        </p>
      )}
      {grouped.map(([label, ms]) => (
        <div key={label}>
          <h3 className="mb-2 font-semibold text-neutral-300">{label}</h3>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Round</th>
                  <th className="px-3 py-2">Matchup</th>
                  <th className="px-3 py-2">Court</th>
                  <th className="px-3 py-2">Ref 1</th>
                  <th className="px-3 py-2">Ref 2</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {ms.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">{m.roundLabel}</td>
                    <td className="px-3 py-2">
                      {m.teamA?.name ?? "TBD"} vs {m.teamB?.name ?? "TBD"}
                      {m.bonusGame && (
                        <span className="ml-2 rounded bg-amber-900 px-1.5 py-0.5 text-xs text-amber-300">
                          bonus game
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                        value={m.courtId ?? ""}
                        onChange={(e) =>
                          updateMatch(m.id, { courtId: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">—</option>
                        {courts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                        value={m.refId ?? ""}
                        onChange={(e) =>
                          updateMatch(m.id, { refId: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">—</option>
                        {refs.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                        value={m.refId2 ?? ""}
                        onChange={(e) =>
                          updateMatch(m.id, { refId2: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">—</option>
                        {refs.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="datetime-local"
                        className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                        value={toLocalInputValue(m.scheduledTime)}
                        onChange={(e) =>
                          updateMatch(m.id, {
                            scheduledTime: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 capitalize">{m.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
