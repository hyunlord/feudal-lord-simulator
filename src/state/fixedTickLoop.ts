import { BALANCE } from "../content/balanceConfig";
import { advanceTick } from "../engine/tick";
import type { GameSpeed, GameState } from "../engine/engine.types";

const MAX_TICKS_PER_FRAME = 5;
const TICK_DURATION_MS = 1_000 / BALANCE.TICKS_PER_SECOND;

export interface AnimationFrameScheduler {
  readonly request: (callback: (timestampMs: number) => void) => number;
  readonly cancel: (id: number) => void;
}

interface FixedTickLoopInput {
  readonly scheduler: AnimationFrameScheduler;
  readonly getSpeed: () => GameSpeed;
  readonly getState: () => GameState;
  readonly commit: (previousState: GameState, nextState: GameState) => void;
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
      accumulatorMs = 0;
      requestNextFrame();
      return;
    }

    accumulatorMs = Math.min(
      accumulatorMs + elapsedMs * speed,
      TICK_DURATION_MS * MAX_TICKS_PER_FRAME,
    );

    const previousState = input.getState();
    let nextState = previousState;
    let tickCount = 0;
    while (accumulatorMs >= TICK_DURATION_MS && tickCount < MAX_TICKS_PER_FRAME) {
      nextState = advanceTick(nextState);
      accumulatorMs -= TICK_DURATION_MS;
      tickCount += 1;
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
      previousTimestampMs = null;
      accumulatorMs = 0;
      if (frameId !== null) input.scheduler.cancel(frameId);
      frameId = null;
    },
    interpolationAlpha: () => Math.min(1, accumulatorMs / TICK_DURATION_MS),
  };
}
