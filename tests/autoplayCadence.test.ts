import assert from "node:assert/strict";
import test from "node:test";

import type { AutoplayAction } from "../src/engine/autoplay";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import {
  AUTOPLAY_TICK_CADENCE,
  canRunAutoplayAtTick,
  presentThenScheduleAutoplayAction,
} from "../src/ui/autoplayPresentation";

const ACTION = {
  kind: "place_building",
  building: "well",
  tx: 5,
  ty: 4,
} satisfies AutoplayAction;

function createCadenceHarness() {
  let latestTick = 0;
  let lastCommitTick = -AUTOPLAY_TICK_CADENCE;
  let pendingCancel: (() => void) | null = null;
  let scheduledCommit: (() => void) | null = null;
  const pulseTicks: number[] = [];
  const commitTicks: number[] = [];

  return {
    pulseTicks,
    commitTicks,
    attemptAt(tick: number): void {
      latestTick = tick;
      if (!canRunAutoplayAtTick({
        enabled: true,
        currentTick: latestTick,
        lastActionTick: lastCommitTick,
        pending: pendingCancel !== null,
      })) return;

      const cancel = presentThenScheduleAutoplayAction({
        action: ACTION,
        state: DEFAULT_GAME_STATE,
        publishPulse: () => { pulseTicks.push(latestTick); },
        schedule: (commit) => {
          let active = true;
          scheduledCommit = () => { if (active) commit(); };
          return () => {
            active = false;
            scheduledCommit = null;
          };
        },
        beforeDispatch: () => {
          lastCommitTick = latestTick;
          pendingCancel = null;
        },
        dispatch: () => { commitTicks.push(latestTick); },
      });
      if (cancel !== null) pendingCancel = cancel;
    },
    commitAt(tick: number): void {
      latestTick = tick;
      const commit = scheduledCommit;
      scheduledCommit = null;
      commit?.();
    },
  };
}

test("Given a delayed autoplay commit When state ticks rerender Then pending blocks a duplicate pulse", () => {
  // Given
  const harness = createCadenceHarness();

  // When
  harness.attemptAt(120);
  harness.attemptAt(239);

  // Then
  assert.deepEqual(harness.pulseTicks, [120]);
});

test("Given variable presentation delays When autoplay commits Then cadence anchors to each actual commit tick", () => {
  // Given
  const harness = createCadenceHarness();

  // When
  harness.attemptAt(120);
  harness.commitAt(126);
  harness.attemptAt(245);
  harness.commitAt(245);
  harness.attemptAt(246);
  harness.commitAt(275);
  harness.attemptAt(394);
  harness.commitAt(394);
  harness.attemptAt(395);
  harness.commitAt(1_065);
  harness.attemptAt(1_184);
  harness.commitAt(1_184);
  harness.attemptAt(1_185);
  harness.commitAt(1_185);

  // Then
  assert.deepEqual(harness.commitTicks, [126, 275, 1_065, 1_185]);
  assert.equal(
    harness.commitTicks.slice(1).every(
      (tick, index) => tick - (harness.commitTicks[index] ?? tick) >= AUTOPLAY_TICK_CADENCE,
    ),
    true,
  );
});
