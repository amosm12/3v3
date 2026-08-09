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
    let intervalId: ReturnType<typeof setInterval> | null = null;

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

    function startInterval() {
      if (intervalId == null) intervalId = setInterval(poll, intervalMs);
    }
    function stopInterval() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // A backgrounded/hidden tab has nobody looking at it — stop hitting the
    // server every `intervalMs` for no reason (this can be a real chunk of
    // aggregate load with dozens of phones open at once). Catch up with an
    // immediate poll the moment it's actually visible again instead of
    // waiting for whatever's left of the old interval — this also covers
    // mobile Safari suspending timers in the background and restoring a
    // page from its back-forward cache without re-running this effect.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        poll();
        startInterval();
      } else {
        stopInterval();
      }
    }

    if (document.visibilityState === "visible") {
      poll();
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("pageshow", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("pageshow", handleVisibilityChange);
    };
  }, [url, intervalMs]);

  return { data, error, loading };
}
