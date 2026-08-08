import assert from "node:assert/strict";
import test from "node:test";

import type { DistributorWalker } from "../src/agents/walker.types";
import { BALANCE } from "../src/content/balanceConfig";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import {
  createDistributorRouteHistory,
  observeDistributorRouteHistory,
  routeHistoryForGranary,
} from "../src/ui/distributorRouteHistory";
import type { TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

interface StateInput {
  readonly buildings: readonly Building[];
  readonly roads: readonly TileCoordinate[];
  readonly tick?: number;
}

const road = (tx: number, ty: number): TileCoordinate => ({ tx, ty });

function building(id: string, tx: number, ty: number): Building {
  return {
    id,
    kind: "granary",
    tx,
    ty,
    workers: 0,
    inventory: { bread: BALANCE.DISTRIBUTOR_CAPACITY },
    reserved: {},
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

  for (let ty = 0; ty < 8; ty += 1) {
    for (let tx = 0; tx < 8; tx += 1) {
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
    tick: input.tick ?? 0,
    seed: 1,
    tiles,
    width: 8,
    height: 8,
    buildings: [...input.buildings],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 1,
    pathCache: {},
    forestHarvests: [],
  };
}

function onlyDistributor(state: GameState): DistributorWalker {
  const walker = state.walkers[0];
  assert.equal(state.walkers.length, 1);
  assert.equal(walker?.kind, "distributor");
  return walker;
}

test("a granary distributor starts from the connected access when the first access road is isolated", () => {
  // Given
  const granary = building("granary-a", 4, 4);
  const state = buildState({
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 1,
    buildings: [granary],
    roads: [
      road(4, 3),
      road(3, 4),
      road(3, 5),
      road(2, 5),
    ],
  });
  const routes = createSimulationRoutePorts(state).roaming;

  // When
  const homePath = routes.homePath("granary-a");
  const spawned = advanceTick(state);
  const moving = advanceTick(spawned);

  // Then
  assert.deepEqual(homePath, [road(3, 4)]);
  assert.deepEqual(onlyDistributor(spawned).path, [road(3, 4)]);
  assert.deepEqual(onlyDistributor(moving).path, [road(3, 4), road(3, 5)]);
});

test("a granary distributor chooses the largest road component over a sorted-first dead end", () => {
  const granary = building("granary-a", 4, 4);
  const state = buildState({
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 1,
    buildings: [granary],
    roads: [
      road(4, 3),
      road(4, 2),
      road(3, 4),
      road(3, 5),
      road(2, 5),
      road(1, 5),
    ],
  });
  const routes = createSimulationRoutePorts(state).roaming;

  const homePath = routes.homePath("granary-a");
  const spawned = advanceTick(state);
  const moving = advanceTick(spawned);

  assert.deepEqual(homePath, [road(3, 4)]);
  assert.deepEqual(onlyDistributor(spawned).path, [road(3, 4)]);
  assert.deepEqual(onlyDistributor(moving).path, [road(3, 4), road(3, 5)]);
});

test("presentation route history records a completed distributor branch from real tick transitions", () => {
  // Given
  const granary = building("granary-a", 4, 4);
  const initial = buildState({
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 1,
    buildings: [granary],
    roads: [
      road(3, 4),
      road(3, 5),
      road(2, 5),
      road(1, 5),
    ],
  });
  let history = createDistributorRouteHistory();
  let current = advanceTick(initial);

  // When
  for (let step = 0; step < 1_000; step += 1) {
    const next = advanceTick(current);
    history = observeDistributorRouteHistory({
      previousState: current,
      nextState: next,
      history,
    });
    current = next;
    if (routeHistoryForGranary(history, "granary-a").length > 0) break;
  }

  // Then
  const completed = routeHistoryForGranary(history, "granary-a");
  assert.equal(completed.length, 1);
  assert.equal(completed[0]?.granaryId, "granary-a");
  assert.equal(completed[0]?.branchLabel, "서쪽 가지");
  assert.ok((completed[0]?.coordinates.length ?? 0) > 0);
});
