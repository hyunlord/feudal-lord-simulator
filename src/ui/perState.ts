import type { GameState } from "../engine/engine.types";

/**
 * A view of the game computed once per state object. Cache (AGENTS rule 10): (a) the key is the game state object
 * itself — immutable, a new object each tick or command (presentedState keeps one per state); (b) nothing else enters:
 * `compute` must read only the state; (c) the screens re-render on clock and UI events within a tick, and a view that
 * runs engine commands or walks the ledger would run again each time. A WeakMap, so a state no longer held goes with its
 * view; a view must not hold other states (LEAK-1), only what it shows.
 */
export function perState<T>(compute: (state: GameState) => T): (state: GameState) => T {
  const memo = new WeakMap<GameState, T>();
  return state => {
    if (memo.has(state)) return memo.get(state) as T;
    const view = compute(state);
    memo.set(state, view);
    return view;
  };
}
