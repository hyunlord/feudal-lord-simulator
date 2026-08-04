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

const arrived = (carter: CarterWalker): CarterWalker => ({
  ...carter,
  position: carter.path.at(-1) ?? carter.position,
  pathIndex: Math.max(0, carter.path.length - 1),
});

test("delivery arrival deposits cargo, releases capacity, returns home, then despawns", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 8 },
  });
  const store = building("store", "storehouse");
  const outbound = line([0, 0], [1, 0], [2, 0]);
  const returning = [...outbound].reverse();
  const routes = routePort({
    "producer->store": outbound,
    "store->producer": returning,
    "2,0->producer": returning,
  });
  const spawned = spawnCarters({
    tick: 20,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const outboundArrival = arrived(spawned.walkers[0] as CarterWalker);
  const delivered = stepCarters({
    tick: 30,
    buildings: spawned.buildings,
    walkers: [outboundArrival],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const returningCarter = delivered.walkers[0] as CarterWalker;

  assert.equal(
    delivered.buildings.find(({ id }) => id === store.id)?.inventory.logs,
    8,
  );
  assert.equal(
    delivered.buildings.find(({ id }) => id === store.id)?.reserved.logs ?? 0,
    0,
  );
  assert.equal(returningCarter.phase, "returning");
  assert.equal(returningCarter.cargo, null);

  const finished = stepCarters({
    tick: 31,
    buildings: delivered.buildings,
    walkers: [arrived(returningCarter)],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  assert.deepEqual(finished.walkers, []);
});

test("fetch arrival withdraws the claimed source stock and delivers it into reserved home space", () => {
  const mill = building("mill", "mill");
  const granary = building("granary", "granary", {
    inventory: { wheat: 9 },
  });
  const outbound = line([0, 0], [1, 0]);
  const returning = [...outbound].reverse();
  const routes = routePort({
    "mill->granary": outbound,
    "granary->mill": returning,
    "1,0->mill": returning,
  });
  const spawned = spawnCarters({
    tick: 40,
    buildings: [mill, granary],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const collected = stepCarters({
    tick: 50,
    buildings: spawned.buildings,
    walkers: [arrived(spawned.walkers[0] as CarterWalker)],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const returningCarter = collected.walkers[0] as CarterWalker;

  assert.deepEqual(returningCarter.cargo, { resource: "wheat", amount: 8 });
  assert.equal(
    collected.buildings.find(({ id }) => id === granary.id)?.inventory.wheat,
    1,
  );
  assert.equal(
    collected.buildings.find(({ id }) => id === granary.id)?.stockReserved.wheat ?? 0,
    0,
  );

  const delivered = stepCarters({
    tick: 51,
    buildings: collected.buildings,
    walkers: [arrived(returningCarter)],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  assert.deepEqual(delivered.walkers, []);
  assert.equal(
    delivered.buildings.find(({ id }) => id === mill.id)?.inventory.wheat,
    8,
  );
  assert.equal(
    delivered.buildings.find(({ id }) => id === mill.id)?.reserved.wheat ?? 0,
    0,
  );
});

test("a broken outbound route releases every claim exactly once and returns cargo home", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 8 },
  });
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 60,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0], [2, 0]),
    }),
  });
  const brokenRoutes = routePort(
    { "0,0->producer": line([0, 0]) },
    [ { tx: 0, ty: 0 } ],
  );
  const cancelled = stepCarters({
    tick: 61,
    buildings: spawned.buildings,
    walkers: spawned.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: brokenRoutes,
  });
  const returning = cancelled.walkers[0] as CarterWalker;

  assert.equal(returning.phase, "returning");
  assert.equal(returning.cancellation?.reason, "road_removed");
  assert.equal(
    cancelled.buildings.find(({ id }) => id === store.id)?.reserved.logs ?? 0,
    0,
  );

  const finished = stepCarters({
    tick: 62,
    buildings: cancelled.buildings,
    walkers: cancelled.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: brokenRoutes,
  });
  assert.deepEqual(finished.walkers, []);
  assert.equal(
    finished.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    8,
  );
  assert.equal(
    finished.buildings.find(({ id }) => id === store.id)?.reserved.logs ?? 0,
    0,
  );
});

test("a broken fetch route releases both the home capacity and source stock claims", () => {
  const mill = building("mill", "mill");
  const granary = building("granary", "granary", {
    inventory: { wheat: 9 },
  });
  const spawned = spawnCarters({
    tick: 70,
    buildings: [mill, granary],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "mill->granary": line([0, 0], [1, 0], [2, 0]),
    }),
  });
  const brokenRoutes = routePort(
    { "0,0->mill": line([0, 0]) },
    [{ tx: 0, ty: 0 }],
  );
  const cancelled = stepCarters({
    tick: 71,
    buildings: spawned.buildings,
    walkers: spawned.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: brokenRoutes,
  });

  assert.equal(
    cancelled.buildings.find(({ id }) => id === mill.id)?.reserved.wheat ?? 0,
    0,
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === granary.id)?.stockReserved.wheat ?? 0,
    0,
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === granary.id)?.inventory.wheat,
    9,
  );
});
