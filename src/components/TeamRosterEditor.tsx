"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";
import { MAX_PLAYERS_PER_TEAM } from "@/lib/constants";
import { isTeamCheckedIn, isTeamPaid } from "@/lib/teamStatus";

type RosterPlayer = { id?: number; name: string; isRequired: boolean; phone: string };

export function TeamRosterEditor({
  team,
  showCheckin,
  source,
  onTeamUpdated,
  onTeamDeleted,
}: {
  team: Team;
  showCheckin: boolean;
  source: "admin" | "checkin";
  onTeamUpdated: (team: Team) => void;
  onTeamDeleted?: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [roster, setRoster] = useState<RosterPlayer[]>(
    team.players.map((p) => ({ id: p.id, name: p.name, isRequired: p.isRequired, phone: p.phone ?? "" })),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [revealedPhoneIndex, setRevealedPhoneIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function updateRosterName(index: number, value: string) {
    setRoster((r) => r.map((p, i) => (i === index ? { ...p, name: value } : p)));
    setDirty(true);
  }

  function updateRosterPhone(index: number, value: string) {
    setRoster((r) => r.map((p, i) => (i === index ? { ...p, phone: value } : p)));
    setDirty(true);
  }

  function addSub() {
    setRoster((r) => [...r, { name: "", isRequired: false, phone: "" }]);
    setDirty(true);
  }

  function removePlayer(index: number) {
    setRoster((r) => r.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function saveRoster() {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          players: roster.filter((p) => p.name.trim()),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onTeamUpdated(updated);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(playerId: number, paid: boolean) {
    const res = await fetch(`/api/teams/${team.slug}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, paid, source }),
    });
    if (res.ok) {
      const updated = await res.json();
      const players = team.players.map((p) => (p.id === playerId ? updated : p));
      onTeamUpdated({ ...team, players, checkedIn: isTeamCheckedIn(players), paid: isTeamPaid(players) });
    }
  }

  async function toggleCheckedIn(playerId: number, checkedIn: boolean) {
    const res = await fetch(`/api/teams/${team.slug}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, checkedIn }),
    });
    if (res.ok) {
      const players = team.players.map((p) => (p.id === playerId ? { ...p, checkedIn } : p));
      onTeamUpdated({ ...team, players, checkedIn: isTeamCheckedIn(players), paid: isTeamPaid(players) });
    }
  }

  async function markTeamPaid() {
    const res = await fetch(`/api/teams/${team.slug}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRequired: true, paid: true, source }),
    });
    if (res.ok) {
      const updatedRequired: { id: number }[] = await res.json();
      const updatedById = new Map(updatedRequired.map((p) => [p.id, p]));
      const players = team.players.map((p) => updatedById.get(p.id) as typeof p ?? p);
      onTeamUpdated({ ...team, players, checkedIn: isTeamCheckedIn(players), paid: isTeamPaid(players) });
    }
  }

  async function markTeamCheckedIn() {
    const res = await fetch(`/api/teams/${team.slug}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRequired: true, checkedIn: true }),
    });
    if (res.ok) {
      const updatedRequired: { id: number }[] = await res.json();
      const updatedById = new Map(updatedRequired.map((p) => [p.id, p]));
      const players = team.players.map((p) => updatedById.get(p.id) as typeof p ?? p);
      onTeamUpdated({ ...team, players, checkedIn: isTeamCheckedIn(players), paid: isTeamPaid(players) });
    }
  }

  async function deleteTeam() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/teams/${team.slug}`, { method: "DELETE" });
    if (res.ok) onTeamDeleted?.();
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-lg font-semibold"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            team.checkedIn ? "bg-green-800 text-green-200" : "bg-neutral-700 text-neutral-300"
          }`}
        >
          {team.checkedIn ? "Checked in" : "Not checked in"}
        </span>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            team.paid ? "bg-green-800 text-green-200" : "bg-amber-800 text-amber-200"
          }`}
        >
          {team.paid ? "Paid" : "Unpaid"}
        </span>
      </div>

      <div className="space-y-2">
        {roster.map((p, i) => {
          const existing = team.players.find((tp) => tp.id === p.id);
          return (
            <div key={p.id ?? `new-${i}`} className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {source === "checkin" && existing && editingIndex !== i ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRevealedPhoneIndex((cur) => (cur === i ? null : i))}
                      className="flex-1 truncate rounded border border-transparent px-2 py-1 text-left hover:border-neutral-600 hover:bg-neutral-800"
                    >
                      {p.name || <span className="text-neutral-500">Unnamed</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIndex(i);
                        setRevealedPhoneIndex(null);
                      }}
                      className="shrink-0 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Edit
                    </button>
                  </>
                ) : (
                  <input
                    className="flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                    placeholder={p.isRequired ? "Player name" : "Sub name (optional)"}
                    value={p.name}
                    autoFocus={source === "checkin" && editingIndex === i}
                    onChange={(e) => updateRosterName(i, e.target.value)}
                    onBlur={() => source === "checkin" && setEditingIndex(null)}
                  />
                )}
                <span className="w-14 shrink-0 text-neutral-400">
                  {p.isRequired ? "Player" : "Sub"}
                </span>
                {source === "admin" && (
                  <input
                    className="w-32 shrink-0 rounded border border-neutral-600 bg-neutral-800 px-2 py-1"
                    placeholder="Phone"
                    type="tel"
                    value={p.phone}
                    onChange={(e) => updateRosterPhone(i, e.target.value)}
                  />
                )}
                {p.isRequired && existing && (() => {
                  const lockedByAdmin = source === "checkin" && existing.paid && existing.paidByAdmin;
                  return (
                    <label
                      className={`flex shrink-0 items-center gap-1 ${lockedByAdmin ? "opacity-60" : ""}`}
                      title={lockedByAdmin ? "Marked paid by admin — corrections go through /admin" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={existing.paid}
                        disabled={lockedByAdmin}
                        onChange={(e) => togglePaid(existing.id, e.target.checked)}
                      />
                      Paid
                    </label>
                  );
                })()}
                {showCheckin && existing && (
                  <label className="flex shrink-0 items-center gap-1">
                    <input
                      type="checkbox"
                      checked={existing.checkedIn}
                      onChange={(e) => toggleCheckedIn(existing.id, e.target.checked)}
                    />
                    Checked in
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => removePlayer(i)}
                  className="shrink-0 text-red-400 hover:text-red-300"
                  aria-label="Remove player"
                >
                  &times;
                </button>
              </div>
              {source === "checkin" && revealedPhoneIndex === i && existing && (
                <div className="pl-1 text-xs text-neutral-400">
                  {existing.phone ? (
                    <>
                      Phone:{" "}
                      <a href={`tel:${existing.phone}`} className="text-blue-400 hover:text-blue-300">
                        {existing.phone}
                      </a>
                    </>
                  ) : (
                    "No phone on file"
                  )}
                </div>
              )}
            </div>
          );
        })}
        {roster.length < MAX_PLAYERS_PER_TEAM && (
          <button
            type="button"
            onClick={addSub}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add sub (free)
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={saveRoster}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save roster"}
        </button>
        <button
          type="button"
          onClick={markTeamPaid}
          disabled={team.paid}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          Mark team paid ($60)
        </button>
        {showCheckin && (
          <button
            type="button"
            onClick={markTeamCheckedIn}
            disabled={team.checkedIn}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Mark team checked in
          </button>
        )}
        <button
          type="button"
          onClick={deleteTeam}
          className="ml-auto rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-red-200"
        >
          Delete team
        </button>
      </div>
    </div>
  );
}
