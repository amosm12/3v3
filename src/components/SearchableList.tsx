"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SearchableItem = {
  slug: string;
  label: string;
  sublabel?: string;
};

export function SearchableList({
  items,
  basePath,
  placeholder = "Search…",
  emptyMessage = "No results.",
}: {
  items: SearchableItem[];
  basePath: string;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-3">
      <input
        autoFocus
        className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-3 text-lg"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
        {filtered.map((item) => (
          <li key={item.slug}>
            <Link
              href={`${basePath}/${item.slug}`}
              className="flex items-center justify-between px-4 py-3 text-lg hover:bg-neutral-800 active:bg-neutral-700"
            >
              <span>{item.label}</span>
              {item.sublabel && (
                <span className="text-sm text-neutral-400">{item.sublabel}</span>
              )}
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-neutral-400">{emptyMessage}</li>
        )}
      </ul>
    </div>
  );
}
