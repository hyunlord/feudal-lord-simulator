import type { GameState } from "../../engine/engine.types";
import type { PreviousRenderState } from "../../state/gameStore.types";
import { withPreviousResidentWalkers, withResidentWalkers } from "./residentWalkerState";

// CODE-1c cache (AGENTS rule 10): the state the screen draws — the simulation's plus that tick's presentation walkers
// (MOVE-1). Key: the state object (a tick or an action makes a new one; WeakMap, so old ones go). Reason: the canvas,
// the UI channel and every panel ask for the same tick's residents; computing them once per state is the old
// provider's one useMemo, now outside the store (state/ no longer imports the residents). Measured on pop176 at 5x
// (scripts/reactCommitPerf.mjs): one residentWalkers call per committed tick, as before the move.
// LEAK-1: its value is the state itself or a copy of its fields (never another state), so no entry keeps another key
// alive and each goes with its state.
const PRESENTED = new WeakMap<GameState, GameState>();

export function presentedState(state: GameState): GameState {
  let value = PRESENTED.get(state);
  if (value === undefined) { value = withResidentWalkers(state); PRESENTED.set(state, value); }
  return value;
}

/**
 * LEAK-1: the previous frame's walkers, one slot. It was a WeakMap keyed by the current state whose value held the
 * previous state — itself the key of the entry before — so the newest state kept every earlier one alive in a chain
 * (SMOOTH-G: 15,625 states, 413 MB of JS heap after two minutes at 5x). Now one entry, keyed by the two ticks and the
 * same two states (an action inside a tick makes a new state at the same tick): at most the pair being drawn is held.
 */
type PreviousSlot = {
  readonly previousTick: number; readonly currentTick: number;
  readonly previous: PreviousRenderState; readonly current: GameState; readonly value: PreviousRenderState;
};
let previousSlot: PreviousSlot | null = null;

const tickOf = (state: PreviousRenderState): number => "tick" in state && typeof state.tick === "number" ? state.tick : -1;

/** The previous frame's walkers for interpolation, with the same world's residents at the previous tick. */
export function presentedPreviousState(previous: PreviousRenderState, current: GameState): PreviousRenderState {
  const previousTick = tickOf(previous);
  const slot = previousSlot;
  if (slot !== null && slot.previousTick === previousTick && slot.currentTick === current.tick && slot.previous === previous && slot.current === current) return slot.value;
  const value = withPreviousResidentWalkers(previous, current);
  previousSlot = { previousTick, currentTick: current.tick, previous, current, value };
  return value;
}

/** LEAK-1 (tests): the slot's pair, to show that only one is ever held. */
export function presentedPreviousSlotTicks(): readonly [number, number] | null {
  return previousSlot === null ? null : [previousSlot.previousTick, previousSlot.currentTick];
}
