import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters } from "../src/agents/delivery";
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
  assert.equal(carter.destinationBuildingId, near.id);
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

  assert.equal(
    (result.walkers[0] as CarterWalker).destinationBuildingId,
    "granary-a",
  );
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
  assert.equal(carter.destinationBuildingId, granary.id);
  assert.equal(carter.cargo, null);
  assert.deepEqual(carter.reservation, {
    destinationBuildingId: mill.id,
    resource: "wheat",
    amount: 8,
    sourceStockClaim: {
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
