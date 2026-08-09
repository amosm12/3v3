"use client";

import { useEffect, useState } from "react";
import { POLL_INTERVAL_MS } from "@/lib/constants";

// Polls `url` every `intervalMs`, keeping the last-known-good `data` on a
// failed request instead of clearing the screen (venue wifi can hiccup).
export function usePolling<T>(url: string, intervalMs: number = POLL_INTERVAL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, error, loading };
}
