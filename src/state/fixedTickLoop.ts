import { proofFrameWork } from "../testing/proofFrameWork";
import { BALANCE } from "../content/balanceConfig";
import { advanceTick } from "../engine/tick";
import type { GameSpeed, GameState } from "../engine/engine.types";

const MAX_TICKS_PER_FRAME = 5;
const TICK_DURATION_MS = 1_000 / BALANCE.TICKS_PER_SECOND;
/**
 * SMOOTH-2E: one frame's ticks stop once they have taken this long (half a 60 Hz frame); the ticks still due wait in
 * the accumulator for the next frame (still at most five a frame). Every tick runs, in order, with the same result —
 * only when it lands on screen moves, so under load the calendar runs a little slower instead of a frame stalling.
 */
export const TICK_BUDGET_MS = 8;

export interface AnimationFrameScheduler {
  readonly request: (callback: (timestampMs: number) => void) => number;
  readonly cancel: (id: number) => void;
}

interface FixedTickLoopInput {
  readonly scheduler: AnimationFrameScheduler;
  readonly getSpeed: () => GameSpeed;
  readonly getState: () => GameState;
  readonly commit: (previousState: GameState, nextState: GameState) => void;
  /** The clock the tick budget reads (default `performance.now`). */
  readonly now?: () => number;
}

export interface FixedTickLoop {
  readonly start: () => void;
  readonly stop: () => void;
  readonly interpolationAlpha: () => number;
}

export const browserAnimationFrameScheduler: AnimationFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (id) => window.cancelAnimationFrame(id),
};

export function createFixedTickLoop(input: FixedTickLoopInput): FixedTickLoop {
  let accumulatorMs = 0;
  let previousTimestampMs: number | null = null;
  let frameId: number | null = null;
  let running = false;
  let paused = input.getSpeed() === 0;
  const now = input.now ?? (() => performance.now());

  const requestNextFrame = () => {
    frameId = input.scheduler.request(runFrame);
  };

  const runFrame = (timestampMs: number) => {
    frameId = null;
    if (!running) return;

    if (previousTimestampMs === null) {
      previousTimestampMs = timestampMs;
      requestNextFrame();
      return;
    }

    const elapsedMs = Math.max(0, timestampMs - previousTimestampMs);
    previousTimestampMs = timestampMs;
    const speed = input.getSpeed();

    if (speed === 0) {
      paused = true;
      accumulatorMs = 0;
      requestNextFrame();
      return;
    }
    paused = false;

    accumulatorMs = Math.min(
      accumulatorMs + elapsedMs * speed,
      TICK_DURATION_MS * MAX_TICKS_PER_FRAME,
    );

    const previousState = input.getState();
    let nextState = previousState;
    let tickCount = 0;
    const budgetStartedAt = now();
    while (accumulatorMs >= TICK_DURATION_MS && tickCount < MAX_TICKS_PER_FRAME) {
      const work = proofFrameWork.current;
      const startedAt = work === null ? 0 : performance.now();
      nextState = advanceTick(nextState);
      if (work !== null) work.recordTick(performance.now() - startedAt);
      accumulatorMs -= TICK_DURATION_MS;
      tickCount += 1;
      if (now() - budgetStartedAt >= TICK_BUDGET_MS) break;
    }
    if (tickCount > 0) input.commit(previousState, nextState);
    requestNextFrame();
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      requestNextFrame();
    },
    stop: () => {
      running = false;
      paused = true;
      previousTimestampMs = null;
      accumulatorMs = 0;
      if (frameId !== null) input.scheduler.cancel(frameId);
      frameId = null;
    },
    interpolationAlpha: () => paused ? 1 : Math.min(1, accumulatorMs / TICK_DURATION_MS),
  };
}
