import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG, type BuildingKind } from "../src/content/buildingConfig";
import type { TerrainType } from "../src/content/terrainConfig";
import type { GameState } from "../src/engine/engine.types";
import { getTile, type Grid } from "../src/world/grid";
import {
  canPlaceBuilding,
  placementSpendableResource,
  PlacementFailure,
} from "../src/world/placement";
import type { Tile } from "../src/world/world.types";

function tile(
  tx: number,
  ty: number,
  terrain: TerrainType = "grass",
  buildingId: string | null = null,
  hasRoad = false,
): Tile {
  return { tx, ty, terrain, buildingId, hasRoad };
}

function gridFromRows(rows: readonly (readonly Tile[])[]): Grid {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    tiles: rows.flat(),
  };
}

function worldFromGrid(grid: Grid, timber = 100): GameState {
  return {
    tick: 0,
    seed: 1,
    tiles: [...grid.tiles],
    width: grid.width,
    height: grid.height,
    buildings: [],
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: timber,
    roadRevision: 0,
    pathCache: {},
  };
}

function setTile(grid: Grid, tx: number, ty: number, patch: Partial<Tile>): Grid {
  return {
    ...grid,
    tiles: grid.tiles.map((candidate) =>
      candidate.tx === tx && candidate.ty === ty ? { ...candidate, ...patch } : candidate,
    ),
  };
}

function grassGrid(width: number, height: number): Grid {
  return gridFromRows(
    Array.from({ length: height }, (_unused, ty) =>
      Array.from({ length: width }, (_ignored, tx) => tile(tx, ty)),
    ),
  );
}

test("BUILDING_CONFIG defines all eight canonical building kinds with distinctive footprints and timber costs", () => {
  // Given / When
  const definitionsByKind = new Map(BUILDING_CONFIG.map((definition) => [definition.kind, definition]));

  // Then
  const expectedKinds = [
    "house",
    "well",
    "storehouse",
    "granary",
    "wheat_farm",
    "mill",
    "logging_camp",
    "sawmill",
  ] as const satisfies readonly BuildingKind[];
  assert.deepEqual([...definitionsByKind.keys()].sort(), [...expectedKinds].sort());
  assert.ok(
    new Set(BUILDING_CONFIG.map((definition) => `${definition.width}x${definition.height}`)).size >= 2,
    "expected a mix of 1x1 and 2x2 footprints",
  );
  for (const definition of BUILDING_CONFIG) {
    assert.ok(definition.name.length > 0);
    assert.ok(definition.kind === "house" || (definition.buildCost.timber ?? 0) > 0);
    assert.ok(definition.width >= 1);
    assert.ok(definition.height >= 1);
  }
  assert.equal(definitionsByKind.get("logging_camp")?.requiresAdjacentTerrain, "forest");
});

test("getTile and isInBounds use row-major coordinates without wrapping negative inputs", () => {
  // Given
  const grid = grassGrid(3, 2);

  // When / Then
  assert.deepEqual(getTile(grid, { tx: 2, ty: 1 }), tile(2, 1));
  assert.equal(getTile(grid, { tx: -1, ty: 0 }), null);
  assert.equal(getTile(grid, { tx: 0, ty: -1 }), null);
  assert.equal(getTile(grid, { tx: 3, ty: 0 }), null);
  assert.equal(getTile(grid, { tx: 0, ty: 2 }), null);
});

test("canPlaceBuilding rejects fractional tile anchors as out_of_bounds", () => {
  // Given
  const world = worldFromGrid(grassGrid(4, 4));

  // When
  const fractionalX = canPlaceBuilding(world, "house", 1.5, 1);
  const fractionalY = canPlaceBuilding(world, "house", 1, 1.5);

  // Then
  assert.deepEqual(fractionalX, {
    ok: false,
    reason: PlacementFailure.out_of_bounds,
  });
  assert.deepEqual(fractionalY, {
    ok: false,
    reason: PlacementFailure.out_of_bounds,
  });
});

test("canPlaceBuilding rejects incomplete row-major tile arrays as out_of_bounds", () => {
  // Given
  const grid = {
    width: 2,
    height: 2,
    tiles: [tile(0, 0), tile(1, 0), tile(0, 1)],
  } satisfies Grid;

  // When
  const result = canPlaceBuilding(worldFromGrid(grid), "house", 1, 1);

  // Then
  assert.deepEqual(result, {
    ok: false,
    reason: PlacementFailure.out_of_bounds,
  });
});

test("canPlaceBuilding returns out_of_bounds before any other placement failure", () => {
  // Given
  const grid = setTile(grassGrid(2, 2), 1, 1, {
    buildingId: "existing",
    terrain: "water",
    hasRoad: true,
  });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid, 0), "storehouse", 1, 1);

  // Then
  assert.deepEqual(result, { ok: false, reason: PlacementFailure.out_of_bounds });
});

test("canPlaceBuilding rejects occupied footprint tiles before terrain checks", () => {
  // Given
  const grid = setTile(grassGrid(4, 4), 1, 1, {
    buildingId: "existing",
    terrain: "water",
  });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid), "house", 1, 1);

  // Then
  assert.deepEqual(result, { ok: false, reason: PlacementFailure.occupied });
});

test("canPlaceBuilding rejects roads as occupied footprint tiles", () => {
  // Given
  const grid = setTile(grassGrid(4, 4), 1, 1, { hasRoad: true });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid), "house", 1, 1);

  // Then
  assert.deepEqual(result, { ok: false, reason: PlacementFailure.occupied });
});

test("canPlaceBuilding rejects water footprint tiles as wrong terrain", () => {
  // Given
  const grid = setTile(grassGrid(4, 4), 1, 1, { terrain: "water" });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid), "house", 1, 1);

  // Then
  assert.deepEqual(result, { ok: false, reason: PlacementFailure.wrong_terrain });
});

test("canPlaceBuilding accepts rock footprint tiles when other requirements pass", () => {
  // Given
  const rockGrid = setTile(grassGrid(4, 4), 1, 1, { terrain: "rock" });
  const grid = setTile(rockGrid, 1, 0, { hasRoad: true });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid), "house", 1, 1);

  // Then
  assert.deepEqual(result, { ok: true });
});

test("canPlaceBuilding requires orthogonal road adjacency and rejects diagonal-only roads", () => {
  // Given
  const diagonalRoad = setTile(grassGrid(5, 5), 0, 0, { hasRoad: true });
  const orthogonalRoad = setTile(grassGrid(5, 5), 1, 0, { hasRoad: true });

  // When
  const diagonalResult = canPlaceBuilding(worldFromGrid(diagonalRoad), "storehouse", 1, 1);
  const orthogonalResult = canPlaceBuilding(worldFromGrid(orthogonalRoad), "storehouse", 1, 1);

  // Then
  assert.deepEqual(diagonalResult, { ok: false, reason: PlacementFailure.needs_road });
  assert.deepEqual(orthogonalResult, { ok: true });
});

test("canPlaceBuilding requires adjacent terrain in the one-tile surrounding ring only", () => {
  // Given
  const noForest = setTile(grassGrid(5, 5), 2, 1, { hasRoad: true });
  const forestInsideFootprint = setTile(noForest, 2, 2, { terrain: "forest" });
  const forestInRing = setTile(noForest, 3, 3, { terrain: "forest" });

  // When
  const missingResult = canPlaceBuilding(worldFromGrid(noForest), "logging_camp", 2, 2);
  const insideResult = canPlaceBuilding(worldFromGrid(forestInsideFootprint), "logging_camp", 2, 2);
  const adjacentResult = canPlaceBuilding(worldFromGrid(forestInRing), "logging_camp", 2, 2);

  // Then
  assert.deepEqual(missingResult, {
    ok: false,
    reason: PlacementFailure.needs_adjacent_terrain,
  });
  assert.deepEqual(insideResult, {
    ok: false,
    reason: PlacementFailure.needs_adjacent_terrain,
  });
  assert.deepEqual(adjacentResult, { ok: true });
});

test("canPlaceBuilding rejects insufficient timber after spatial requirements pass", () => {
  // Given
  const gridWithForest = setTile(grassGrid(5, 5), 3, 3, { terrain: "forest" });
  const grid = setTile(gridWithForest, 2, 1, { hasRoad: true });

  // When
  const result = canPlaceBuilding(worldFromGrid(grid, 0), "logging_camp", 2, 2);

  // Then
  assert.deepEqual(result, {
    ok: false,
    reason: PlacementFailure.insufficient_timber,
  });
});

test("placement spendable timber matches building placement and excludes walker cargo", () => {
  // Given
  const gridWithForest = setTile(grassGrid(5, 5), 3, 3, { terrain: "forest" });
  const grid = setTile(gridWithForest, 2, 1, { hasRoad: true });
  const world = {
    ...worldFromGrid(grid, 5),
    buildings: [{
      id: "store",
      kind: "storehouse" as const,
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: { timber: 10 },
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    }],
    walkers: [{
      id: "cargo",
      kind: "carter" as const,
      homeBuildingId: "store",
      position: { tx: 0, ty: 0 },
      path: [],
      pathIndex: 0,
      previousTile: null,
      cargo: { resource: "timber" as const, amount: 90 },
      spawnedTick: 0,
      mission: "deliver" as const,
      phase: "outbound" as const,
      destinationBuildingId: "store",
      reservation: {
        destinationBuildingId: "store",
        resource: "timber" as const,
        amount: 90,
        sourceStockClaim: null,
        homeCapacityClaim: null,
      },
      cancellation: null,
    }],
  };

  // When
  const spendable = placementSpendableResource(world, "timber");
  const result = canPlaceBuilding(world, "logging_camp", 2, 2);

  // Then
  assert.equal(spendable, 15);
  assert.deepEqual(result, { ok: true });
});
