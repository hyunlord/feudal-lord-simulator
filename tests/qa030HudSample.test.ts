/**
 * QA-030 (docs/qa/round03-14, triage 2026-10-01): "식량 208일" before a save, 204 right after loading it. The engine's
 * round trip is exact (tests/qaRounds0314.test.ts QA030); the HUD was stale: its guidance sample keeps the first state
 * of each 60-tick bucket, and pausing never refreshed it. Replayed on the QA's own save with App's snapshot rule.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

import type { GameSpeed, GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { guidanceSampleKey } from "../src/ui/hud/guidanceSample";
import { foodDays } from "../src/ui/hud/statusPillModel";

const at = "2026-10-02T00:00:00.000Z";

/** App's guidance snapshot: a new key takes the state, the same key keeps the one before. */
function snapshotRule(key: (state: GameState, speed: GameSpeed) => unknown) {
  let snapshot: { sample: unknown; state: GameState } | null = null;
  return (state: GameState, speed: GameSpeed) => {
    const sample = key(state, speed);
    if (snapshot === null || snapshot.sample !== sample) snapshot = { sample, state };
    return snapshot.state;
  };
}

test("QA-030 paused, the HUD's food days are the state's own — the state the save captures (204 at t160783, not t160740's 208)", () => {
  const raw = gunzipSync(readFileSync("docs/qa/round03-14/repro/saves/natural1340-ch3-reload-repro.json.gz"));
  let state = decodeSave(new Uint8Array(raw)).envelope.state as GameState;
  const fixed = snapshotRule(guidanceSampleKey);
  const before = snapshotRule(current => Math.floor(current.tick / 60));
  // Run at 1× from t160700 to the QA's t160783, the HUD sampling every tick it is shown.
  while (state.tick < 160_783) { state = advanceTick(state); fixed(state, 1); before(state, 1); }
  // The QA pressed pause there and saved.
  assert.equal(before(state, 0).tick, 160_740, "the bug: the paused HUD read the bucket's first state");
  assert.equal(foodDays(before(state, 0)), 208);
  assert.equal(fixed(state, 0), state, "fixed: paused, the HUD reads the state itself");
  assert.equal(foodDays(fixed(state, 0)), 204);
  // The save holds that state and the load gives it back (the load remounts App: a fresh snapshot of the loaded state).
  const loaded = decodeSave(encodeSave({ state, createdAt: at, savedAt: at }).bytes).envelope.state as GameState;
  assert.equal(foodDays(snapshotRule(guidanceSampleKey)(loaded, 0)), foodDays(fixed(state, 0)));
});

test("QA-030 running, the sample keeps its cadence (one state per 60 ticks); paused, only a new state refreshes it", () => {
  const state = { tick: 160_783 } as GameState;
  assert.equal(guidanceSampleKey(state, 1), 2679);
  assert.equal(guidanceSampleKey({ ...state, tick: 160_799 }, 5), 2679);
  assert.equal(guidanceSampleKey({ ...state, tick: 160_800 }, 3), 2680);
  assert.equal(guidanceSampleKey(state, 0), state);
  const rule = snapshotRule(guidanceSampleKey);
  assert.equal(rule(state, 0), state);
  assert.equal(rule(state, 0), state, "the same paused state: no new snapshot");
  const command = { ...state };
  assert.equal(rule(command, 0), command, "a command while paused: the HUD follows it");
});
