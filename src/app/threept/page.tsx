"use client";

import { useEffect, useState } from "react";
import type { ThreePointAttempt } from "@/lib/types";

export default function ThreePointPage() {
  const [entries, setEntries] = useState<ThreePointAttempt[]>([]);
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editScore, setEditScore] = useState("");

  function reload() {
    fetch("/api/threept").then((r) => r.json()).then(setEntries);
  }

  useEffect(reload, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || score === "") return;
    setSubmitting(true);
    try {
      await fetch("/api/threept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrantName: name, score: Number(score) }),
      });
      setName("");
      setScore("");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(entry: ThreePointAttempt) {
    setEditingId(entry.id);
    setEditName(entry.entrantName);
    setEditScore(String(entry.score));
  }

  async function saveEdit(id: number) {
    await fetch(`/api/threept/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entrantName: editName, score: Number(editScore) }),
    });
    setEditingId(null);
    reload();
  }

  async function deleteEntry(id: number) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/threept/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <h1 className="text-2xl font-bold">3-Point Contest</h1>
      <p className="mt-1 text-neutral-400">Enter each attempt as it happens.</p>

      <form
        onSubmit={submit}
        className="mt-4 space-y-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4"
      >
        <input
          className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-lg"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-lg"
          placeholder="Score"
          type="number"
          inputMode="numeric"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-700 py-3 text-lg font-bold disabled:opacity-40"
        >
          Submit
        </button>
      </form>

      <div className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-neutral-300">Today&apos;s entries</h2>
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-3"
            >
              {editingId === entry.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <input
                    className="w-16 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                    type="number"
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                  />
                  <button
                    onClick={() => saveEdit(entry.id)}
                    className="rounded bg-blue-700 px-2 py-1 text-sm"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-neutral-400">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">
                    {entry.entrantName} — <span className="font-bold">{entry.score}</span>
                  </span>
                  <button
                    onClick={() => startEdit(entry)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
          {entries.length === 0 && <p className="text-neutral-400">No entries yet.</p>}
        </div>
      </div>
    </div>
  );
}
