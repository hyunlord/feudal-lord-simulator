import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters, stepCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { stepProduction } from "../src/economy/production";
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

test("an outbound carter without a road path home cancels before delivery", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 3 },
  });
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 80,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });
  const cancelled = stepCarters({
    tick: 81,
    buildings: spawned.buildings,
    walkers: [arrived(spawned.walkers[0] as CarterWalker)],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });

  assert.equal(cancelled.walkers.length, 1);
  assert.equal(
    (cancelled.walkers[0] as CarterWalker).cancellation?.reason,
    "road_removed",
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === store.id)?.inventory.logs ?? 0,
    0,
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === store.id)?.reserved.logs ?? 0,
    0,
  );

  const recovered = stepCarters({
    tick: 82,
    buildings: cancelled.buildings,
    walkers: cancelled.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}, []),
  });

  assert.deepEqual(recovered.walkers, []);
  assert.equal(
    recovered.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    3,
  );
});

test("a vanished fetch source cancels without leaking either reservation", () => {
  const mill = building("mill", "mill");
  const granary = building("granary", "granary", {
    inventory: { wheat: 8 },
  });
  const outbound = line([0, 0], [1, 0]);
  const spawned = spawnCarters({
    tick: 90,
    buildings: [mill, granary],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "mill->granary": outbound,
    }),
  });
  const depleted = spawned.buildings.map((candidate) =>
    candidate.id === granary.id ? { ...candidate, inventory: {} } : candidate,
  );
  const cancelled = stepCarters({
    tick: 91,
    buildings: depleted,
    walkers: [arrived(spawned.walkers[0] as CarterWalker)],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "1,0->mill": line([1, 0], [0, 0]),
    }),
  });
  const carter = cancelled.walkers[0] as CarterWalker;

  assert.equal(carter.cancellation?.reason, "source_unavailable");
  assert.equal(carter.cargo, null);
  assert.equal(
    cancelled.buildings.find(({ id }) => id === mill.id)?.reserved.wheat ?? 0,
    0,
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === granary.id)?.stockReserved.wheat ?? 0,
    0,
  );
});

test("a cancellation with no road home remains observable for one tick before logical recovery", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 8 },
  });
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 100,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });
  const noRoads = routePort({}, []);

  const cancelled = stepCarters({
    tick: 101,
    buildings: spawned.buildings,
    walkers: spawned.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });

  assert.equal(cancelled.walkers.length, 1);
  assert.equal(
    (cancelled.walkers[0] as CarterWalker).cancellation?.reason,
    "road_removed",
  );
  assert.deepEqual(cancelled.walkers[0]?.cargo, { resource: "logs", amount: 8 });

  const recovered = stepCarters({
    tick: 102,
    buildings: cancelled.buildings,
    walkers: cancelled.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });

  assert.deepEqual(recovered.walkers, []);
  assert.equal(
    recovered.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    8,
  );
});

test("cancelled cargo reserves its home capacity until the returning carter restores it", () => {
  const producer = {
    ...building("producer", "logging_camp", {
      inventory: { logs: 20 },
    }),
    workers: 3,
    productionProgress: 49,
  };
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 110,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });
  const noRoads = routePort({}, []);

  const cancelled = stepCarters({
    tick: 111,
    buildings: spawned.buildings,
    walkers: spawned.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });
  const reservedHome = cancelled.buildings.find(({ id }) => id === producer.id);
  assert.ok(reservedHome);
  assert.equal(reservedHome.inventory.logs, 12);
  assert.equal(reservedHome.reserved.logs, 8);

  const blocked = stepProduction(
    reservedHome,
    BUILDING_CONFIG_BY_KIND.logging_camp,
  );
  assert.equal(blocked.produced, null);
  assert.equal(blocked.building.productionProgress, 50);
  assert.equal(blocked.building.inventory.logs, 12);

  const recovered = stepCarters({
    tick: 112,
    buildings: cancelled.buildings,
    walkers: cancelled.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });
  const recoveredHome = recovered.buildings.find(({ id }) => id === producer.id);
  assert.equal(recoveredHome?.inventory.logs, 20);
  assert.equal(recoveredHome?.reserved.logs ?? 0, 0);
});

test("an outbound delivery protects enough home capacity for later cancellation", () => {
  const producer = {
    ...building("producer", "logging_camp", {
      inventory: { logs: 20 },
    }),
    workers: 3,
  };
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 120,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });
  let refilledHome = spawned.buildings.find(({ id }) => id === producer.id);
  assert.ok(refilledHome);

  for (let tick = 0; tick < 500; tick += 1) {
    refilledHome = stepProduction(
      refilledHome,
      BUILDING_CONFIG_BY_KIND.logging_camp,
    ).building;
  }

  const beforeCancellation = spawned.buildings.map((candidate) =>
    candidate.id === producer.id ? refilledHome : candidate,
  );
  const noRoads = routePort({}, []);
  const cancelled = stepCarters({
    tick: 121,
    buildings: beforeCancellation,
    walkers: spawned.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });
  const protectedHome = cancelled.buildings.find(({ id }) => id === producer.id);

  assert.equal(protectedHome?.inventory.logs, 12);
  assert.equal(protectedHome?.reserved.logs, 8);

  const recovered = stepCarters({
    tick: 122,
    buildings: cancelled.buildings,
    walkers: cancelled.walkers,
    inventory: DELIVERY_INVENTORY,
    routes: noRoads,
  });

  assert.deepEqual(recovered.walkers, []);
  assert.equal(
    recovered.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    20,
  );
  assert.equal(
    recovered.buildings.find(({ id }) => id === producer.id)?.reserved.logs ?? 0,
    0,
  );
});

test("an unreserved returning carter waits rather than overfilling a full home", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 20 },
  });
  const store = building("store", "storehouse");
  const returning: CarterWalker = {
    id: "carter:producer:120",
    kind: "carter",
    mission: "deliver",
    phase: "returning",
    homeBuildingId: producer.id,
    destinationBuildingId: store.id,
    reservation: {
      destinationBuildingId: store.id,
      resource: "logs",
      amount: 8,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    position: { tx: 0, ty: 0 },
    path: [{ tx: 0, ty: 0 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "logs", amount: 8 },
    spawnedTick: 120,
    cancellation: {
      tick: 121,
      reason: "road_removed",
      releasedReservation: true,
    },
  };

  const result = stepCarters({
    tick: 122,
    buildings: [producer, store],
    walkers: [returning],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}, [{ tx: 0, ty: 0 }]),
  });

  assert.equal(result.walkers.length, 1);
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "logs", amount: 8 });
  assert.equal(
    result.buildings.find(({ id }) => id === producer.id)?.inventory.logs,
    20,
  );
});
