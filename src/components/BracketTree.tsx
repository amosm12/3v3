"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MatchWithNames } from "@/lib/types";

const ROUND_ORDER = ["Round of 16", "Quarterfinal", "Semifinal", "Final"];
const ROW_HEIGHT = 96; // px per Round-of-16 slot — every column shares this
// same total height, so flexbox `justify-content: space-around` centers
// each later-round match exactly between the two matches that feed it,
// producing the classic triangular bracket shape with zero manual math.
const COLUMN_WIDTH = 224; // px, matches `w-56`
const COLUMN_GAP = 64; // px, matches `gap-16`
const HEADER_BLOCK_HEIGHT = 40; // round-label row height (28px text-xl line + 12px mt-3 gap)
const MAX_SCALE = 1.8;
// Below this, team names become illegible on a phone — better to let the
// user scroll/pan the bracket at a readable size than shrink it to fit a
// narrow viewport. Matches the /live page's sm breakpoint.
const MIN_SCALE_MOBILE = 0.75;
const MOBILE_MEDIA_QUERY = "(min-width: 640px)";

/**
 * Orders matches into [R16, QF, SF, F] columns, left-to-right within each
 * column, purely from `feedsIntoMatchId`/`feedsIntoSlot` — not from id or
 * insertion order — so the layout is correct regardless of how the rows
 * happened to be created.
 */
function buildColumns(matches: MatchWithNames[]): MatchWithNames[][] {
  const childrenByParent = new Map<number, MatchWithNames[]>();
  for (const m of matches) {
    if (m.feedsIntoMatchId == null) continue;
    const list = childrenByParent.get(m.feedsIntoMatchId) ?? [];
    list.push(m);
    childrenByParent.set(m.feedsIntoMatchId, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.feedsIntoSlot === b.feedsIntoSlot ? 0 : a.feedsIntoSlot === "A" ? -1 : 1));
  }

  const final = matches.find((m) => m.feedsIntoMatchId == null);
  const columns: MatchWithNames[][] = [[], [], [], []];
  if (!final) return columns;

  function place(match: MatchWithNames, depthFromFinal: number) {
    columns[3 - depthFromFinal].push(match);
    for (const kid of childrenByParent.get(match.id) ?? []) {
      place(kid, depthFromFinal + 1);
    }
  }
  place(final, 0);
  return columns;
}

export default function BracketTree({ matches }: { matches: MatchWithNames[] }) {
  const columns = useMemo(() => buildColumns(matches), [matches]);
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef(new Map<number, HTMLDivElement>());
  const [paths, setPaths] = useState<string[]>([]);
  const [scale, setScale] = useState(1);

  const bodyHeight = columns[0].length * ROW_HEIGHT;
  const naturalHeight = HEADER_BLOCK_HEIGHT + bodyHeight;
  const naturalWidth = ROUND_ORDER.length * COLUMN_WIDTH + (ROUND_ORDER.length - 1) * COLUMN_GAP;

  // Scale the whole bracket to fit whatever space its parent gives it —
  // the /live page never scrolls the bracket, it just shrinks (or grows)
  // to fit instead.
  useLayoutEffect(() => {
    function recomputeScale() {
      const outer = outerRef.current;
      if (!outer || naturalWidth <= 0 || naturalHeight <= 0) return;
      const availW = outer.clientWidth;
      const availH = outer.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const fit = Math.min(availW / naturalWidth, availH / naturalHeight, MAX_SCALE);
      const isMobile = !window.matchMedia(MOBILE_MEDIA_QUERY).matches;
      const clamped = isMobile ? Math.max(fit, MIN_SCALE_MOBILE) : fit;
      setScale(clamped > 0 && Number.isFinite(clamped) ? clamped : 1);
    }

    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener("resize", recomputeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeScale);
    };
  }, [naturalWidth, naturalHeight]);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next: string[] = [];
      for (const m of matches) {
        if (m.feedsIntoMatchId == null) continue;
        const fromEl = matchRefs.current.get(m.id);
        const toEl = matchRefs.current.get(m.feedsIntoMatchId);
        if (!fromEl || !toEl) continue;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        // getBoundingClientRect reports post-scale screen pixels, but this
        // SVG lives inside the same scaled wrapper as the match cards, so
        // its own coordinates need to be back in natural (pre-scale) units
        // — otherwise the transform scales the already-scaled path a
        // second time.
        const x1 = (fromRect.right - containerRect.left) / scale;
        const y1 = (fromRect.top + fromRect.height / 2 - containerRect.top) / scale;
        const x2 = (toRect.left - containerRect.left) / scale;
        const y2 = (toRect.top + toRect.height / 2 - containerRect.top) / scale;
        const midX = (x1 + x2) / 2;
        next.push(`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
      }
      setPaths(next);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [matches, columns, scale]);

  return (
    <div
      ref={outerRef}
      className="flex h-full w-full items-start justify-start overflow-auto sm:items-center sm:justify-center sm:overflow-hidden"
    >
      <div
        style={{
          width: naturalWidth,
          height: naturalHeight,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div className="flex" style={{ gap: COLUMN_GAP }}>
          {ROUND_ORDER.map((label) => (
            <h3
              key={label}
              className="shrink-0 border-b-2 border-amber-500/40 pb-1 text-xl font-semibold text-neutral-300"
              style={{ width: COLUMN_WIDTH }}
            >
              {label}
            </h3>
          ))}
        </div>
        <div ref={containerRef} className="relative mt-3 flex" style={{ gap: COLUMN_GAP, height: bodyHeight }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#525252" strokeWidth={2} />
            ))}
          </svg>
          {columns.map((col, i) => (
            <div
              key={ROUND_ORDER[i]}
              className="relative flex shrink-0 flex-col justify-around"
              style={{ width: COLUMN_WIDTH }}
            >
              {col.map((m) => (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (el) matchRefs.current.set(m.id, el);
                    else matchRefs.current.delete(m.id);
                  }}
                  className="relative z-10 rounded-lg border border-neutral-700 bg-linear-to-br from-neutral-900 to-neutral-950 p-3 shadow-md shadow-black/40"
                >
                  <div
                    className={`flex justify-between text-lg ${
                      m.winnerId != null && m.winnerId === m.teamAId ? "font-bold text-amber-400" : ""
                    }`}
                  >
                    <span className="truncate">
                      {m.winnerId != null && m.winnerId === m.teamAId && m.roundLabel === "Final" && "🏆 "}
                      {m.teamA?.name ?? "TBD"}
                    </span>
                    <span>{m.status !== "scheduled" ? m.scoreA : ""}</span>
                  </div>
                  <div
                    className={`flex justify-between text-lg ${
                      m.winnerId != null && m.winnerId === m.teamBId ? "font-bold text-amber-400" : ""
                    }`}
                  >
                    <span className="truncate">
                      {m.winnerId != null && m.winnerId === m.teamBId && m.roundLabel === "Final" && "🏆 "}
                      {m.teamB?.name ?? "TBD"}
                    </span>
                    <span>{m.status !== "scheduled" ? m.scoreB : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
