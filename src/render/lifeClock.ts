// INSTALL-23b (user judgement 2026-09-28): the village's animals and birds stop while the game is paused; water, smoke
// and weather go on (they keep the wall clock `nowMs`). The life clock is the wall clock with the paused time taken
// out: it advances by the frame's elapsed time only while the game runs (at the wall's pace at every speed, so a bird
// does not cross the sky five times faster at 5x), and holds while paused. Walkers are still on their own when paused
// (their positions interpolate between ticks and the loop's alpha holds at 1).

export type LifeClock = (nowMs: number, running: boolean) => number;

/** A clock starting at 0 on its first frame. A gap over MAX_STEP_MS (a hidden tab, a debugger) advances MAX_STEP_MS. */
export function createLifeClock(): LifeClock {
  let lastMs: number | null = null;
  let lifeMs = 0;
  return (nowMs, running) => {
    if (lastMs !== null && running) lifeMs += Math.min(MAX_STEP_MS, Math.max(0, nowMs - lastMs));
    lastMs = nowMs;
    return lifeMs;
  };
}

export const MAX_STEP_MS = 250;
