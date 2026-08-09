"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 60_000;

/**
 * Detects when a new deploy has gone out while this page is still open and
 * prompts a manual refresh. Necessary because a phone that loads the app
 * once and just sits open for hours (the common case for refs/check-in
 * staff, and the /live display itself) has no other way to notice new code
 * shipped — it keeps running whatever JS it already downloaded until the
 * page is actually reloaded. Checks periodically and whenever the tab
 * becomes visible/focused again (the most likely moment a deploy happened
 * while unattended).
 */
export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialBuildId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/version?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId: string };
        if (cancelled) return;
        if (initialBuildId.current === null) {
          initialBuildId.current = buildId;
        } else if (buildId !== initialBuildId.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network hiccup — just wait for the next check.
      }
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);

    function checkIfVisible() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", checkIfVisible);
    window.addEventListener("focus", checkIfVisible);
    window.addEventListener("pageshow", checkIfVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", checkIfVisible);
      window.removeEventListener("focus", checkIfVisible);
      window.removeEventListener("pageshow", checkIfVisible);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-blue-700 px-4 py-3 text-sm font-medium text-white shadow-lg">
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded bg-white px-3 py-1 font-semibold text-blue-700"
      >
        Refresh
      </button>
    </div>
  );
}
