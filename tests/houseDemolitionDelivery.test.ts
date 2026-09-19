import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters, stepCarters } from "../src/agents/delivery";
import { placeBuilding } from "../src/engine/gameActions";
import { demolishHouse } from "../src/engine/houseDemolition";
import { cancelConstruction } from "../src/engine/constructionCancellation";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

function dispatchedTreasuryCart() {
  const state = placeBuilding(DEFAULT_GAME_STATE, "well", { tx: 45, ty: 38 });
  assert.equal(state.constructionSites.length, 1);
  const delivery = spawnCarters({
    ...state, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(state).delivery,
  });
  const carter = delivery.walkers.find((walker) => walker.kind === "carter" && walker.reservation.sourceStockClaim?.kind === "treasury");
  assert.ok(carter?.kind === "carter");
  return {
    state: { ...state, buildings: [...delivery.buildings], constructionSites: [...delivery.constructionSites], walkers: [...delivery.walkers], treasuryTimber: delivery.treasuryTimber },
    carter,
  };
}

test("demolishing a treasury cart home releases site reservation and recovers cargo next step", () => {
  const { state, carter } = dispatchedTreasuryCart();
  const after = demolishHouse(state, carter.homeBuildingId);
  const returning = after.walkers.find((walker) => walker.id === carter.id);
  assert.ok(returning?.kind === "carter");
  assert.equal(returning.cancellation?.reason, "source_unavailable");
  assert.equal(after.constructionSites[0]?.reserved.timber ?? 0, 0);
  const settled = stepCarters({ ...after, tick: 1, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(after).delivery });
  assert.ok(settled.walkers.every((walker) => walker.id !== carter.id));
  assert.equal(settled.treasuryTimber, DEFAULT_GAME_STATE.treasuryTimber);
  assert.equal(settled.constructionSites[0]?.delivered.timber ?? 0, 0);
});

test("site cancellation after its treasury cart home demolition refunds cargo exactly once", () => {
  const { state, carter } = dispatchedTreasuryCart();
  const demolished = demolishHouse(state, carter.homeBuildingId);
  const site = demolished.constructionSites[0];
  assert.ok(site);
  const after = cancelConstruction({ state: demolished, siteId: site.id, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(demolished).delivery }).state;
  const settled = stepCarters({ ...after, tick: 1, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(after).delivery });
  assert.equal(settled.treasuryTimber, DEFAULT_GAME_STATE.treasuryTimber);
  assert.equal(settled.constructionSites.length, 0);
  assert.equal(settled.walkers.length, 0);
});

test("demolishing a delivered cart home does not release another cart's site reservation", () => {
  const dispatched = dispatchedTreasuryCart();
  let state = dispatched.state;
  for (let tick = 1; tick <= 300; tick += 1) {
    const step = stepCarters({ ...state, tick, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(state).delivery });
    state = { ...state, tick, buildings: [...step.buildings], constructionSites: [...step.constructionSites], walkers: [...step.walkers], treasuryTimber: step.treasuryTimber };
    if (state.walkers.some((walker) => walker.id === dispatched.carter.id && walker.kind === "carter" && walker.phase === "returning")) break;
  }
  const delivered = state.walkers.find((walker) => walker.id === dispatched.carter.id);
  assert.ok(delivered?.kind === "carter" && delivered.phase === "returning" && delivered.cargo === null);
  const second = spawnCarters({ ...state, inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(state).delivery });
  const before = { ...state, buildings: [...second.buildings], constructionSites: [...second.constructionSites], walkers: [...second.walkers], treasuryTimber: second.treasuryTimber };
  assert.ok((before.constructionSites[0]?.reserved.timber ?? 0) > 0);
  const after = demolishHouse(before, delivered.homeBuildingId);
  assert.deepEqual(after.constructionSites[0]?.reserved, before.constructionSites[0]?.reserved);
  assert.deepEqual(after.constructionSites[0]?.delivered, before.constructionSites[0]?.delivered);
});
