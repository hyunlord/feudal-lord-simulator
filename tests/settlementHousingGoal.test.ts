import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { settlementMetrics } from "../src/engine/settlementMetrics";
import { updateSettlementProgress } from "../src/engine/settlementProgress";
import { getSettlementView } from "../src/engine/settlementView";
import type { GameState } from "../src/engine/engine.types";
import type { Building } from "../src/content/buildingConfig";

function ready(lots: number): GameState {
  const buildings: Building[] = Array.from({ length: lots }, (_, index) => ({ id: `h${index}`, kind: "house", tx: index, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }));
  return { ...DEFAULT_GAME_STATE, tick: 100, era: "stone_town", population: 140, buildings,
    houses: buildings.map(building => ({ buildingId: building.id, level: 4, builtLevel: 4, residents: 32, hasWater: true, breadStock: 8, lastServicedTick: 100, unmetRequirementTicks: 0 })),
    palisade: { id: "wall", polygon: [], gate: { x: 0, y: 0 }, segments: [{ id: "stone", order: 0, edgePath: [{ x: 0, y: 0 }, { x: 3, y: 0 }], tileCount: 3, completed: true, constructionSiteId: null, material: "stone" }] },
    settlement: { lastUpdatedTick: 99, selfSufficientTicks: 600, prosperityTicks: 0, foodShortageTicks: 0, emptyTicks: 0, hadResidents: true, milestones: { selfSufficient: 50, palisade: 90, prosperity: null }, outcome: "ongoing" },
  };
}
function observe(input: GameState, count: number): GameState {
  let state = input;
  for (let index = 0; index < count; index++) state = updateSettlementProgress({ ...state, tick: input.tick + index });
  return state;
}
test("prosperity requires four occupied L4 lots for the full 1200-tick hold", () => {
  assert.equal(observe(ready(3), 1500).settlement?.prosperityTicks, 0);
  const almost = observe(ready(4), 1199);
  assert.equal(almost.settlement?.outcome, "ongoing");
  const victory = updateSettlementProgress({ ...almost, tick: almost.tick + 1 });
  assert.equal(victory.settlement?.outcome, "victory");
});
test("merged homes count two lots, but vacant and declined L4 buildings do not count", () => {
  const state = ready(2);
  const merged = { ...state, buildings: state.buildings.map(building => ({ ...building, houseLot: "horizontal" as const })) };
  assert.equal(settlementMetrics(merged).occupiedL4Lots, 4);
  assert.equal(settlementMetrics({ ...state, buildings: state.buildings.map(building => ({ ...building, houseLot: "vertical" as const })) }).occupiedL4Lots, 4);
  assert.equal(observe(merged, 1200).settlement?.outcome, "victory");
  assert.equal(settlementMetrics({ ...merged, houses: merged.houses.map(house => ({ ...house, residents: 0 })) }).occupiedL4Lots, 0);
  assert.equal(settlementMetrics({ ...merged, houses: merged.houses.map(house => ({ ...house, level: 3 as const })) }).occupiedL4Lots, 0);
  assert.equal(settlementMetrics({ ...merged, buildings: [] }).occupiedL4Lots, 0);
});
test("L4 loss resets the hold; already-earned victory survives new goal and service loss", () => {
  const almost = observe(ready(4), 1199);
  const loss = updateSettlementProgress({ ...almost, tick: almost.tick + 1, houses: almost.houses.map((house, index) => index === 0 ? { ...house, level: 3 } : house) });
  assert.equal(loss.settlement?.prosperityTicks, 0);
  assert.equal(loss.settlement?.outcome, "ongoing");
  const won = observe(ready(4), 1200);
  assert.equal(updateSettlementProgress({ ...won, tick: won.tick + 1, population: 0, houses: [], buildings: [] }).settlement?.outcome, "victory");
});
test("shared goal presentation explains the live four-lot requirement", () => {
  const view = getSettlementView(ready(3));
  assert.deepEqual(view.currentGoal?.criteria.find(criterion => criterion.id === "occupiedL4Lots"), { id: "occupiedL4Lots", label: "입주한 L4 주거 (필지)", current: 3, target: 4, met: false });
});
