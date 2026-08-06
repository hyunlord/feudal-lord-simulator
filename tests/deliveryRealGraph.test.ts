import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker } from "../src/agents/walker.types";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { GameState } from "../src/engine/engine.types";
import { createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import type { TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

type Stock = Partial<Record<ResourceType, number>>;

interface BuildingInput {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Stock;
  readonly reserved?: Stock;
}

interface StateInput {
  readonly buildings: readonly Building[];
  readonly roads: readonly TileCoordinate[];
  readonly walkers?: readonly CarterWalker[];
}

const road = (tx: number, ty: number): TileCoordinate => ({ tx, ty });

function building(input: BuildingInput): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: 0,
    inventory: input.inventory ?? {},
    reserved: input.reserved ?? {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function isBuildingTile(
  coordinate: TileCoordinate,
  candidate: Building,
): boolean {
  const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
  return (
    coordinate.tx >= candidate.tx &&
    coordinate.tx < candidate.tx + definition.width &&
    coordinate.ty >= candidate.ty &&
    coordinate.ty < candidate.ty + definition.height
  );
}

function buildState(input: StateInput): GameState {
  const roadKeys = new Set(input.roads.map(({ tx, ty }) => `${tx},${ty}`));
  const tiles: Tile[] = [];

  for (let ty = 0; ty < 12; ty += 1) {
    for (let tx = 0; tx < 12; tx += 1) {
      const buildingId =
        input.buildings.find((candidate) => isBuildingTile({ tx, ty }, candidate))
          ?.id ?? null;
      tiles.push({
        tx,
        ty,
        terrain: "grass",
        buildingId,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      });
    }
  }

  return {
    tick: 0,
    seed: 1,
    tiles,
    width: 12,
    height: 12,
    buildings: [...input.buildings],
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [...(input.walkers ?? [])],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function removeRoad(state: GameState, removed: TileCoordinate): GameState {
  return {
    ...state,
    roadRevision: state.roadRevision + 1,
    pathCache: {},
    tiles: state.tiles.map((tile) =>
      tile.tx === removed.tx && tile.ty === removed.ty
        ? { ...tile, hasRoad: false }
        : tile,
    ),
  };
}

function findBuilding(state: GameState, id: string): Building {
  const found = state.buildings.find((candidate) => candidate.id === id);
  assert.ok(found);
  return found;
}

function onlyCarter(state: GameState): CarterWalker {
  const walker = state.walkers[0];
  assert.equal(state.walkers.length, 1);
  assert.equal(walker?.kind, "carter");
  return walker;
}

test("a producer chooses the nearest valid store through the real road graph", () => {
  const producer = building({
    id: "producer",
    kind: "logging_camp",
    tx: 2,
    ty: 2,
    inventory: { logs: 12 },
  });
  const near = building({ id: "store-near", kind: "storehouse", tx: 5, ty: 1 });
  const far = building({ id: "store-far", kind: "storehouse", tx: 1, ty: 7 });
  const state = buildState({
    buildings: [producer, far, near],
    roads: [
      road(3, 2),
      road(4, 2),
      road(2, 3),
      road(2, 4),
      road(2, 5),
      road(2, 6),
    ],
  });

  const next = advanceTick(state);
  const carter = onlyCarter(next);

  assert.deepEqual(carter.destination, { kind: "building", buildingId: near.id });
  assert.deepEqual(carter.path, [road(3, 2), road(4, 2)]);
  assert.equal(findBuilding(next, near.id).reserved.logs, 8);
});

test("equal road-distance ties choose the ascending destination building id", () => {
  const producer = building({
    id: "producer",
    kind: "wheat_farm",
    tx: 4,
    ty: 4,
    inventory: { wheat: 3 },
  });
  const storeB = building({ id: "granary-b", kind: "granary", tx: 4, ty: 8 });
  const storeA = building({ id: "granary-a", kind: "granary", tx: 8, ty: 3 });
  const state = buildState({
    buildings: [producer, storeB, storeA],
    roads: [road(5, 4), road(6, 4), road(7, 4), road(4, 5), road(4, 6), road(4, 7)],
  });

  const next = advanceTick(state);

  assert.deepEqual(onlyCarter(next).destination, {
    kind: "building",
    buildingId: storeA.id,
  });
});

test("reservations prevent two producers competing for one final storage slot", () => {
  const first = building({
    id: "producer-a",
    kind: "logging_camp",
    tx: 1,
    ty: 1,
    inventory: { logs: 8 },
  });
  const second = building({
    id: "producer-b",
    kind: "logging_camp",
    tx: 8,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = building({
    id: "store",
    kind: "storehouse",
    tx: 4,
    ty: 1,
    inventory: { timber: 199 },
  });
  const state = buildState({
    buildings: [second, store, first],
    roads: [road(2, 1), road(3, 1), road(6, 1), road(7, 1)],
  });

  const next = advanceTick(state);
  const carter = onlyCarter(next);

  assert.equal(carter.homeBuildingId, first.id);
  assert.deepEqual(carter.cargo, { resource: "logs", amount: 1 });
  assert.equal(findBuilding(next, store.id).reserved.logs, 1);
  assert.equal(findBuilding(next, second.id).inventory.logs, 8);
});

test("a producer with no real road route leaves stock and reservations unchanged", () => {
  const producer = building({
    id: "producer",
    kind: "wheat_farm",
    tx: 1,
    ty: 1,
    inventory: { wheat: 8 },
  });
  const granary = building({ id: "granary", kind: "granary", tx: 6, ty: 1 });
  const state = buildState({
    buildings: [producer, granary],
    roads: [road(2, 1), road(5, 1)],
  });

  const directRoute = createSimulationRoutePorts(state).delivery.betweenBuildings(
    producer.id,
    granary.id,
  );
  const next = advanceTick(state);

  assert.equal(directRoute, null);
  assert.deepEqual(next.walkers, []);
  assert.deepEqual(findBuilding(next, producer.id).inventory, { wheat: 8 });
  assert.deepEqual(findBuilding(next, granary.id).reserved, {});
});

test("road removal mid-journey releases claims and conserves cargo until home arrival despawns", () => {
  const producer = building({
    id: "producer",
    kind: "logging_camp",
    tx: 1,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = building({ id: "store", kind: "storehouse", tx: 5, ty: 1 });
  const spawned = advanceTick(
    buildState({
      buildings: [producer, store],
      roads: [road(2, 1), road(3, 1), road(4, 1)],
    }),
  );

  const cancelled = advanceTick(removeRoad(spawned, road(3, 1)));
  const returning = onlyCarter(cancelled);

  assert.equal(returning.phase, "returning");
  assert.equal(returning.cancellation?.reason, "road_removed");
  assert.deepEqual(returning.cargo, { resource: "logs", amount: 8 });
  assert.deepEqual(findBuilding(cancelled, store.id).reserved, {});
  assert.deepEqual(findBuilding(cancelled, producer.id).inventory, {});

  const finished = advanceTick(cancelled);

  assert.deepEqual(finished.walkers, []);
  assert.deepEqual(findBuilding(finished, producer.id).inventory, { logs: 8 });
  assert.deepEqual(findBuilding(finished, store.id).inventory, {});
});

test("removing the home access behind an outbound carter cancels before delivery", () => {
  const producer = building({
    id: "producer",
    kind: "logging_camp",
    tx: 1,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = building({ id: "store", kind: "storehouse", tx: 5, ty: 1 });
  let midJourney = advanceTick(
    buildState({
      buildings: [producer, store],
      roads: [road(2, 1), road(3, 1), road(4, 1)],
    }),
  );

  for (let tick = 0; onlyCarter(midJourney).pathIndex === 0; tick += 1) {
    assert.ok(tick < 20, "carter should reach the second road tile");
    midJourney = advanceTick(midJourney);
  }

  const cancelled = advanceTick(removeRoad(midJourney, road(2, 1)));
  const returning = onlyCarter(cancelled);

  assert.equal(returning.phase, "returning");
  assert.equal(returning.cancellation?.reason, "road_removed");
  assert.deepEqual(returning.cargo, { resource: "logs", amount: 8 });
  assert.deepEqual(findBuilding(cancelled, store.id).reserved, {});
  assert.deepEqual(findBuilding(cancelled, store.id).inventory, {});

  const recovered = advanceTick(cancelled);

  assert.deepEqual(recovered.walkers, []);
  assert.deepEqual(findBuilding(recovered, producer.id).inventory, { logs: 8 });
  assert.deepEqual(findBuilding(recovered, store.id).inventory, {});
});
