/**
 * CODE-1c: the store's UI channel. `publish` hands the current state to the UI at once (a player's action, a speed
 * change); `publishThrottled` does so at most every `intervalMs` (a committed tick) and always for the last one, with
 * a trailing timer. The clock and the timer are passed in so a test can drive them.
 */
export type UiChannel<T> = {
  readonly getState: () => T;
  readonly subscribe: (listener: () => void) => () => void;
  readonly publish: () => void;
  readonly publishThrottled: () => void;
  readonly dispose: () => void;
};

export function createUiChannel<T>(input: {
  readonly initial: T;
  readonly read: () => T;
  readonly intervalMs: number;
  readonly now: () => number;
  readonly setTimer: (run: () => void, delayMs: number) => unknown;
  readonly clearTimer: (timer: unknown) => void;
}): UiChannel<T> {
  let state = input.initial;
  let publishedAt = Number.NEGATIVE_INFINITY;
  let timer: unknown = null;
  const listeners = new Set<() => void>();
  const cancel = () => { if (timer !== null) { input.clearTimer(timer); timer = null; } };
  const publish = () => {
    cancel();
    publishedAt = input.now();
    const next = input.read();
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish,
    publishThrottled: () => {
      const wait = publishedAt + input.intervalMs - input.now();
      if (wait <= 0) publish();
      else if (timer === null) timer = input.setTimer(publish, wait);
    },
    dispose: cancel,
  };
}
