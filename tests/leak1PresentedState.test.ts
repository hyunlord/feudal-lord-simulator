import assert from "node:assert/strict";
import { test } from "node:test";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import type { GameState } from "../src/engine/engine.types";
import { presentedPreviousSlotTicks, presentedPreviousState, presentedState } from "../src/render/presentation/presentedState";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// LEAK-1: the previous-frame cache held the previous state in the value of an entry keyed by the current one, so the
// newest state kept every earlier one alive (SMOOTH-G: 15,625 states after two minutes at 5x). A run of ticks, the way
// the canvas asks (previous = the state before, current = the new one): the earlier states must go.
setFlagsFromString("--expose_gc");
const gc = runInNewContext("gc") as () => void;

const tickState = (tick: number): GameState => ({ ...DEFAULT_GAME_STATE, tick });

test("LEAK-1: after a run of ticks only the last pair is held — the earlier states are collected", async () => {
  const refs: WeakRef<GameState>[] = [];
  let previous = tickState(1);
  for (let tick = 2; tick <= 200; tick += 1) {
    const current = tickState(tick);
    presentedState(current);
    presentedPreviousState(previous, current);
    refs.push(new WeakRef(previous));
    previous = current;
  }
  assert.deepEqual(presentedPreviousSlotTicks(), [199, 200], "one slot, the last pair");
  previous = tickState(0);
  for (let round = 0; round < 3; round += 1) { gc(); await new Promise(resolve => setTimeout(resolve, 0)); }
  const alive = refs.filter(ref => ref.deref() !== undefined).length;
  // At most the pair the slot still holds (tick 199 as the previous) may be alive.
  assert.ok(alive <= 1, `${alive} of ${refs.length} earlier states still alive`);
});

test("LEAK-1: the same pair is one computation; a new state at the same tick (an action) is not the old answer", () => {
  const previous = tickState(10); const current = tickState(11);
  const first = presentedPreviousState(previous, current);
  assert.equal(presentedPreviousState(previous, current), first);
  const acted = { ...current };
  assert.deepEqual(presentedPreviousSlotTicks(), [10, 11]);
  presentedPreviousState(previous, acted);
  assert.deepEqual(presentedPreviousSlotTicks(), [10, 11], "same ticks, the new state's entry");
  assert.equal(presentedPreviousState(previous, acted), presentedPreviousState(previous, acted));
});
