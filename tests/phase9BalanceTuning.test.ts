import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhase9BalanceLedger,
  guardPhase9TuningChanges,
  PHASE9_BALANCE_TARGET_TICK,
} from "../scripts/phase9BalanceTuning";

test("Phase 9 tuning ledger records iteration zero and the transparent final miss", () => {
  const ledger = buildPhase9BalanceLedger();

  assert.equal(ledger.targetTick, PHASE9_BALANCE_TARGET_TICK);
  assert.equal(ledger.iterations.length, 1);
  assert.deepEqual(ledger.appliedChanges, []);
  assert.notEqual(ledger.finalMissTicks, null);
});

test("Phase 9 tuning guard rejects old constants and a fourth change", () => {
  assert.throws(
    () => guardPhase9TuningChanges([{
      iteration: 1,
      path: "src/content/balanceConfig.ts",
      constant: "STARTING_TIMBER",
      before: 205,
      after: 300,
      reason: "invalid old baseline edit",
    }]),
    /pre-Phase-9 tuning is not allowed/,
  );
  assert.throws(
    () => guardPhase9TuningChanges(Array.from({ length: 4 }, (_, index) => ({
      iteration: index + 1,
      path: "src/engine/era.ts",
      constant: "STONE_TOWN_POPULATION",
      before: 140,
      after: 139 - index,
      reason: "too many changes",
    }))),
    /stops after three changes/,
  );
});
