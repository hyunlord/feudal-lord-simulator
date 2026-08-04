import assert from "node:assert/strict";
import test from "node:test";

import { TERRAIN_TYPES, type TerrainType } from "../src/content/terrainConfig";
import { buildWorldGrid, generateTerrainTile, terrainVariation } from "../src/world/terrain";

test("generateTerrainTile returns deterministic mixed terrain when building a 64x64 world", () => {
  // Given
  const first = buildWorldGrid({ width: 64, height: 64, seed: 1 });
  const second = buildWorldGrid({ width: 64, height: 64, seed: 1 });

  // When
  const firstTerrains = first.tiles.map((tile) => tile.terrain);
  const secondTerrains = second.tiles.map((tile) => tile.terrain);

  // Then
  assert.deepEqual(firstTerrains, secondTerrains);
  for (const terrain of TERRAIN_TYPES) {
    assert.ok(
      firstTerrains.includes(terrain),
      `expected generated world to include ${terrain}`,
    );
  }
});

test("generateTerrainTile is stable for positive and negative coordinates", () => {
  const samples = [
    { tx: 0, ty: 0 },
    { tx: 8, ty: 13 },
    { tx: -7, ty: 5 },
    { tx: 3, ty: -11 },
    { tx: -19, ty: -23 },
  ] as const;

  for (const sample of samples) {
    // Given / When
    const first = generateTerrainTile(sample.tx, sample.ty, 1);
    const second = generateTerrainTile(sample.tx, sample.ty, 1);

    // Then
    assert.equal(first, second);
    assert.ok(
      TERRAIN_TYPES.includes(first),
      `expected ${String(first)} to be a terrain type`,
    );
  }
});

test("terrainVariation is deterministic, bounded, and varies nearby tiles", () => {
  // Given
  const coordinates = [
    { tx: 0, ty: 0 },
    { tx: 1, ty: 0 },
    { tx: 0, ty: 1 },
    { tx: -1, ty: 0 },
    { tx: -1, ty: -1 },
  ] as const;

  // When
  const variations = coordinates.map((coordinate) =>
    terrainVariation(coordinate.tx, coordinate.ty, 1),
  );

  // Then
  assert.deepEqual(
    variations,
    coordinates.map((coordinate) => terrainVariation(coordinate.tx, coordinate.ty, 1)),
  );
  assert.ok(
    variations.every((variation) => variation >= -0.06 && variation <= 0.06),
    "expected every terrain variation to stay inside -0.06..0.06",
  );
  assert.ok(new Set(variations).size > 1, "expected nearby tiles to vary");
});

test("buildWorldGrid stores terrain and occupancy only in row-major tile order", () => {
  // Given / When
  const grid = buildWorldGrid({ width: 4, height: 3, seed: 1 });

  // Then
  assert.equal(grid.width, 4);
  assert.equal(grid.height, 3);
  assert.equal(grid.tiles.length, 12);
  assert.deepEqual(
    grid.tiles.map((tile) => ({ tx: tile.tx, ty: tile.ty })),
    [
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 3, ty: 0 },
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 3, ty: 1 },
      { tx: 0, ty: 2 },
      { tx: 1, ty: 2 },
      { tx: 2, ty: 2 },
      { tx: 3, ty: 2 },
    ],
  );
  for (const tile of grid.tiles) {
    const terrain: TerrainType = tile.terrain;
    assert.equal(tile.buildingId, null);
    assert.equal(tile.hasRoad, false);
    assert.ok(TERRAIN_TYPES.includes(terrain));
    assert.equal("variation" in tile, false);
    assert.equal("brightness" in tile, false);
  }
});
