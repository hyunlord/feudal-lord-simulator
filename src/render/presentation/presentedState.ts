import type { GameState } from "../../engine/engine.types";
import type { PreviousRenderState } from "../../state/gameStore.types";
import { withPreviousResidentWalkers, withResidentWalkers } from "./residentWalkerState";

// CODE-1c cache (AGENTS rule 10): the state the screen draws — the simulation's plus that tick's presentation walkers
// (MOVE-1). Key: the state object (a tick or an action makes a new one; WeakMap, so old ones go). Reason: the canvas,
// the UI channel and every panel ask for the same tick's residents; computing them once per state is the old
// provider's one useMemo, now outside the store (state/ no longer imports the residents). Measured on pop176 at 5x
// (scripts/reactCommitPerf.mjs): one residentWalkers call per committed tick, as before the move.
const PRESENTED = new WeakMap<GameState, GameState>();
const PREVIOUS = new WeakMap<GameState, { readonly previous: PreviousRenderState; readonly value: PreviousRenderState }>();

export function presentedState(state: GameState): GameState {
  let value = PRESENTED.get(state);
  if (value === undefined) { value = withResidentWalkers(state); PRESENTED.set(state, value); }
  return value;
}

/** The previous frame's walkers for interpolation, with the same world's residents at the previous tick. */
export function presentedPreviousState(previous: PreviousRenderState, current: GameState): PreviousRenderState {
  const cached = PREVIOUS.get(current);
  if (cached !== undefined && cached.previous === previous) return cached.value;
  const value = withPreviousResidentWalkers(previous, current);
  PREVIOUS.set(current, { previous, value });
  return value;
}
