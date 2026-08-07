import assert from "node:assert/strict";
import test from "node:test";

import { constructionMaterialSources } from "../src/agents/deliveryConstruction";
import { spawnCarters, stepCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import {
  constructionStall,
  createPalisadeConstructionSite,
  type ConstructionSite,
} from "../src/economy/construction";
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

function site(
  id: string,
  input: {
    readonly tx?: number;
    readonly ty?: number;
    readonly required?: ConstructionSite["required"];
    readonly delivered?: ConstructionSite["delivered"];
    readonly reserved?: ConstructionSite["reserved"];
  } = {},
): ConstructionSite {
  return {
    id,
    kind: "well",
    tx: input.tx ?? 0,
    ty: input.ty ?? 0,
    required: input.required ?? { timber: 10 },
    delivered: input.delivered ?? {},
    reserved: input.reserved ?? {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

test("site material dispatch takes priority over normal building transfers", () => {
  // Given
  const source = building("store", "storehouse", {
    inventory: { timber: 10 },
  });
  const normalDestination = building("sawmill", "sawmill");
  const target = site("construction-site-000001");
  const input = {
    tick: 130,
    buildings: [source, normalDestination],
    constructionSites: [target],
    walkers: [],
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "store->sawmill": line([0, 0], [1, 0], [2, 0]),
      "store->construction-site-000001": line([0, 0], [0, 1]),
    }),
  };

  // When
  const result = spawnCarters(input);
  const carter = result.walkers[0] as CarterWalker;

  // Then
  assert.equal(result.walkers.length, 1);
  assert.equal(carter.homeBuildingId, source.id);
  assert.deepEqual(carter.destination, {
    kind: "construction_site",
    siteId: target.id,
  });
  assert.deepEqual(carter.cargo, { resource: "timber", amount: 8 });
});

test("an active normal carter is not preempted by a new construction site", () => {
  // Given
  const source = building("logging-camp", "logging_camp", {
    inventory: { logs: 8, timber: 10 },
  });
  const normalDestination = building("store", "storehouse");
  const routes = routePort({
    "logging-camp->store": line([0, 0], [1, 0], [2, 0]),
    "logging-camp->construction-site-000001": line([0, 0], [0, 1]),
  });
  const first = spawnCarters({
    tick: 131,
    buildings: [source, normalDestination],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const input = {
    tick: 132,
    buildings: first.buildings,
    constructionSites: [site("construction-site-000001")],
    walkers: first.walkers,
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes,
  };

  // When
  const result = spawnCarters(input);

  // Then
  assert.equal(result.walkers.length, 1);
  assert.deepEqual((result.walkers[0] as CarterWalker).destination, {
    kind: "building",
    buildingId: "store",
  });
});

test("construction site arrival moves cargo from reserved to delivered exactly once", () => {
  // Given
  const source = building("store", "storehouse", {
    inventory: { timber: 10 },
  });
  const target = site("construction-site-000001");
  const outbound = line([0, 0], [0, 1]);
  const returning = [...outbound].reverse();
  const routes = routePort({
    "store->construction-site-000001": outbound,
    "0,1->store": returning,
  });
  const spawned = spawnCarters({
    tick: 133,
    buildings: [source],
    constructionSites: [target],
    walkers: [],
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const outboundCarter = spawned.walkers[0] as CarterWalker;

  // When
  const delivered = stepCarters({
    tick: 134,
    buildings: spawned.buildings,
    constructionSites: spawned.constructionSites,
    walkers: [arrived(outboundCarter)],
    treasuryTimber: spawned.treasuryTimber,
    inventory: DELIVERY_INVENTORY,
    routes,
  });

  // Then
  assert.deepEqual(delivered.constructionSites[0]?.reserved, {});
  assert.deepEqual(delivered.constructionSites[0]?.delivered, { timber: 8 });
  assert.equal(delivered.walkers.length, 1);
  assert.equal((delivered.walkers[0] as CarterWalker).phase, "returning");
});

test("treasury timber dispatch and cancelled return preserve the bootstrap total", () => {
  // Given
  const home = building("house-1", "house");
  const target = site("construction-site-000001");
  const routes = routePort({
    "house-1->construction-site-000001": line([0, 0], [1, 0]),
  });

  // When
  const spawned = spawnCarters({
    tick: 135,
    buildings: [home],
    constructionSites: [target],
    walkers: [],
    treasuryTimber: 12,
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const cancelled = stepCarters({
    tick: 136,
    buildings: spawned.buildings,
    constructionSites: spawned.constructionSites,
    walkers: spawned.walkers,
    treasuryTimber: spawned.treasuryTimber,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}, []),
  });
  const recovered = stepCarters({
    tick: 137,
    buildings: cancelled.buildings,
    constructionSites: cancelled.constructionSites,
    walkers: cancelled.walkers,
    treasuryTimber: cancelled.treasuryTimber,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}, []),
  });

  // Then
  assert.equal(spawned.treasuryTimber, 4);
  assert.deepEqual(spawned.constructionSites[0]?.reserved, { timber: 8 });
  assert.deepEqual(spawned.walkers[0]?.cargo, { resource: "timber", amount: 8 });
  assert.equal(recovered.treasuryTimber, 12);
  assert.deepEqual(recovered.constructionSites[0]?.reserved, {});
  assert.deepEqual(recovered.walkers, []);
});

test("disconnected construction stock does not spawn or leak reservations", () => {
  // Given
  const source = building("store", "storehouse", {
    inventory: { timber: 10 },
  });
  const target = site("construction-site-000001");
  const input = {
    tick: 138,
    buildings: [source],
    constructionSites: [target],
    walkers: [],
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  };

  // When
  const result = spawnCarters(input);

  // Then
  assert.deepEqual(result.walkers, []);
  assert.deepEqual(result.constructionSites[0]?.reserved, {});
  assert.deepEqual(result.buildings[0]?.stockReserved, {});
});

test("material source exposure distinguishes absent stock from disconnected stock", () => {
  // Given
  const target = site("construction-site-000001");
  const emptyStore = building("empty-store", "storehouse");
  const stockedStore = building("stocked-store", "storehouse", {
    inventory: { timber: 10 },
  });

  // When
  const withoutStock = constructionMaterialSources({
    site: target,
    buildings: [emptyStore],
    routes: routePort({}),
    inventory: DELIVERY_INVENTORY,
    treasuryTimber: 0,
  });
  const disconnectedStock = constructionMaterialSources({
    site: target,
    buildings: [stockedStore],
    routes: routePort({}),
    inventory: DELIVERY_INVENTORY,
    treasuryTimber: 0,
  });

  // Then
  assert.equal(constructionStall(target, withoutStock), "no_material_source");
  assert.equal(constructionStall(target, disconnectedStock), "no_route");
});

test("wall construction sites use the existing construction delivery destination", () => {
  // Given
  const source = building("store", "storehouse", {
    inventory: { timber: 30 },
  });
  const target = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 1, y: 1 }, { x: 3, y: 1 }],
    startedTick: 0,
  });
  const routes = routePort({
    "store->wall-a-segment-000": line([0, 0], [1, 0]),
  });

  // When
  const result = spawnCarters({
    tick: 139,
    buildings: [source],
    constructionSites: [target],
    walkers: [],
    treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const carter = result.walkers[0] as CarterWalker;

  // Then
  assert.equal(result.walkers.length, 1);
  assert.deepEqual(carter.destination, {
    kind: "construction_site",
    siteId: target.id,
  });
  assert.deepEqual(carter.cargo, { resource: "timber", amount: 8 });
  assert.deepEqual(result.constructionSites[0]?.reserved, { timber: 8 });
});
