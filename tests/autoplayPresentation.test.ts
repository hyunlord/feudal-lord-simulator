import assert from "node:assert/strict";
import test from "node:test";

import type { AutoplayAction } from "../src/engine/autoplay";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import {
  autoplayActionLabel,
  autoplayActionPulseTile,
  autoplayActionToGameAction,
  AUTOPLAY_COMMIT_DELAY_MS,
  canRunAutoplayAtTick,
  presentThenScheduleAutoplayAction,
} from "../src/ui/autoplayPresentation";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";

test("Given autoplay presentation state When mapping actions Then hint, pulse, pacing, dispatch, and hash isolation stay outside GameState", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;

  assert.equal(autoplayActionLabel(action), "다음: 우물 건설");
  assert.deepEqual(autoplayActionPulseTile(action), { tx: 5, ty: 4 });
  assert.deepEqual(autoplayActionToGameAction(action), { type: "place_building", kind: "well", tx: 5, ty: 4 });
  assert.equal(canRunAutoplayAtTick({ enabled: false, currentTick: 240, lastActionTick: 0 }), false);
  assert.equal(canRunAutoplayAtTick({ enabled: true, currentTick: 119, lastActionTick: 0 }), false);
  assert.equal(canRunAutoplayAtTick({ enabled: true, currentTick: 120, lastActionTick: 0 }), true);
  assert.equal(AUTOPLAY_COMMIT_DELAY_MS > 16, true);
  assert.equal(AUTOPLAY_COMMIT_DELAY_MS < 600, true);
  assert.equal(Object.hasOwn(DEFAULT_GAME_STATE, "autoplayEnabled"), false);
  assert.equal(Object.hasOwn(DEFAULT_GAME_STATE, "autoplayNextAction"), false);
  assert.equal(hashEconomyState(DEFAULT_GAME_STATE), hashEconomyState(DEFAULT_GAME_STATE));
});

test("Given an autoplay action When it is presented Then pulse publication precedes a delayed commit", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;
  const order: string[] = [];
  const pendingCommit: { current: (() => void) | null } = { current: null };
  let cancelled = false;

  const cancel = presentThenScheduleAutoplayAction({
    action,
    state: DEFAULT_GAME_STATE,
    publishPulse: () => { order.push("pulse"); },
    schedule: (commit, delayMs) => {
      order.push(`delay:${delayMs}`);
      pendingCommit.current = commit;
      return () => { cancelled = true; };
    },
    dispatch: () => { order.push("dispatch"); },
  });

  assert.notEqual(cancel, null);
  assert.deepEqual(order, ["pulse", `delay:${AUTOPLAY_COMMIT_DELAY_MS}`]);
  assert.notEqual(pendingCommit.current, null);
  pendingCommit.current?.();
  assert.deepEqual(order, ["pulse", `delay:${AUTOPLAY_COMMIT_DELAY_MS}`, "dispatch"]);
  cancel?.();
  assert.equal(cancelled, true);
});

test("Given a pending autoplay commit When automation is disabled Then cancellation prevents the dispatch", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;
  const order: string[] = [];
  const pendingCommit: { current: (() => void) | null } = { current: null };

  const cancel = presentThenScheduleAutoplayAction({
    action,
    state: DEFAULT_GAME_STATE,
    publishPulse: () => { order.push("pulse"); },
    schedule: (commit) => {
      let active = true;
      pendingCommit.current = () => { if (active) commit(); };
      return () => { active = false; };
    },
    dispatch: () => { order.push("dispatch"); },
  });

  cancel?.();
  pendingCommit.current?.();
  assert.deepEqual(order, ["pulse"]);
});
