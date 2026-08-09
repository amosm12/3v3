"use client";

import { usePolling } from "@/components/usePolling";
import { SearchableList } from "@/components/SearchableList";
import type { Team } from "@/lib/types";

export default function TeamListPage() {
  const { data: teams, loading } = usePolling<Team[]>("/api/teams", 5000);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <h1 className="text-2xl font-bold">Find Your Team</h1>
      <p className="mt-1 text-neutral-400">See your schedule for the day.</p>
      <a
        href="https://drive.google.com/file/d/1_UcmwiemgEbnsQwL3hjfkpDQRpekz7nb/view?usp=sharing"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm text-blue-400 hover:text-blue-300"
      >
        Tournament Rules
      </a>
      <div className="mt-4">
        {loading && <p className="text-neutral-400">Loading…</p>}
        {teams && (
          <SearchableList
            basePath="/team"
            placeholder="Search team name…"
            items={teams.map((t) => ({ slug: t.slug, label: t.name }))}
          />
        )}
      </div>
    </div>
  );
}
