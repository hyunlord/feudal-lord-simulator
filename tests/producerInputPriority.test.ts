import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters } from "../src/agents/delivery";
import type { ConstructionSite } from "../src/economy/construction";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

const site: ConstructionSite = {
  id: "wall", kind: "well", tx: 5, ty: 0, required: { timber: 10 },
  delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 200,
  assignedBuilders: 0, stall: "awaiting_materials", startedTick: 0,
};
const paths = {
  "mill->store": line([0, 0], [1, 0], [2, 0]),
  "mill->wall": line([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]),
  "store->wall": line([2, 0], [3, 0], [4, 0], [5, 0]),
};

for (const logs of [0, 1]) {
  test(`sawmill with ${logs} logs fetches production input before construction output`, () => {
    const result = spawnCarters({ tick: 20, buildings: [
      building("mill", "sawmill", { inventory: { logs, timber: 3 } }),
      building("store", "storehouse", { inventory: { logs: 100 } }),
    ], constructionSites: [site], walkers: [], treasuryTimber: 0,
      inventory: DELIVERY_INVENTORY, routes: routePort(paths) });
    const cart = result.walkers.find(w => w.kind === "carter" && w.homeBuildingId === "mill");
    assert.ok(cart?.kind === "carter");
    assert.equal(cart.mission, "fetch");
    assert.deepEqual(cart.destination, { kind: "building", buildingId: "store" });
    assert.equal(cart.reservation?.resource, "logs");
    assert.equal(cart.reservation?.amount, 8);
    assert.equal(result.buildings.find(b => b.id === "mill")?.inventory.timber, 3);
    assert.equal(result.buildings.find(b => b.id === "store")?.stockReserved.logs, 8);
    assert.deepEqual(result.constructionSites[0]?.reserved, {});
  });
}

for (const scenario of ["sufficient", "unreachable", "reserved", "full"] as const) {
  test(`construction priority remains when input fetch is ${scenario}`, () => {
    const result = spawnCarters({ tick: 20, buildings: [
      building("mill", "sawmill", { inventory: { logs: scenario === "sufficient" ? 2 : 0, timber: 3 },
        reserved: scenario === "full" ? { logs: 100 } : {} }),
      building("store", "storehouse", { inventory: { logs: 100 },
        stockReserved: scenario === "reserved" ? { logs: 100 } : {} }),
    ], constructionSites: [site], walkers: [], treasuryTimber: 0,
      inventory: DELIVERY_INVENTORY,
      routes: routePort(scenario === "unreachable" ? { "mill->wall": paths["mill->wall"] } : paths) });
    const cart = result.walkers.find(w => w.kind === "carter" && w.homeBuildingId === "mill");
    assert.ok(cart?.kind === "carter");
    assert.equal(cart.mission, "deliver");
    assert.deepEqual(cart.destination, { kind: "construction_site", siteId: "wall" });
    assert.deepEqual(cart.cargo, { resource: "timber", amount: 3 });
  });
}

test("starved producer fetch and another source construction delivery coexist", () => {
  const result = spawnCarters({ tick: 20, buildings: [
    building("mill", "sawmill", { inventory: { timber: 3 } }),
    building("store", "storehouse", { inventory: { logs: 100, timber: 10 } }),
  ], constructionSites: [site], walkers: [], treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY, routes: routePort(paths) });
  assert.equal(result.walkers.length, 2);
  assert.deepEqual(result.constructionSites[0]?.reserved, { timber: 8 });
  assert.equal(result.buildings.find(b => b.id === "store")?.stockReserved.logs, 8);
  assert.equal(result.buildings.find(b => b.id === "store")?.inventory.timber, 2);
});

test("stone converter replenishes required input before supplying a stone site", () => {
  const result = spawnCarters({ tick: 20, buildings: [
    building("mill", "masonry", { inventory: { stone_raw: 1, stone: 3 } }),
    building("store", "storehouse", { inventory: { stone_raw: 100 } }),
  ], constructionSites: [{ ...site, required: { stone: 10 } }], walkers: [], treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY, routes: routePort(paths) });
  const cart = result.walkers[0];
  assert.ok(cart?.kind === "carter");
  assert.equal(cart.mission, "fetch");
  assert.equal(cart.reservation.resource, "stone_raw");
  assert.equal(result.buildings.find(b => b.id === "mill")?.inventory.stone, 3);
});

test("an existing fetch retains sole ownership and source claims on the next dispatch", () => {
  const input = { tick: 20, buildings: [
    building("mill", "sawmill", { inventory: { timber: 3 } }),
    building("store", "storehouse", { inventory: { logs: 100 } }),
  ], constructionSites: [site], walkers: [], treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY, routes: routePort(paths) };
  const first = spawnCarters(input);
  const second = spawnCarters({ ...input, ...first, tick: 21 });
  assert.deepEqual(second.walkers, first.walkers);
  assert.deepEqual(second.buildings, first.buildings);
  assert.deepEqual(second.constructionSites, first.constructionSites);
});
