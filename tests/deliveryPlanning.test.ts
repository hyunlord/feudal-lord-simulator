import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters, stepCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import {
  DELIVERY_INVENTORY,
  building,
  line,
  routePort,
} from "./deliveryFixtures";

test("a producer chooses the nearest valid store, reserves space, and loads at most eight", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 12 },
  });
  const near = building("store-near", "storehouse");
  const far = building("store-far", "storehouse");
  const routes = routePort({
    "producer->store-near": line([0, 0], [1, 0], [2, 0]),
    "producer->store-far": line([0, 0], [0, 1], [0, 2], [0, 3]),
  });

  const result = spawnCarters({
    tick: 10,
    buildings: [producer, far, near],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const carter = result.walkers[0] as CarterWalker;

  assert.equal(carter.kind, "carter");
  assert.deepEqual(carter.destination, { kind: "building", buildingId: near.id });
  assert.deepEqual(carter.cargo, { resource: "logs", amount: 8 });
  assert.equal(
    result.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    4,
  );
  assert.equal(
    result.buildings.find(({ id }) => id === producer.id)?.reserved.logs,
    8,
  );
  assert.deepEqual(carter.reservation.homeCapacityClaim, {
    buildingId: producer.id,
    resource: "logs",
    amount: 8,
  });
  assert.equal(
    result.buildings.find(({ id }) => id === near.id)?.reserved.logs,
    8,
  );
});

test("equal road distance ties break by ascending destination building id", () => {
  const producer = building("producer", "wheat_farm", {
    inventory: { wheat: 3 },
  });
  const storeB = building("granary-b", "granary");
  const storeA = building("granary-a", "granary");
  const result = spawnCarters({
    tick: 11,
    buildings: [producer, storeB, storeA],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->granary-a": line([0, 0], [1, 0]),
      "producer->granary-b": line([0, 0], [0, 1]),
    }),
  });

  assert.deepEqual((result.walkers[0] as CarterWalker).destination, {
    kind: "building",
    buildingId: "granary-a",
  });
});

test("reservations prevent two producers claiming the same final slot", () => {
  const first = building("producer-a", "logging_camp", {
    inventory: { logs: 8 },
  });
  const second = building("producer-b", "logging_camp", {
    inventory: { logs: 8 },
  });
  const store = building("store", "storehouse", {
    inventory: { timber: 199 },
  });
  const result = spawnCarters({
    tick: 12,
    buildings: [second, store, first],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer-a->store": line([0, 0], [1, 0]),
      "producer-b->store": line([2, 0], [1, 0]),
    }),
  });

  assert.equal(result.walkers.length, 1);
  assert.equal(result.walkers[0]?.homeBuildingId, first.id);
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "logs", amount: 1 });
  assert.equal(
    result.buildings.find(({ id }) => id === store.id)?.reserved.logs,
    1,
  );
  assert.equal(
    result.buildings.find(({ id }) => id === second.id)?.inventory.logs,
    8,
  );
});

test("a producer with no reachable unreserved destination does not spawn", () => {
  const producer = building("producer", "wheat_farm", {
    inventory: { wheat: 8 },
  });
  const full = building("granary", "granary", {
    inventory: { bread: 200 },
  });
  const result = spawnCarters({
    tick: 13,
    buildings: [producer, full],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  assert.deepEqual(result.walkers, []);
  assert.equal(result.buildings, result.buildings);
  assert.equal(result.buildings[0]?.inventory.wheat, 8);
});

test("a converter fetches missing input from the nearest store and claims both stock and home space", () => {
  const mill = building("mill", "mill", { inventory: { wheat: 1 } });
  const granary = building("granary", "granary", {
    inventory: { wheat: 10 },
  });
  const result = spawnCarters({
    tick: 14,
    buildings: [mill, granary],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "mill->granary": line([0, 0], [1, 0], [2, 0]),
    }),
  });
  const carter = result.walkers[0] as CarterWalker;

  assert.equal(carter.mission, "fetch");
  assert.deepEqual(carter.destination, {
    kind: "building",
    buildingId: granary.id,
  });
  assert.equal(carter.cargo, null);
  assert.deepEqual(carter.reservation, {
    destination: { kind: "building", buildingId: mill.id },
    resource: "wheat",
    amount: 8,
    sourceStockClaim: {
      kind: "building",
      buildingId: granary.id,
      resource: "wheat",
      amount: 8,
    },
    homeCapacityClaim: null,
  });
  assert.equal(
    result.buildings.find(({ id }) => id === mill.id)?.reserved.wheat,
    8,
  );
  assert.equal(
    result.buildings.find(({ id }) => id === granary.id)?.stockReserved.wheat,
    8,
  );
});

test("the reversed fetch rule also keeps the timber chain operable", () => {
  const sawmill = building("sawmill", "sawmill");
  const store = building("store", "storehouse", {
    inventory: { logs: 5 },
  });
  const result = spawnCarters({
    tick: 15,
    buildings: [sawmill, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "sawmill->store": line([0, 0], [1, 0]),
    }),
  });

  assert.equal((result.walkers[0] as CarterWalker).mission, "fetch");
  assert.deepEqual(result.walkers[0]?.cargo, null);
  assert.equal(
    result.buildings.find(({ id }) => id === store.id)?.stockReserved.logs,
    5,
  );
});

test("a converter with enough input delivers finished output instead of fetching", () => {
  const mill = building("mill", "mill", {
    inventory: { wheat: 2, bread: 4 },
  });
  const granary = building("granary", "granary");
  const result = spawnCarters({
    tick: 16,
    buildings: [granary, mill],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "mill->granary": line([0, 0], [1, 0]),
    }),
  });
  const carter = result.walkers[0] as CarterWalker;

  assert.equal(carter.mission, "deliver");
  assert.deepEqual(carter.cargo, { resource: "bread", amount: 4 });
  assert.equal(
    result.buildings.find(({ id }) => id === mill.id)?.inventory.wheat,
    2,
  );
});

test("an active carter prevents a second carter from spawning for the same home", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 16 },
  });
  const store = building("store", "storehouse");
  const routes = routePort({
    "producer->store": line([0, 0], [1, 0]),
  });
  const first = spawnCarters({
    tick: 17,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const second = spawnCarters({
    tick: 18,
    buildings: first.buildings,
    walkers: first.walkers,
    inventory: DELIVERY_INVENTORY,
    routes,
  });

  assert.equal(second.walkers.length, 1);
  assert.equal(
    second.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    8,
  );
});

test("grain intake leaves bread room and counts grain cargo already reserved", () => {
  const farm = building("farm", "wheat_farm", { inventory: { wheat: 8 } });
  const granary = building("granary", "granary", { inventory: { wheat: 95 }, reserved: { wheat: 3 } });
  const result = spawnCarters({ tick: 10, buildings: [farm, granary], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "farm->granary": line([0, 0], [1, 0]) }) });
  assert.equal(result.walkers[0]?.cargo?.amount, 2);
  assert.equal(result.buildings.find(({ id }) => id === "granary")?.reserved.wheat, 5);
  assert.equal(result.buildings.find(({ id }) => id === "farm")?.inventory.wheat, 6);
});

test("grain quota cannot steal real capacity and bread can use the remaining room", () => {
  const farm = building("farm", "wheat_farm", { inventory: { wheat: 8 } });
  const mill = building("mill", "mill", { inventory: { wheat: 8, bread: 8 } });
  const granary = building("granary", "granary", { inventory: { wheat: 100, bread: 95 } });
  const result = spawnCarters({ tick: 10, buildings: [farm, mill, granary], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "farm->granary": line([0, 0], [1, 0]), "mill->granary": line([0, 0], [1, 0]) }) });
  assert.equal(result.walkers.length, 1);
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "bread", amount: 5 });
  assert.equal(result.buildings.find(({ id }) => id === "farm")?.inventory.wheat, 8);
});

test("raw logs and stone share half the storehouse, leaving finished-goods capacity", () => {
  const logging = building("logging", "logging_camp", { inventory: { logs: 8 } });
  const quarry = building("quarry", "quarry", { inventory: { stone_raw: 8 } });
  const store = building("store", "storehouse", { inventory: { logs: 80, stone_raw: 15 }, reserved: { stone_raw: 3 } });
  const result = spawnCarters({ tick: 10, buildings: [logging, quarry, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "logging->store": line([0, 0], [1, 0]), "quarry->store": line([0, 0], [1, 0]) }) });
  assert.equal(result.walkers.length, 1);
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "logs", amount: 2 });
  assert.equal(result.buildings.find(({ id }) => id === "quarry")?.inventory.stone_raw, 8);
});

test("bread delivery uses the nearer usable granary before a farther empty granary", () => {
  const mill = building("mill", "mill", { inventory: { wheat: 2, bread: 8 } });
  const near = building("near", "granary", { inventory: { bread: 32 } });
  const far = building("far", "granary", { inventory: {} });
  const result = spawnCarters({ tick: 10, buildings: [mill, near, far], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "mill->near": line([0, 0], [1, 0]), "mill->far": line([0, 0], [1, 0], [2, 0]) }) });
  const carter = result.walkers[0];
  assert.ok(carter?.kind === "carter");
  assert.deepEqual(carter.destination, { kind: "building", buildingId: "near" });
  assert.equal(result.buildings.find(b => b.id === "near")?.reserved.bread, 8);
  assert.equal(result.buildings.find(b => b.id === "near")?.inventory.bread, 32);
  assert.equal(result.buildings.reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0) + (carter.cargo?.amount ?? 0), 40);
});

test("bread destination allocation includes earlier carters' inbound claims", () => {
  const mills = [building("mill-a", "mill", { inventory: { wheat: 2, bread: 8 } }), building("mill-b", "mill", { inventory: { wheat: 2, bread: 8 } })];
  const near = building("near", "granary", { inventory: { bread: 4 } });
  const far = building("far", "granary", { inventory: {} });
  const result = spawnCarters({ tick: 10, buildings: [...mills, near, far], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "mill-a->near": line([0, 0], [1, 0]), "mill-a->far": line([0, 0], [0, 1]), "mill-b->near": line([0, 0], [1, 0]), "mill-b->far": line([0, 0], [0, 1]) }) });
  const claims = result.buildings.filter(b => b.kind === "granary").map(b => [b.id, b.reserved.bread]);
  assert.deepEqual(claims, [["near", 8], ["far", 8]]);
});

for (const reserved of [0, 8]) {
  test(`bread uses the farther store when near capacity is occupied or reserved (${reserved})`, () => {
    const mill = building("mill", "mill", { inventory: { wheat: 2, bread: 8 } });
    const near = building("near", "granary", { inventory: { bread: 200 - reserved }, reserved: { bread: reserved } });
    const far = building("far", "granary");
    const result = spawnCarters({ tick: 10, buildings: [mill, near, far], walkers: [], inventory: DELIVERY_INVENTORY,
      routes: routePort({ "mill->near": line([0, 0], [1, 0]), "mill->far": line([0, 0], [1, 0], [2, 0]) }) });
    const carter = result.walkers[0];
    assert.ok(carter?.kind === "carter");
    assert.deepEqual(carter.destination, { kind: "building", buildingId: "far" });
    assert.equal(result.buildings.find(b => b.id === "near")?.reserved.bread, reserved);
    assert.equal(result.buildings.reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0) + (carter.cargo?.amount ?? 0), 208 - reserved);
  });
}

test("near-store last slot is shared safely by competing bread producers", () => {
  const mills = ["a", "b"].map(id => building(id, "mill", { inventory: { wheat: 2, bread: 8 } }));
  const near = building("near", "granary", { inventory: { bread: 199 } });
  const far = building("far", "granary");
  const result = spawnCarters({ tick: 10, buildings: [...mills, near, far], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "a->near": line([0, 0], [1, 0]), "a->far": line([0, 0], [1, 0], [2, 0]),
      "b->near": line([0, 0], [1, 0]), "b->far": line([0, 0], [1, 0], [2, 0]) }) });
  assert.equal(result.buildings.find(b => b.id === "near")?.reserved.bread, 1);
  assert.equal(result.buildings.find(b => b.id === "far")?.reserved.bread, 8);
  assert.equal(result.buildings.reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0)
    + result.walkers.reduce((sum, w) => sum + (w.cargo?.amount ?? 0), 0), 215);
});

test("a bread carter completes its local round trip before the distant empty-store detour", () => {
  const mill = building("mill", "mill", { inventory: { wheat: 2, bread: 1 } });
  const near = building("near", "granary", { inventory: { bread: 4 } });
  const far = building("far", "granary");
  const short = line([0, 0], [1, 0], [2, 0]);
  const long = Array.from({ length: 18 }, (_, tx) => ({ tx, ty: 0 }));
  const routes = routePort({ ...Object.fromEntries(long.map((tile, index) =>
    [`${tile.tx},${tile.ty}->mill`, long.slice(0, index + 1).reverse()])), "mill->near": short, "mill->far": long,
    "near->mill": [...short].reverse(), "far->mill": [...long].reverse(),
    "2,0->mill": [...short].reverse(), "17,0->mill": [...long].reverse() });
  let result = spawnCarters({ tick: 0, buildings: [mill, near, far], walkers: [], inventory: DELIVERY_INVENTORY, routes });
  for (let tick = 1; tick <= 40; tick += 1) {
    result = stepCarters({ tick, buildings: result.buildings, walkers: result.walkers, inventory: DELIVERY_INVENTORY, routes });
  }
  assert.equal(result.walkers.length, 0);
  assert.equal(result.buildings.find(b => b.id === "near")?.inventory.bread, 5);
  assert.equal(result.buildings.reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0), 5);
  assert.ok(result.buildings.every(b => (b.reserved.bread ?? 0) === 0));
});
