import { useEffect, useState } from "react";

/** The presentation clock's step: goal cards, banners, story chips, the era ceremony and the completion toast. */
export const PRESENTATION_CLOCK_MS = 100;

/**
 * The clock's reading at a render: its last stamp while it runs; the wall clock while it rests — and on the render that
 * starts it again, before it has stamped (`running` is still the rest's), so the stamp taken when it last stopped is
 * never read as now.
 */
export function presentationClockReading(clock: { readonly nowMs: number; readonly running: boolean }, active: boolean, wallMs: number): number {
  return active && clock.running ? clock.nowMs : wallMs;
}

/**
 * CODE-1c: the presentation clock runs only while something on screen is timed by it (`active`). A still town at 5x
 * made App commit ten times a second for nothing. While it rests, a render reads the wall clock itself, so a stamp
 * taken then (a banner's end, a ceremony's start) is never stale.
 * LS1-9 follow-up (render-VIS-ls19-5ade799): the render that started it again read the stamp from when it last stopped
 * — a completion toast after a rest drew the story rail as it stood then (chips seen since gone, chips long closed
 * back) until the next render. The start is now taken during that render (the clock's own state, set as it changes).
 */
export function usePresentationClock(active: boolean): number {
  const [presentationNowMs, setPresentationNowMs] = useState(() => Date.now());
  const [running, setRunning] = useState(active);
  useEffect(() => {
    if (!active) return undefined;
    const interval = window.setInterval(() => setPresentationNowMs(Date.now()), PRESENTATION_CLOCK_MS);
    return () => window.clearInterval(interval);
  }, [active]);
  const nowMs = presentationClockReading({ nowMs: presentationNowMs, running }, active, Date.now());
  if (running !== active) { setRunning(active); setPresentationNowMs(nowMs); }
  return nowMs;
}
