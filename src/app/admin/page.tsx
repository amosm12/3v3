"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Team } from "@/lib/types";

const CARDS = [
  { href: "/admin/teams", label: "Teams & Roster", desc: "Add teams, edit rosters, track payment" },
  { href: "/admin/checkin-overview", label: "Check-in Overview", desc: "Read-only check-in progress" },
  { href: "/admin/format", label: "Format & Generation", desc: "Pick format, generate groups/pairing" },
  { href: "/admin/schedule", label: "Schedule", desc: "Assign courts, times, refs to matches" },
  { href: "/admin/refs", label: "Refs", desc: "Add refs, assign to courts" },
  { href: "/admin/seeding", label: "Knockout Seeding", desc: "Seed the top-16 bracket" },
  { href: "/admin/matches", label: "Match Overrides", desc: "Score override, un-finalize, unlock" },
  { href: "/admin/settings", label: "Phase & Reset", desc: "Tournament phase, reset test data" },
];

export default function AdminDashboard() {
  const [teams, setTeams] = useState<Team[] | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  const checkedIn = teams?.filter((t) => t.checkedIn).length ?? 0;
  const paid = teams?.filter((t) => t.paid).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Teams" value={teams?.length ?? "…"} />
        <StatCard label="Checked in" value={teams ? `${checkedIn} / ${teams.length}` : "…"} />
        <StatCard label="Paid" value={teams ? `${paid} / ${teams.length}` : "…"} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 hover:border-neutral-500"
          >
            <div className="font-semibold">{c.label}</div>
            <div className="mt-1 text-sm text-neutral-400">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
