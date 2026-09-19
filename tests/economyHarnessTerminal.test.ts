import assert from "node:assert/strict";
import test from "node:test";
import { createStage3EconomyHarnessScenario } from "../scripts/economyHarnessStage3Scenario";
import { trackStage3Run } from "../scripts/economyHarnessStage3Trace";
import { trackPhase9Run } from "../scripts/economyHarnessPhase9Trace";
import { settlementProgress } from "../src/engine/settlementProgress";
import type { GameState } from "../src/engine/engine.types";

test("terminal settlement traces stop without inventing time or completed goals", () => {
  const base = createStage3EconomyHarnessScenario({ seed: 42 });
  const terminal: GameState = { ...base, population: 0, houses: [], settlement: { ...settlementProgress(base), outcome: "abandoned" } };
  const stage3 = trackStage3Run(terminal);
  const phase9 = trackPhase9Run(terminal);
  assert.equal(stage3.finalState.tick, terminal.tick);
  assert.equal(phase9.finalState.tick, terminal.tick);
  assert.equal(stage3.proclamationTick, null);
  assert.equal(stage3.wallCompleteTick, null);
  assert.equal(phase9.proclamationTick, null);
  assert.equal(phase9.stoneWallCompleteTick, null);
});
