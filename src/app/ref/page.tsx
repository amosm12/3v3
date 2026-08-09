"use client";

import { usePolling } from "@/components/usePolling";
import { SearchableList } from "@/components/SearchableList";
import type { Ref } from "@/lib/types";

export default function RefListPage() {
  const { data: refs, loading } = usePolling<Ref[]>("/api/refs", 5000);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 px-4 py-6 text-neutral-100">
      <h1 className="text-2xl font-bold">Refs</h1>
      <p className="mt-1 text-neutral-400">Find your name to see your matches.</p>
      <div className="mt-4">
        {loading && <p className="text-neutral-400">Loading…</p>}
        {refs && (
          <SearchableList
            basePath="/ref"
            placeholder="Search ref name…"
            items={refs.map((r) => ({ slug: r.slug, label: r.name }))}
          />
        )}
      </div>
    </div>
  );
}
