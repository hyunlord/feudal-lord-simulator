/**
 * GROW-BLOCK GB-1·GB-3 (the user's ruling 2026-10-09): a failed charter wall search is kept with its reason and tried
 * again — a season on, the gap doubled at each failure in a row (at most eight seasons) — and the town's palisade plan
 * is read (where it stands, each condition's project, why the wall was not found). Lord mode only.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CHARTER_RING, ERA_REQUIREMENT_PROJECT } from "../src/content/charterRingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { charterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { charterRetryTick } from "../src/engine/townAgency";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";

const lordGame = (): GameState => { let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!; for (let tick = 0; tick < 10; tick += 1) state = advanceTick(state); return state; };

test("GB-1: a failed search is tried again a season on, the gap doubled at each failure in a row, at most eight seasons", () => {
  const season = CHARTER_RING.retryTicks;
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(attempts => charterRetryTick({ tick: 10_000, attempts }) - 10_000), [season, 2 * season, 4 * season, 8 * season, 8 * season, 8 * season]);
});

test("GB-3: the palisade plan says where the charter stands — each condition with its project; failed, why, the homes cut off and when it tries again", () => {
  const state = lordGame();
  const plan = charterWallPlan(state)!;
  assert.equal(plan.stage, "waiting");
  for (const requirement of plan.requirements) assert.equal(requirement.project, ERA_REQUIREMENT_PROJECT[requirement.key]);
  assert.ok(plan.requirements.some(requirement => requirement.key === "population" && requirement.project === "house"));
  // Every condition met, nothing open, the last search failed on the homes' service space.
  const met = { ...state, constructionSites: [], agency: { ...state.agency!, charterWallFailure: { tick: 4_000, reason: "service_space" as const, homes: ["house-1"], attempts: 2 } } };
  const failed = charterWallPlan({ ...met, population: 600 } as GameState)!;
  assert.deepEqual(failed.failure, { tick: 4_000, reason: "service_space", homes: ["house-1"], attempts: 2, retryTick: 4_000 + 2 * CHARTER_RING.retryTicks });
  // Outside lord mode, nothing.
  const { agency: _agency, ...sandbox } = state;
  assert.equal(charterWallPlan(sandbox as GameState), null);
});
