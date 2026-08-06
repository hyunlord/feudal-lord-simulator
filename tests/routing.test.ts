import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { ConstructionSite } from "../src/economy/construction";
import type { GameState, RoadPathCache } from "../src/engine/engine.types";
import {
  buildingRoadAccessTiles,
  resolveBuildingToConstructionSiteRoute,
  resolveBuildingRoute,
  resolveRoadToConstructionSiteRoute,
  resolveRoadToBuildingRoute,
} from "../src/engine/routing";
import type { Grid, TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, patch: Partial<Tile> = {}): Tile {
  return {
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
    ...patch,
  };
}

function grassGrid(width: number, height: number): Grid {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return tile(tx, ty);
    }),
  };
}

function building(
  id: string,
  kind: Building["kind"],
  origin: TileCoordinate,
): Building {
  return {
    id,
    kind,
    tx: origin.tx,
    ty: origin.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function constructionSite(
  id: string,
  origin: TileCoordinate,
): ConstructionSite {
  return {
    id,
    kind: "well",
    tx: origin.tx,
    ty: origin.ty,
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

function worldFromGrid(
  grid: Grid,
  buildings: readonly Building[],
  pathCache: RoadPathCache = {},
  constructionSites: readonly ConstructionSite[] = [],
): GameState {
  return {
    tick: 0,
    seed: 1,
    tiles: [...grid.tiles],
    width: grid.width,
    height: grid.height,
    buildings: [...buildings],
    constructionSites: [...constructionSites],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 7,
    pathCache,
  };
}

function setRoads(
  grid: Grid,
  coordinates: readonly TileCoordinate[],
): Grid {
  return {
    ...grid,
    tiles: grid.tiles.map((candidate) =>
      coordinates.some(
        (coordinate) => coordinate.tx === candidate.tx && coordinate.ty === candidate.ty,
      )
        ? { ...candidate, hasRoad: true }
        : candidate,
    ),
  };
}

test("buildingRoadAccessTiles enumerates 2x2 orthogonal road access sorted by y then x", () => {
  // Given
  const storehouse = building("storehouse-a", "storehouse", { tx: 2, ty: 2 });
  const grid = setRoads(grassGrid(7, 7), [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 1, ty: 2 },
    { tx: 4, ty: 2 },
    { tx: 1, ty: 3 },
    { tx: 4, ty: 3 },
    { tx: 2, ty: 4 },
    { tx: 3, ty: 4 },
    { tx: 1, ty: 1 },
    { tx: 4, ty: 4 },
  ]);

  // When
  const accessTiles = buildingRoadAccessTiles(grid, storehouse);

  // Then
  assert.deepEqual(accessTiles, [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 1, ty: 2 },
    { tx: 4, ty: 2 },
    { tx: 1, ty: 3 },
    { tx: 4, ty: 3 },
    { tx: 2, ty: 4 },
    { tx: 3, ty: 4 },
  ]);
});

test("resolveBuildingRoute chooses the shortest deterministic access-pair road path", () => {
  // Given
  const source = building("farm-a", "wheat_farm", { tx: 1, ty: 1 });
  const destination = building("mill-a", "mill", { tx: 6, ty: 2 });
  const grid = setRoads(grassGrid(9, 7), [
    { tx: 2, ty: 0 },
    { tx: 2, ty: 1 },
    { tx: 2, ty: 3 },
    { tx: 3, ty: 3 },
    { tx: 4, ty: 3 },
    { tx: 5, ty: 3 },
    { tx: 6, ty: 3 },
    { tx: 6, ty: 1 },
    { tx: 7, ty: 2 },
  ]);
  const state = worldFromGrid(grid, [source, destination]);

  // When
  const result = resolveBuildingRoute(state, source, destination);

  // Then
  assert.deepEqual(result.path, [
    { tx: 2, ty: 3 },
    { tx: 3, ty: 3 },
    { tx: 4, ty: 3 },
    { tx: 5, ty: 3 },
    { tx: 6, ty: 3 },
  ]);
  assert.deepEqual(result.pathCache, {
    "road:7:farm-a->mill-a": result.path,
  });
});

test("resolveRoadToBuildingRoute connects the current road tile to the nearest building access", () => {
  // Given
  const destination = building("granary-a", "granary", { tx: 5, ty: 2 });
  const grid = setRoads(grassGrid(9, 6), [
    { tx: 1, ty: 3 },
    { tx: 2, ty: 3 },
    { tx: 3, ty: 3 },
    { tx: 4, ty: 3 },
    { tx: 5, ty: 4 },
  ]);
  const state = worldFromGrid(grid, [destination]);

  // When
  const path = resolveRoadToBuildingRoute(state, { tx: 1, ty: 3 }, destination);

  // Then
  assert.deepEqual(path, [
    { tx: 1, ty: 3 },
    { tx: 2, ty: 3 },
    { tx: 3, ty: 3 },
    { tx: 4, ty: 3 },
  ]);
});

test("resolveBuildingRoute reuses forward and reverse cached building-pair paths", () => {
  // Given
  const source = building("logging-a", "logging_camp", { tx: 1, ty: 1 });
  const destination = building("sawmill-a", "sawmill", { tx: 5, ty: 1 });
  const cachedPath = [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ];
  const forwardState = worldFromGrid(grassGrid(7, 4), [source, destination], {
    "road:7:logging-a->sawmill-a": cachedPath,
  });
  const reverseState = worldFromGrid(grassGrid(7, 4), [source, destination], {
    "road:7:sawmill-a->logging-a": [...cachedPath].reverse(),
  });

  // When
  const forward = resolveBuildingRoute(forwardState, source, destination);
  const reverse = resolveBuildingRoute(reverseState, source, destination);

  // Then
  assert.equal(forward.path, cachedPath);
  assert.deepEqual(forward.pathCache, forwardState.pathCache);
  assert.deepEqual(reverse.path, cachedPath);
  assert.deepEqual(reverse.pathCache, {
    ...reverseState.pathCache,
    "road:7:logging-a->sawmill-a": cachedPath,
  });
});

test("resolveBuildingRoute ignores stale revision cache entries and returns null without caching failures", () => {
  // Given
  const source = building("house-a", "house", { tx: 1, ty: 1 });
  const destination = building("well-a", "well", { tx: 4, ty: 1 });
  const state = worldFromGrid(grassGrid(6, 4), [source, destination], {
    "road:6:house-a->well-a": [
      { tx: 2, ty: 1 },
      { tx: 3, ty: 1 },
    ],
  });

  // When
  const result = resolveBuildingRoute(state, source, destination);

  // Then
  assert.equal(result.path, null);
  assert.deepEqual(result.pathCache, state.pathCache);
});

test("construction-site routes use tagged cache keys and road-to-site access", () => {
  // Given
  const source = building("storehouse-a", "storehouse", { tx: 1, ty: 1 });
  const target = constructionSite("construction-site-000001", { tx: 5, ty: 1 });
  const grid = setRoads(grassGrid(8, 4), [
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ]);
  const state = worldFromGrid(grid, [source], {}, [target]);

  // When
  const first = resolveBuildingToConstructionSiteRoute(state, source, target);
  const cached = resolveBuildingToConstructionSiteRoute(
    { ...state, pathCache: first.pathCache },
    source,
    target,
  );
  const roadToSite = resolveRoadToConstructionSiteRoute(
    state,
    { tx: 3, ty: 1 },
    target,
  );

  // Then
  assert.deepEqual(first.path, [
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ]);
  assert.deepEqual(cached.path, first.path);
  assert.deepEqual(cached.pathCache, {
    "road:7:storehouse-a->construction_site:construction-site-000001": first.path,
  });
  assert.deepEqual(roadToSite, [
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ]);
});
