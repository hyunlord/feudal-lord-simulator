/**
 * FOOD-DIST (the user's ruling 2026-10-18, lord mode): a mill's cart takes its bread to the granary holding the least
 * bread, then the one serving the most houses, then the nearest — not always the nearest. The state: seed 1 (lord slice)
 * at the first tick of 1303, from the trunk 701518cd (DGX engine-FOOD-save1-701518c): two granaries, the one by the mills
 * holding 61 bread and the other none — its distributors stayed at home while houses went without bread (DGX
 * engine-FOOD-route-4e5057f).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { deliverCandidate } from "../src/agents/deliveryBuildingCandidates";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/food/seed1-1303.save.json.gz")))).envelope.state as GameState;
const granaries = (state: GameState) => state.buildings.filter(building => building.kind === "granary");
const breadIn = (state: GameState) => granaries(state).map(granary => granary.inventory.bread ?? 0);

test("FOOD-DIST: in lord mode the mill's bread goes to the empty granary; without the spread (the trunk's order) to the nearest, which already holds it", () => {
  assert.deepEqual(breadIn(town).map(amount => amount > 0), [true, false], "one granary holds the bread");
  const mill = town.buildings.find(building => building.kind === "mill" && (building.inventory.bread ?? 0) > 0)!;
  const routes = createSimulationRoutePorts(town).delivery;
  assert.ok(routes.breadSpread !== undefined, "lord mode has the spread");
  const spread = deliverCandidate(mill, "bread", town.buildings, createDeliveryInventoryPort(), routes);
  const { breadSpread: _spread, ...trunkRoutes } = routes;
  const nearest = deliverCandidate(mill, "bread", town.buildings, createDeliveryInventoryPort(), trunkRoutes);
  assert.equal(nearest?.building.id, granaries(town).find(granary => (granary.inventory.bread ?? 0) > 0)!.id);
  assert.equal(spread?.building.id, granaries(town).find(granary => (granary.inventory.bread ?? 0) === 0)!.id);
});

test("FOOD-DIST: a season on, the bread lies in both granaries", () => {
  let state = town;
  let both = false;
  for (let tick = 0; tick < 1_000 && !both; tick += 1) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    both = breadIn(state).filter(amount => amount > 0).length >= 2;
  }
  assert.ok(both, `bread by granary at ${state.tick}: ${breadIn(state).join(", ")}`);
});
