// Generic return-capacity ownership on a sawmill (8-unit cart, storage 20). Since LB-7 (C3) mills fetch with a 12-unit
// intake cart into 32 of storage (tests/labourHousehold.test.ts, deliveryMillReplenishment).
import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters, stepCarters } from "../src/agents/delivery";
import { cancelCarter, completeReturn, canCompleteReturn, returnCapacityClaim } from "../src/agents/deliveryReturn";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

const routes = routePort({ "m->g": line([0, 0], [1, 0]), "1,0->m": line([1, 0], [0, 0]) });
function loaded() {
  // Peer reservations are explicit API fixture state; the peer carrier is outside this focused step.
  const spawned = spawnCarters({ tick: 0, buildings: [
    building("m", "sawmill", { reserved: { logs: 2 } }),
    building("g", "storehouse", { inventory: { logs: 8 }, stockReserved: { logs: 3 } }),
  ], walkers: [], inventory: DELIVERY_INVENTORY, routes });
  const state = stepCarters({ ...spawned, tick: 1, inventory: DELIVERY_INVENTORY, routes,
    walkers: spawned.walkers.map(w => ({ ...w, position: { tx: 1, ty: 0 }, pathIndex: 1 })) });
  const walker = state.walkers.find(w => w.kind === "carter" && w.homeBuildingId === "m");
  assert.ok(walker?.kind === "carter");
  assert.deepEqual(walker.cargo, { resource: "logs", amount: 5 });
  return { state, walker, spawned };
}

test("ordinary loaded fetch cancellation must not reuse another carrier's home capacity", () => {
  const { state, walker } = loaded();
  assert.equal(state.buildings.find(b => b.id === "m")?.reserved.logs, 7);
  const cancelled = cancelCarter(2, state, walker, DELIVERY_INVENTORY, routes, "road_removed");
  assert.ok(cancelled.walker);
  assert.equal(cancelled.buildings.find(b => b.id === "m")?.reserved.logs, 7);
  const settled = completeReturn(cancelled, cancelled.walker, DELIVERY_INVENTORY);
  assert.equal(settled.buildings.find(b => b.id === "m")?.reserved.logs, 2);
});

for (const limit of [0, 2]) {
  test(`cancelled fetch reacquires only its own ${limit} capacity and repeated cancellation preserves it`, () => {
    const { state, walker } = loaded();
    const inventory = { ...DELIVERY_INVENTORY,
      reserveSpace: (home: Parameters<typeof DELIVERY_INVENTORY.reserveSpace>[0],
        resource: Parameters<typeof DELIVERY_INVENTORY.reserveSpace>[1], amount: number) =>
        DELIVERY_INVENTORY.reserveSpace(home, resource, Math.min(limit, amount)) };
    const cancelled = cancelCarter(2, state, walker, inventory, routes, "road_removed");
    assert.ok(cancelled.walker);
    const home = cancelled.buildings.find(b => b.id === "m");
    assert.ok(home);
    assert.equal(home.reserved.logs, 2 + limit);
    assert.equal(returnCapacityClaim(cancelled.walker, home)?.amount ?? 0, limit);
    const repeated = cancelCarter(3, cancelled, cancelled.walker, inventory, routes, "road_removed");
    assert.deepEqual(repeated.buildings, cancelled.buildings);
    assert.equal(repeated.walker?.reservation.homeCapacityClaim?.amount ?? 0, limit);
    const blocked = cancelled.buildings.map(b => b.id === "m"
      ? { ...b, inventory: { timber: 20 - (b.reserved.logs ?? 0) } } : b);
    assert.equal(canCompleteReturn(blocked, cancelled.walker, inventory), false);
    assert.equal(canCompleteReturn(cancelled.buildings, cancelled.walker, inventory), true);
    const settled = completeReturn(cancelled, cancelled.walker, inventory);
    assert.equal(settled.buildings.find(b => b.id === "m")?.reserved.logs, 2);
    assert.equal(settled.buildings.find(b => b.id === "m")?.inventory.logs, 5);
  });
}

test("cancelled outbound empty fetch cannot settle a peer home claim twice", () => {
  const { spawned } = loaded();
  const empty = spawned.walkers.find(w => w.kind === "carter" && w.homeBuildingId === "m");
  assert.ok(empty?.kind === "carter");
  const cancelled = cancelCarter(2, spawned, empty, DELIVERY_INVENTORY, routes, "manual");
  assert.ok(cancelled.walker);
  const settled = completeReturn(cancelled, cancelled.walker, DELIVERY_INVENTORY);
  assert.equal(settled.buildings.find(b => b.id === "m")?.reserved.logs, 2);
});

test("missing home leaves loaded cargo without claiming unrelated capacity", () => {
  const { state, walker } = loaded();
  const withoutHome = { ...state, buildings: state.buildings.filter(b => b.id !== "m") };
  const cancelled = cancelCarter(2, withoutHome, walker, DELIVERY_INVENTORY, routePort({}), "road_removed");
  assert.ok(cancelled.walker);
  assert.equal(cancelled.walker.cargo?.amount, 5);
  assert.equal(canCompleteReturn(cancelled.buildings, cancelled.walker, DELIVERY_INVENTORY), false);
  assert.deepEqual(cancelled.buildings, withoutHome.buildings);
  assert.equal(cancelled.walker?.reservation.homeCapacityClaim, null);
});

test("explicit deliver return capacity survives cancellation ahead of the implicit fetch guard", () => {
  const { state, walker } = loaded();
  const delivery = { ...walker, mission: "deliver" as const,
    reservation: { ...walker.reservation, destination: { kind: "building" as const, buildingId: "g" },
      homeCapacityClaim: { buildingId: "m", resource: "logs" as const, amount: 5 } } };
  const cancelled = cancelCarter(2, state, delivery, DELIVERY_INVENTORY, routes, "road_removed");
  assert.ok(cancelled.walker);
  assert.deepEqual(cancelled.buildings, state.buildings);
  assert.equal(cancelled.walker.reservation.homeCapacityClaim?.amount, 5);
  assert.equal(completeReturn(cancelled, cancelled.walker, DELIVERY_INVENTORY)
    .buildings.find(b => b.id === "m")?.reserved.logs, 2);
});

test("ordinary noncancelled fetch still owns its original implicit home capacity", () => {
  const { state, walker } = loaded();
  const home = state.buildings.find(b => b.id === "m");
  assert.ok(home);
  assert.equal(returnCapacityClaim(walker, home)?.amount, 5);
  assert.equal(completeReturn(state, walker, DELIVERY_INVENTORY)
    .buildings.find(b => b.id === "m")?.reserved.logs, 2);
});
