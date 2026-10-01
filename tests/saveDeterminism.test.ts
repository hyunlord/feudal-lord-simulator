import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { canonicalStateHash, verifySaveDeterminism } from "../scripts/verifySaveDeterminism";

// The full gate (seed 1..5 final states + new game at 10,000 ticks, N=24,000) runs with
// `npm run verify:save-determinism`; this is the same pipeline at CI size.
test("save → fresh-process load → N ticks equals N ticks without saving (CI size)", async () => {
  const report = await verifySaveDeterminism(["--ticks", "1200", "--newgame-ticks", "600", "--cases", "seed1,newgame", "--seed-dir", "fixtures/determinism"]);
  assert.equal(report.gateMatches, 2);
  assert.equal(report.passed, true);
  for (const row of report.rows) {
    // An autosave every 60 s at 1× (FIX-13: ten ticks a second, so two in 1,200 ticks).
    assert.equal(row.autosaves, Math.floor(1200 / (60 * BALANCE.TICKS_PER_SECOND)));
    assert.equal(row.autosaveRoundTripMismatches, 0);
  }
});

test("the determinism hash notices a one-unit difference that grows over ticks", () => {
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  for (let index = 0; index < 20; index += 1) state = advanceTick(state);
  const reloaded = decodeSave(encodeSave({ state, createdAt: "x", savedAt: "x" }).bytes).envelope.state;
  assert.equal(canonicalStateHash(reloaded), canonicalStateHash(state));
  const perturbed = { ...reloaded, treasuryTimber: reloaded.treasuryTimber + 1 };
  let left = state;
  let right: GameState = perturbed;
  for (let index = 0; index < 100; index += 1) { left = advanceTick(left); right = advanceTick(right); }
  assert.notEqual(canonicalStateHash(left), canonicalStateHash(right));
  assert.equal(canonicalStateHash({ b: 1, a: [1, { d: 2, c: 3 }] }), canonicalStateHash({ a: [1, { c: 3, d: 2 }], b: 1 }));
});
