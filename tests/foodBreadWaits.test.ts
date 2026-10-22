/**
 * FOOD-P (the user's ruling 2026-10-22, lord mode, F1's shape): a measured bread shortage asks for a mill past the food
 * step's waits — another food site still building, the last addition's observation. The state: seed 1 (lord slice) at
 * the first tick of 1304, from the trunk 349da108 (DGX engine-FOODP-save1-349da10) — a granary building, an observation
 * open, two mills, the measured decision "mill: actual_bread_deficit", 25 timber against the mill's 30.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { autoplayBuildAction, decideNextAction } from "../src/engine/autoplay";
import { foodAction, hasPendingFoodChain } from "../src/engine/autoplayFood";
import type { FoodDiagnosticCollector } from "../src/engine/autoplayFoodDiagnostic";
import { foodFlowOver } from "../src/engine/autoplayFoodEfficiency";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import { hasActiveFoodObservation } from "../src/engine/autoplayFoodThroughput";
import type { GameState } from "../src/engine/engine.types";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/food/seed1-1304.save.json.gz")))).envelope.state as GameState;
const step = (state: GameState) => {
  const collector: FoodDiagnosticCollector = {};
  const action = decideNextAction(state, LORD_MODE_POLICY, collector);
  return { action, reason: collector.food?.reason };
};
// The food step alone (the planner may stop at an earlier step on an edited state).
const foodStep = (state: GameState) => {
  const collector: FoodDiagnosticCollector = {};
  foodAction(state, (current, kind) => autoplayBuildAction(current, kind), collector);
  return collector.food?.reason;
};
// The town's timber up to the mill's cost, in its first storehouse.
const withTimber = (state: GameState): GameState => {
  const store = state.buildings.find(building => building.kind === "storehouse")!;
  return { ...state, buildings: state.buildings.map(building => building.id === store.id
    ? { ...building, inventory: { ...building.inventory, timber: (building.inventory.timber ?? 0) + 20 } } : building) };
};

test("FOOD-P: the save stands where seed 1 waited — a food site building, an observation open, the measured decision a mill", () => {
  assert.equal(hasPendingFoodChain(town), true);
  assert.equal(hasActiveFoodObservation(town), true);
  assert.deepEqual(measuredFoodDecision(town), { kind: "mill", reason: "actual_bread_deficit" });
  assert.equal(town.buildings.filter(building => building.kind === "mill").length, 2);
});

test("FOOD-P: in lord mode the mill passes both waits; with the timber for it the step places a mill", () => {
  assert.notEqual(step(town).reason, "pending_chain");
  assert.notEqual(step(town).reason, "active_observation");
  const placed = step(withTimber(town)).action;
  assert.equal(placed.kind === "place_building" ? placed.building : JSON.stringify(placed), "mill");
});

test("FOOD-P: the sandbox still waits, and a mill already building still waits", () => {
  const { agency: _agency, ...sandbox } = withTimber(town);
  assert.equal(foodStep(sandbox as GameState), "pending_chain");
  const granary = town.constructionSites.find(site => site.kind === "granary")!;
  const millBuilding = withTimber({ ...town, constructionSites: town.constructionSites.map(site => site.id === granary.id ? { ...site, kind: "mill" } as typeof site : site) });
  assert.equal(foodStep(millBuilding), "pending_chain");
  assert.notEqual(foodStep(withTimber(town)), "pending_chain", "the same town with a granary building passes");
});

test("FOOD-P2: only while the last season's bread fell short of the homes' asks — with it made, the mill waits", () => {
  const season = foodFlowOver(town, 1_000);
  assert.equal(season.fullWindow, true);
  assert.ok(season.breadProduced < season.requestedBread, `${season.breadProduced} made, ${season.requestedBread} asked`);
  // The same town, its last season's bread raised to what the homes asked (the flow's running total only).
  const flow = town.autoplayFoodFlow!;
  const rolling = flow.rolling!;
  const enough = withTimber({ ...town, autoplayFoodFlow: { ...flow, rolling: { ...rolling,
    totals: { ...rolling.totals, breadProduced: rolling.totals.breadProduced + season.requestedBread - season.breadProduced } } } });
  assert.ok(foodFlowOver(enough, 1_000).breadProduced >= foodFlowOver(enough, 1_000).requestedBread);
  assert.equal(foodStep(enough), "pending_chain");
});
