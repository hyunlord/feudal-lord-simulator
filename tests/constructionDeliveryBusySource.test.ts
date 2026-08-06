import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import type { ConstructionSite } from "../src/economy/construction";
import {
  DELIVERY_INVENTORY,
  building,
  line,
  routePort,
} from "./deliveryFixtures";

function constructionSite(id: string): ConstructionSite {
  return {
    id,
    kind: "well",
    tx: 0,
    ty: 0,
    required: { timber: 10 },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

test("busy first site source falls through to the next idle source before normal delivery", () => {
  // Given
  const alpha = building("alpha-store", "storehouse", {
    inventory: { timber: 10 },
  });
  const bravo = building("bravo-logger", "logging_camp", {
    inventory: { timber: 10, logs: 8 },
  });
  const store = building("central-store", "storehouse");
  const target = constructionSite("construction-site-000001");
  const busyAlpha: CarterWalker = {
    id: "carter:alpha-store:busy",
    kind: "carter",
    mission: "deliver",
    phase: "outbound",
    homeBuildingId: alpha.id,
    destination: { kind: "building", buildingId: store.id },
    reservation: {
      destination: { kind: "building", buildingId: store.id },
      resource: "timber",
      amount: 1,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    position: { tx: 0, ty: 0 },
    path: line([0, 0], [1, 0]),
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "timber", amount: 1 },
    spawnedTick: 139,
    cancellation: null,
  };

  // When
  const result = spawnCarters({
    tick: 140,
    buildings: [alpha, bravo, store],
    constructionSites: [target],
    walkers: [busyAlpha],
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "alpha-store->construction-site-000001": line([0, 0], [0, 1]),
      "bravo-logger->construction-site-000001": line([2, 0], [2, 1]),
      "bravo-logger->central-store": line([2, 0], [1, 0], [0, 0]),
    }),
  });
  const newCarter = result.walkers.find(
    (walker) => walker.kind === "carter" && walker.homeBuildingId === bravo.id,
  ) as CarterWalker | undefined;

  // Then
  assert.equal(result.walkers.length, 2);
  assert.notEqual(newCarter, undefined);
  assert.deepEqual(newCarter?.destination, {
    kind: "construction_site",
    siteId: target.id,
  });
  assert.deepEqual(newCarter?.cargo, { resource: "timber", amount: 8 });
  assert.deepEqual(result.constructionSites[0]?.reserved, { timber: 8 });
  assert.deepEqual(result.buildings.find(({ id }) => id === alpha.id)?.inventory, {
    timber: 10,
  });
  assert.deepEqual(result.buildings.find(({ id }) => id === bravo.id)?.inventory, {
    logs: 8,
    timber: 2,
  });
  assert.deepEqual(result.buildings.find(({ id }) => id === store.id)?.reserved, {});
});

test("busy first treasury home falls through to the next idle home", () => {
  // Given
  const alpha = building("alpha-house", "house");
  const bravo = building("bravo-house", "house");
  const target = constructionSite("construction-site-000001");
  const busyAlpha: CarterWalker = {
    id: "carter:alpha-house:busy",
    kind: "carter",
    mission: "deliver",
    phase: "outbound",
    homeBuildingId: alpha.id,
    destination: { kind: "building", buildingId: bravo.id },
    reservation: {
      destination: { kind: "building", buildingId: bravo.id },
      resource: "timber",
      amount: 1,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    position: { tx: 0, ty: 0 },
    path: line([0, 0], [1, 0]),
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "timber", amount: 1 },
    spawnedTick: 141,
    cancellation: null,
  };

  // When
  const result = spawnCarters({
    tick: 142,
    buildings: [alpha, bravo],
    constructionSites: [target],
    walkers: [busyAlpha],
    treasuryTimber: 12,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "alpha-house->construction-site-000001": line([0, 0], [0, 1]),
      "bravo-house->construction-site-000001": line([1, 0], [1, 1]),
    }),
  });
  const newCarter = result.walkers.find(
    (walker) => walker.kind === "carter" && walker.homeBuildingId === bravo.id,
  ) as CarterWalker | undefined;

  // Then
  assert.equal(result.walkers.length, 2);
  assert.notEqual(newCarter, undefined);
  assert.deepEqual(newCarter?.destination, {
    kind: "construction_site",
    siteId: target.id,
  });
  assert.deepEqual(newCarter?.cargo, { resource: "timber", amount: 8 });
  assert.equal(result.treasuryTimber, 4);
  assert.deepEqual(result.constructionSites[0]?.reserved, { timber: 8 });
});
