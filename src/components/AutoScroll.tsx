"use client";

import { useEffect, useRef } from "react";

const SPEED_PX_PER_SEC = 35;
const PAUSE_MS = 1600;

/**
 * A box that slowly auto-scrolls its content up and down (pausing at each
 * end) instead of requiring the viewer to scroll manually — built for the
 * projector-style /live page, where the page itself must never scroll but
 * a panel's content (standings, 3pt leaderboard) can be longer than the
 * space available for it. No-ops if the content already fits.
 */
export default function AutoScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf: number;
    let direction: 1 | -1 = 1;
    let lastTime = performance.now();
    let pauseUntil = 0;
    // The DOM's scrollTop is an integer — each frame's step is well under
    // 1px, so reading it back as the running position would round every
    // increment down to 0 forever. Track the precise position ourselves
    // and only push it to the DOM.
    let pos = 0;

    function step(now: number) {
      raf = requestAnimationFrame(step);
      const maxScroll = el!.scrollHeight - el!.clientHeight;
      if (maxScroll <= 1 || now < pauseUntil) {
        lastTime = now;
        return;
      }
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      pos += direction * SPEED_PX_PER_SEC * dt;
      if (direction === 1 && pos >= maxScroll) {
        pos = maxScroll;
        direction = -1;
        pauseUntil = now + PAUSE_MS;
      } else if (direction === -1 && pos <= 0) {
        pos = 0;
        direction = 1;
        pauseUntil = now + PAUSE_MS;
      }
      el!.scrollTop = pos;
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      {children}
    </div>
  );
}
