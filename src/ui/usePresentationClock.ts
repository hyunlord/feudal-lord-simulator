import { useEffect, useState } from "react";

/** The presentation clock's step: goal cards, banners, story chips, the era ceremony and the completion toast. */
export const PRESENTATION_CLOCK_MS = 100;

/**
 * CODE-1c: the presentation clock runs only while something on screen is timed by it (`active`). A still town at 5x
 * made App commit ten times a second for nothing. While it rests, a render reads the wall clock itself, so a stamp
 * taken then (a banner's end, a ceremony's start) is never stale.
 */
export function usePresentationClock(active: boolean): number {
  const [presentationNowMs, setPresentationNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setPresentationNowMs(Date.now());
    const interval = window.setInterval(() => setPresentationNowMs(Date.now()), PRESENTATION_CLOCK_MS);
    return () => window.clearInterval(interval);
  }, [active]);
  return active ? presentationNowMs : Date.now();
}
