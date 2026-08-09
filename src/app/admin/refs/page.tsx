"use client";

import { useEffect, useState } from "react";
import type { Ref, Court } from "@/lib/types";

export default function AdminRefsPage() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [name, setName] = useState("");
  const [courtId, setCourtId] = useState<string>("");

  function reload() {
    fetch("/api/refs").then((r) => r.json()).then(setRefs);
    fetch("/api/courts").then((r) => r.json()).then(setCourts);
  }

  useEffect(reload, []);

  async function addRef(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        assignedCourtId: courtId ? Number(courtId) : null,
      }),
    });
    setName("");
    setCourtId("");
    reload();
  }

  async function updateCourt(slug: string, newCourtId: string) {
    await fetch(`/api/refs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedCourtId: newCourtId ? Number(newCourtId) : null }),
    });
    reload();
  }

  async function deleteRef(slug: string) {
    if (!confirm("Remove this ref?")) return;
    await fetch(`/api/refs/${slug}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-bold">Refs</h2>

      <form
        onSubmit={addRef}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-4"
      >
        <div>
          <label className="block text-sm text-neutral-400">Ref name</label>
          <input
            className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400">Assigned court</label>
          <select
            className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2"
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-sm font-medium">
          Add Ref
        </button>
      </form>

      <ul className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
        {refs.map((ref) => (
          <li key={ref.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium">{ref.name}</span>
            <select
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
              value={ref.assignedCourtId ?? ""}
              onChange={(e) => updateCourt(ref.slug, e.target.value)}
            >
              <option value="">Unassigned</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => deleteRef(ref.slug)}
              className="text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </li>
        ))}
        {refs.length === 0 && <li className="px-4 py-3 text-neutral-400">No refs yet.</li>}
      </ul>
    </div>
  );
}
