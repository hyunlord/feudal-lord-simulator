import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters, stepCarters } from "../src/agents/delivery";
import { stepDistributors, type RoamingRoutePort } from "../src/agents/roaming";
import type { DistributorWalker } from "../src/agents/walker.types";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";
import { createMulberry32 as createRng } from "../src/engine/prng";

const distributor: DistributorWalker = {
  id: "bread-carrier", kind: "distributor", homeBuildingId: "granary",
  position: { tx: 0.4, ty: 0 }, path: line([0, 0], [1, 0]), pathIndex: 0,
  previousTile: null, cargo: { resource: "bread", amount: 4 }, spawnedTick: 0,
  phase: "roaming", junctionVisits: 0, tilesTravelled: 1, priorTile: null,
};
const baseRoutes: RoamingRoutePort = {
  homePath: () => null, returnPath: (tile) => [tile],
  neighbors: () => [], isRoad: () => true,
};
const granary = () => building("granary", "granary", { reserved: { bread: 4 } });
const house = { buildingId: "house", tx: 1, ty: 1, breadStock: 0, lastServicedTick: 0 };

test("a wall completed ahead cancels a loaded carter from the last reached side without losing cargo", () => {
  const initial = spawnCarters({ tick: 80, buildings: [
    building("producer", "logging_camp", { inventory: { logs: 3 } }),
    building("store", "storehouse"),
  ], walkers: [], inventory: DELIVERY_INVENTORY,
  routes: routePort({ "producer->store": line([0, 0], [1, 0]) }) });
  const carter = initial.walkers[0];
  assert.ok(carter?.kind === "carter");
  const routes = {
    ...routePort({ "0,0->producer": line([0, 0]), "producer->store": line([0, 0], [1, 0]) }),
    canTraverse: () => false,
  };
  const result = stepCarters({ tick: 81, buildings: initial.buildings,
    walkers: [{ ...carter, position: { tx: 0.4, ty: 0 } }], inventory: DELIVERY_INVENTORY, routes });
  const returning = result.walkers[0];
  assert.ok(returning?.kind === "carter");
  assert.equal(returning.phase, "returning");
  assert.deepEqual(returning.position, { tx: 0, ty: 0 });
  assert.deepEqual(returning.cargo, { resource: "logs", amount: 3 });
  assert.equal(result.buildings.find((b) => b.id === "store")?.reserved.logs ?? 0, 0);
  const finished = stepCarters({ tick: 82, buildings: result.buildings,
    walkers: result.walkers, inventory: DELIVERY_INVENTORY, routes });
  assert.equal(finished.walkers.length, 0);
  assert.equal(finished.buildings.find((b) => b.id === "producer")?.inventory.logs, 3);
});

test("a distributor turns back on the reached side when a wall blocks its current edge", () => {
  const starts: number[] = [];
  const routes = { ...baseRoutes, canTraverse: () => false,
    returnPath: (tile: { readonly tx: number; readonly ty: number }) => {
      starts.push(tile.tx); return line([0, 0], [-1, 0]);
    } };
  const result = stepDistributors({ tick: 1, buildings: [granary()], walkers: [distributor],
    houses: [house], routes, rngForJunction: () => createRng(1) });
  const returning = result.walkers[0];
  assert.ok(returning?.kind === "distributor");
  assert.equal(returning.phase, "returning");
  assert.deepEqual(returning.position, { tx: 0, ty: 0 });
  assert.deepEqual(starts, [0]);
  assert.equal(returning.cargo?.amount, 4);
  assert.equal(result.buildings[0]?.reserved.bread, 4);
  assert.equal(result.houses[0]?.breadStock, 0);
});

test("a nearby house across a wall receives no bread and preserves the return claim", () => {
  const result = stepDistributors({ tick: 1, buildings: [granary()],
    walkers: [{ ...distributor, position: { tx: 1, ty: 0 }, pathIndex: 1 }], houses: [house],
    routes: { ...baseRoutes, canServiceHouse: () => false }, rngForJunction: () => createRng(1) });
  assert.equal(result.houses[0]?.breadStock, 0);
  assert.equal(result.walkers[0]?.cargo?.amount, 4);
  assert.equal(result.buildings[0]?.reserved.bread, 4);
});

test("an isolated distributor uses logical recovery without duplicating bread or leaking its claim", () => {
  const routes = { ...baseRoutes, canTraverse: () => false, returnPath: () => null };
  const first = stepDistributors({ tick: 1, buildings: [granary()], walkers: [distributor],
    houses: [house], routes, rngForJunction: () => createRng(1) });
  assert.equal(first.walkers.length, 0);
  assert.equal(first.buildings[0]?.inventory.bread, 4);
  assert.equal(first.buildings[0]?.reserved.bread ?? 0, 0);
  const again = stepDistributors({ tick: 2, ...first, routes, rngForJunction: () => createRng(1) });
  assert.equal(again.buildings[0]?.inventory.bread, 4);
});

test("logical recovery retains a distributor's cargo if its former home cannot hold it", () => {
  const result = stepDistributors({ tick: 1,
    buildings: [building("granary", "granary", { inventory: { bread: 200 } })],
    walkers: [distributor], houses: [],
    routes: { ...baseRoutes, canTraverse: () => false, returnPath: () => null },
    rngForJunction: () => createRng(1) });
  assert.equal(result.walkers[0]?.cargo?.amount, 4);
  assert.deepEqual(result.walkers[0]?.position, { tx: 0, ty: 0 });
  assert.equal(result.buildings[0]?.inventory.bread, 200);
});

test("real simulation ports block wall-side delivery but allow another compound frontage and the gate", async () => {
  const { DEFAULT_GAME_STATE } = await import("../src/state/gameStore");
  const { createSimulationRoutePorts } = await import("../src/engine/simulationPorts");
  const state = { ...DEFAULT_GAME_STATE, palisade: {
    id: "wall", polygon: [], gate: { x: 4, y: 4 }, segments: [{
      id: "wall-side", order: 0, completed: true, constructionSiteId: null,
      tileCount: 6, edgePath: [{ x: 4, y: 0 }, { x: 4, y: 6 }],
    }],
  } };
  const { delivery, roaming } = createSimulationRoutePorts(state);
  const compound = { ...house, tx: 2, ty: 1, width: 2, height: 1 };
  assert.equal(delivery.canTraverse?.({ tx: 3, ty: 1 }, { tx: 4, ty: 1 }), false);
  assert.equal(roaming.canServiceHouse?.({ tx: 4, ty: 1 }, compound), false);
  assert.equal(roaming.canServiceHouse?.({ tx: 2, ty: 2 }, compound), true);
  assert.equal(roaming.canServiceHouse?.({ tx: 4, ty: 3 }, { ...house, tx: 3, ty: 3 }), true);
});

test("a completed wall blocking the final frontage cancels instead of depositing at an obsolete access", () => {
  const initial = spawnCarters({ tick: 80, buildings: [
    building("producer", "logging_camp", { inventory: { logs: 3 } }),
    building("store", "storehouse"),
  ], walkers: [], inventory: DELIVERY_INVENTORY,
  routes: routePort({ "producer->store": line([0, 0], [1, 0]) }) });
  const carter = initial.walkers[0];
  assert.ok(carter?.kind === "carter");
  const routes = {
    ...routePort({ "1,0->producer": line([1, 0], [0, 0]),
      "1,0->store": line([1, 0], [1, 1], [2, 1]) }),
    canAccessDestination: (tile: { readonly tx: number; readonly ty: number }) => tile.ty === 1,
  };
  const result = stepCarters({ tick: 81, buildings: initial.buildings,
    walkers: [{ ...carter, position: { tx: 1, ty: 0 }, pathIndex: 1 }],
    inventory: DELIVERY_INVENTORY, routes });
  const returning = result.walkers[0];
  assert.ok(returning?.kind === "carter");
  assert.equal(returning.cancellation?.reason, "road_removed");
  assert.deepEqual(returning.cargo, { resource: "logs", amount: 3 });
  assert.equal(result.buildings.find((b) => b.id === "store")?.inventory.logs ?? 0, 0);
  assert.equal(result.buildings.find((b) => b.id === "store")?.reserved.logs ?? 0, 0);
});

test("real ports cancel loaded traffic when its destination frontage is walled off mid-route", async () => {
  const { DEFAULT_GAME_STATE } = await import("../src/state/gameStore");
  const { createSimulationRoutePorts } = await import("../src/engine/simulationPorts");
  const state = { ...DEFAULT_GAME_STATE, width: 8, height: 8, palisade: null,
    buildings: [building("producer", "logging_camp", { inventory: { logs: 3 } }),
      building("store", "storehouse", { tx: 3, ty: 2 })],
    constructionSites: [], walkers: [], pathCache: {},
    tiles: Array.from({ length: 64 }, (_, i) => ({ tx: i % 8, ty: Math.floor(i / 8),
      terrain: "grass" as const, hasRoad: Math.floor(i / 8) === 1, buildingId: null })),
  };
  const spawned = spawnCarters({ tick: 80, buildings: state.buildings, walkers: [],
    inventory: DELIVERY_INVENTORY, routes: createSimulationRoutePorts(state).delivery });
  assert.equal(spawned.walkers.length, 1);
  const blocked = { ...state, palisade: { id: "wall", polygon: [], gate: { x: 7, y: 2 }, segments: [{
    id: "barrier", order: 0, completed: true, constructionSiteId: null, tileCount: 8,
    edgePath: [{ x: 0, y: 2 }, { x: 8, y: 2 }],
  }] } };
  let current = { buildings: spawned.buildings, walkers: spawned.walkers };
  for (let tick = 81; tick < 140; tick += 1) {
    current = stepCarters({ tick, ...current, inventory: DELIVERY_INVENTORY,
      routes: createSimulationRoutePorts({ ...blocked, buildings: [...current.buildings] }).delivery });
  }
  assert.equal(current.buildings.find((b) => b.id === "store")?.inventory.logs ?? 0, 0);
  assert.equal(current.buildings.find((b) => b.id === "producer")?.inventory.logs, 3);
  assert.equal(current.walkers.length, 0);
});
