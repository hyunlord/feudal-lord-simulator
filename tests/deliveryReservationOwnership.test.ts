// Generic fetch-reservation ownership. The converters are sawmills (one 8-unit cart each): since LB-7 (C3) a mill
// fetches wheat with its own 12-unit intake cart, covered in tests/labourHousehold.test.ts and deliveryMillReplenishment.
import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters, stepCarters } from "../src/agents/delivery";
import { cancelCarter, completeReturn } from "../src/agents/deliveryReturn";
import type { CarterWalker } from "../src/agents/walker.types";
import type { DeliveryStepResult } from "../src/agents/deliveryTypes";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

const routes = routePort({
  "a->g": line([0, 0], [1, 0]), "b->g": line([0, 1], [1, 0]),
  "1,0->a": line([1, 0], [0, 0]), "1,0->b": line([1, 0], [0, 1]),
  "0,0->a": line([0, 0]), "0,1->b": line([0, 1]),
});
function fixture(): DeliveryStepResult {
  return spawnCarters({ tick: 0,
    buildings: [building("a", "sawmill"), building("b", "sawmill"),
      building("g", "storehouse", { inventory: { logs: 16 } })],
    walkers: [], inventory: DELIVERY_INVENTORY, routes });
}
function carter(state: DeliveryStepResult, home: string): CarterWalker {
  const found = state.walkers.find(w => w.kind === "carter" && w.homeBuildingId === home);
  assert.ok(found?.kind === "carter");
  return found;
}
function stock(state: DeliveryStepResult) {
  const found = state.buildings.find(b => b.id === "g");
  assert.ok(found);
  return found;
}
function pickup(state: DeliveryStepResult, home: string): DeliveryStepResult {
  return stepCarters({ ...state, tick: 1, inventory: DELIVERY_INVENTORY, routes,
    walkers: state.walkers.map(w => w.homeBuildingId === home ? {
      ...w, position: w.path.at(-1) ?? w.position, pathIndex: w.path.length - 1,
    } : w) });
}
function cancel(state: DeliveryStepResult, home: string, missingRoute = false): DeliveryStepResult {
  const current = carter(state, home);
  const result = cancelCarter(2, {
    buildings: state.buildings, constructionSites: state.constructionSites, treasuryTimber: state.treasuryTimber,
  }, current, DELIVERY_INVENTORY, missingRoute ? routePort({}) : routes, "road_removed");
  return { ...result, walkers: state.walkers.flatMap(w => w.id === current.id
    ? result.walker === null ? [] : [result.walker] : [w]) };
}

test("two fetchers each collect their reserved stock without consuming their peer claim", () => {
  const initial = fixture();
  assert.equal(stock(initial).stockReserved.logs, 16);
  const first = pickup(initial, "a");
  assert.equal(stock(first).inventory.logs, 8);
  assert.equal(stock(first).stockReserved.logs, 8);
  assert.equal(carter(first, "a").cargo?.amount, 8);
  const second = pickup(first, "b");
  assert.equal(stock(second).inventory.logs ?? 0, 0);
  assert.equal(stock(second).stockReserved.logs ?? 0, 0);
  assert.equal(carter(second, "b").cargo?.amount, 8);
  assert.equal(second.walkers.reduce((n, w) => n + (w.cargo?.amount ?? 0), 0), 16);
});

for (const available of [0, 5]) {
  test(`pickup with ${available} physical stock settles only its own eight-unit claim`, () => {
    const initial = fixture();
    const limited = { ...initial, buildings: initial.buildings.map(b => b.id === "g"
      ? { ...b, inventory: { logs: available } } : b) };
    const picked = pickup(limited, "a");
    assert.equal(stock(picked).stockReserved.logs, 8);
    assert.equal(stock(picked).inventory.logs ?? 0, 0);
    assert.equal(carter(picked, "a").cargo?.amount ?? 0, available);
    const cancelled = cancel(picked, "a");
    assert.equal(stock(cancelled).stockReserved.logs, 8);
    const home = cancelled.buildings.find(b => b.id === "a");
    assert.equal(home?.reserved.logs ?? 0, available);
    const returned = completeReturn(cancelled, carter(cancelled, "a"), DELIVERY_INVENTORY);
    assert.equal(returned.buildings.find(b => b.id === "a")?.reserved.logs ?? 0, 0);
    assert.equal(returned.buildings.find(b => b.id === "a")?.inventory.logs ?? 0, available);
  });
}

for (const missingRoute of [false, true]) {
  test(`outbound cancellation releases once with missing route ${missingRoute}`, () => {
    const first = cancel(fixture(), "a", missingRoute);
    assert.equal(stock(first).stockReserved.logs, 8);
    assert.equal(first.buildings.find(b => b.id === "a")?.reserved.logs ?? 0, 0);
    const again = cancel(first, "a", missingRoute);
    assert.equal(stock(again).stockReserved.logs, 8);
    assert.equal(stock(again).inventory.logs, 16);
  });
}

test("returning fetch cancellation preserves peer source stock and loaded cargo", () => {
  const first = pickup(fixture(), "a");
  const cancelled = cancel(first, "a", true);
  assert.equal(stock(cancelled).stockReserved.logs, 8);
  assert.equal(stock(cancelled).inventory.logs, 8);
  assert.equal(carter(cancelled, "a").cargo?.amount, 8);
  assert.deepEqual(carter(cancelled, "a").reservation.sourceStockClaim,
    carter(first, "a").reservation.sourceStockClaim);
});

test("loaded construction cancellation retains another fetch reservation and source provenance", () => {
  const initial = fixture();
  const fetcher = carter(initial, "a");
  const loaded: CarterWalker = { ...fetcher, mission: "deliver", homeBuildingId: "g",
    cargo: { resource: "logs", amount: 8 },
    reservation: { ...fetcher.reservation, destination: { kind: "construction_site", siteId: "site" } } };
  const state = { ...initial, buildings: initial.buildings.map(b => b.id === "g"
    ? { ...b, inventory: { logs: 8 }, stockReserved: { logs: 8 } } : b), walkers: [loaded] };
  const result = cancelCarter(2, state, loaded, DELIVERY_INVENTORY, routePort({}), "manual");
  assert.equal(result.buildings.find(b => b.id === "g")?.stockReserved.logs, 8);
  assert.equal(result.walker?.cargo?.amount, 8);
  assert.deepEqual(result.walker?.reservation.sourceStockClaim, loaded.reservation.sourceStockClaim);
});

test("treasury cargo provenance still repays treasury after cancellation", () => {
  const initial = fixture();
  const treasury: CarterWalker = { ...carter(initial, "a"), mission: "deliver",
    cargo: { resource: "timber", amount: 8 }, reservation: {
      destination: { kind: "construction_site", siteId: "site" }, resource: "timber", amount: 8,
      sourceStockClaim: { kind: "treasury", resource: "timber", amount: 8 }, homeCapacityClaim: null } };
  const result = cancelCarter(2, { ...initial, treasuryTimber: 10 }, treasury,
    DELIVERY_INVENTORY, routePort({}), "manual");
  assert.ok(result.walker);
  const returned = completeReturn(result, result.walker, DELIVERY_INVENTORY);
  assert.equal(returned.treasuryTimber, 18);
  assert.equal(returned.buildings.find(b => b.id === "g")?.stockReserved.logs, 16);
});

test("returning empty delivery cancellation preserves live destination peers", () => {
  const initial = fixture();
  const completed: CarterWalker = { ...carter(initial, "a"), mission: "deliver", phase: "returning",
    cargo: null, reservation: { destination: { kind: "building", buildingId: "g" },
      resource: "logs", amount: 2, sourceStockClaim: null, homeCapacityClaim: null } };
  const state = { ...initial, buildings: initial.buildings.map(b => b.id === "g"
    ? { ...b, reserved: { logs: 8 } } : b) };
  const result = cancelCarter(2, state, completed, DELIVERY_INVENTORY, routePort({}), "road_removed");
  assert.equal(result.buildings.find(b => b.id === "g")?.reserved.logs, 8);
  assert.equal(result.walker?.cargo, null);
});
