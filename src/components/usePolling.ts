"use client";

import { useEffect, useRef, useState } from "react";
import { POLL_INTERVAL_MS } from "@/lib/constants";

// Polls `url` every `intervalMs`, keeping the last-known-good `data` on a
// failed request instead of clearing the screen (venue wifi can hiccup).
export function usePolling<T>(url: string, intervalMs: number = POLL_INTERVAL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        // A cache-busting param plus `cache: "no-store"` — mobile Safari
        // has a history of WebKit-level GET caching that ignores the fetch
        // cache mode alone for a repeated identical URL.
        const bustUrl = url + (url.includes("?") ? "&" : "?") + `_=${Date.now()}`;
        const res = await fetch(bustUrl, { cache: "no-store" });
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
    pollRef.current = poll;

    poll();
    const id = setInterval(poll, intervalMs);

    // Mobile Safari suspends setInterval while the tab is backgrounded
    // (screen lock, app switch) and can restore a page from its
    // back-forward cache without re-running this effect at all — either
    // way, the last poll can be arbitrarily stale by the time someone
    // looks at the screen again. Force a fresh poll the moment the page
    // is actually visible/active again instead of waiting for the next
    // scheduled tick.
    function pollIfVisible() {
      if (document.visibilityState === "visible") pollRef.current();
    }
    document.addEventListener("visibilitychange", pollIfVisible);
    window.addEventListener("focus", pollIfVisible);
    window.addEventListener("pageshow", pollIfVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", pollIfVisible);
      window.removeEventListener("focus", pollIfVisible);
      window.removeEventListener("pageshow", pollIfVisible);
    };
  }, [url, intervalMs]);

  return { data, error, loading };
}
