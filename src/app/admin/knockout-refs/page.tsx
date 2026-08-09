"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ref } from "@/lib/types";

type Slot = {
  slotKey: string;
  roundLabel: string;
  expectedTime: string | null;
  expectedCourtLabel: string | null;
  refId: number | null;
  refId2: number | null;
};

const ROUND_ORDER = ["Round of 16", "Quarterfinal", "Semifinal", "Final"];

function slotDisplayName(slotKey: string, roundLabel: string): string {
  const index = Number(slotKey.split("-")[1]);
  if (roundLabel === "Final") return "Final";
  return `${roundLabel} — Match ${index + 1}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminKnockoutRefsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([
      fetch("/api/admin/knockout-ref-plan").then((r) => r.json()),
      fetch("/api/refs").then((r) => r.json()),
    ]).then(([s, r]) => {
      setSlots(s);
      setRefs(r);
      setLoading(false);
    });
  }

  useEffect(reload, []);

  async function assign(slotKey: string, field: "refId" | "refId2", value: string) {
    const refId = value ? Number(value) : null;
    setSlots((prev) => prev.map((s) => (s.slotKey === slotKey ? { ...s, [field]: refId } : s)));
    await fetch("/api/admin/knockout-ref-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey, [field]: refId }),
    });
  }

  const grouped = useMemo(() => {
    return ROUND_ORDER.map((round) => ({
      round,
      slots: slots
        .filter((s) => s.roundLabel === round)
        .sort((a, b) => Number(a.slotKey.split("-")[1]) - Number(b.slotKey.split("-")[1])),
    })).filter((g) => g.slots.length > 0);
  }, [slots]);

  if (loading) return <p className="text-neutral-400">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold">Knockout Ref Assignments</h2>
      <p className="text-sm text-neutral-400">
        Assign a ref to each knockout bracket slot ahead of time — before it&apos;s known which teams
        will actually land there. Once the bracket is generated (automatically after the last group
        match, or manually on the{" "}
        <a href="/admin/seeding" className="text-blue-400 hover:text-blue-300">
          Knockout Seeding
        </a>{" "}
        page), each new match is created with the ref you picked here already assigned. You can still
        change it afterward on the{" "}
        <a href="/admin/schedule" className="text-blue-400 hover:text-blue-300">
          Schedule
        </a>{" "}
        page.
      </p>

      {grouped.map(({ round, slots: roundSlots }) => (
        <div key={round}>
          <h3 className="mb-2 font-semibold text-neutral-300">{round}</h3>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Slot</th>
                  <th className="px-3 py-2">Expected court</th>
                  <th className="px-3 py-2">Expected time</th>
                  <th className="px-3 py-2">Ref 1</th>
                  <th className="px-3 py-2">Ref 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {roundSlots.map((s) => (
                  <tr key={s.slotKey}>
                    <td className="px-3 py-2">{slotDisplayName(s.slotKey, s.roundLabel)}</td>
                    <td className="px-3 py-2">{s.expectedCourtLabel ?? "—"}</td>
                    <td className="px-3 py-2">{formatTime(s.expectedTime)}</td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                        value={s.refId ?? ""}
                        onChange={(e) => assign(s.slotKey, "refId", e.target.value)}
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
                        value={s.refId2 ?? ""}
                        onChange={(e) => assign(s.slotKey, "refId2", e.target.value)}
                      >
                        <option value="">—</option>
                        {refs.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
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
