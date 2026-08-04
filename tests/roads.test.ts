import assert from "node:assert/strict";
import test from "node:test";

import type { TerrainType } from "../src/content/terrainConfig";
import type { Grid } from "../src/world/grid";
import {
  canPlaceRoad,
  findRoadPath,
  getOrthogonalRoadNeighbors,
  roadLine,
} from "../src/world/roadGraph";
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

function setTile(grid: Grid, tx: number, ty: number, patch: Partial<Tile>): Grid {
  return {
    ...grid,
    tiles: grid.tiles.map((candidate) =>
      candidate.tx === tx && candidate.ty === ty ? { ...candidate, ...patch } : candidate,
    ),
  };
}

test("canPlaceRoad accepts in-bounds unoccupied grass forest and rock tiles", () => {
  // Given
  const base = grassGrid(3, 3);
  const forest = setTile(base, 1, 1, { terrain: "forest" });
  const rock = setTile(base, 1, 1, { terrain: "rock" });
  const building = setTile(base, 1, 1, { buildingId: "hall" });
  const road = setTile(base, 1, 1, { hasRoad: true });

  // When / Then
  assert.equal(canPlaceRoad(base, { tx: 1, ty: 1 }), true);
  assert.equal(canPlaceRoad(forest, { tx: 1, ty: 1 }), true);
  assert.equal(canPlaceRoad(rock, { tx: 1, ty: 1 }), true);
  assert.equal(canPlaceRoad(base, { tx: -1, ty: 1 }), false);
  assert.equal(canPlaceRoad(base, { tx: 3, ty: 1 }), false);
  assert.equal(canPlaceRoad(building, { tx: 1, ty: 1 }), false);
  assert.equal(canPlaceRoad(road, { tx: 1, ty: 1 }), false);
});

test("canPlaceRoad rejects water tiles", () => {
  // Given
  const water = setTile(grassGrid(3, 3), 1, 1, { terrain: "water" });

  // When
  const result = canPlaceRoad(water, { tx: 1, ty: 1 });

  // Then
  assert.equal(result, false);
});

test("canPlaceRoad rejects fractional and missing row-major tile coordinates", () => {
  // Given
  const grid = {
    width: 2,
    height: 2,
    tiles: [tile(0, 0), tile(1, 0), tile(0, 1)],
  } satisfies Grid;

  // When / Then
  assert.equal(canPlaceRoad(grid, { tx: 0.5, ty: 0 }), false);
  assert.equal(canPlaceRoad(grid, { tx: 0, ty: 0.5 }), false);
  assert.equal(canPlaceRoad(grid, { tx: 1, ty: 1 }), false);
});

test("roadLine returns continuous inclusive horizontal and vertical lines", () => {
  // Given / When
  const horizontal = roadLine({ tx: 1, ty: 2 }, { tx: 4, ty: 2 });
  const vertical = roadLine({ tx: 3, ty: 4 }, { tx: 3, ty: 1 });

  // Then
  assert.deepEqual(horizontal, [
    { tx: 1, ty: 2 },
    { tx: 2, ty: 2 },
    { tx: 3, ty: 2 },
    { tx: 4, ty: 2 },
  ]);
  assert.deepEqual(vertical, [
    { tx: 3, ty: 4 },
    { tx: 3, ty: 3 },
    { tx: 3, ty: 2 },
    { tx: 3, ty: 1 },
  ]);
});

test("roadLine normalizes diagonal drags onto the dominant axis with horizontal tie break", () => {
  // Given / When
  const horizontalDominant = roadLine({ tx: 1, ty: 1 }, { tx: 5, ty: 3 });
  const verticalDominant = roadLine({ tx: 1, ty: 1 }, { tx: 2, ty: 5 });
  const tied = roadLine({ tx: 1, ty: 1 }, { tx: 4, ty: 4 });

  // Then
  assert.deepEqual(horizontalDominant, [
    { tx: 1, ty: 1 },
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 5, ty: 1 },
  ]);
  assert.deepEqual(verticalDominant, [
    { tx: 1, ty: 1 },
    { tx: 1, ty: 2 },
    { tx: 1, ty: 3 },
    { tx: 1, ty: 4 },
    { tx: 1, ty: 5 },
  ]);
  assert.deepEqual(tied, [
    { tx: 1, ty: 1 },
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ]);
});

test("getOrthogonalRoadNeighbors returns north east south west roads and rejects diagonals", () => {
  // Given
  let grid = grassGrid(5, 5);
  for (const coordinate of [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 2 },
    { tx: 2, ty: 3 },
    { tx: 1, ty: 2 },
    { tx: 1, ty: 1 },
    { tx: 3, ty: 3 },
  ] as const) {
    grid = setTile(grid, coordinate.tx, coordinate.ty, { hasRoad: true });
  }

  // When
  const neighbors = getOrthogonalRoadNeighbors(grid, { tx: 2, ty: 2 });

  // Then
  assert.deepEqual(neighbors, [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 2 },
    { tx: 2, ty: 3 },
    { tx: 1, ty: 2 },
  ]);
});

test("findRoadPath keeps API compatibility by returning a buildable normalized road line", () => {
  // Given
  const grid = setTile(grassGrid(5, 5), 3, 2, { terrain: "water" });

  // When
  const blocked = findRoadPath(grid, {
    start: { tx: 1, ty: 2 },
    destination: { tx: 4, ty: 2 },
  });
  const buildable = findRoadPath(grid, {
    start: { tx: 1, ty: 1 },
    destination: { tx: 4, ty: 3 },
  });

  // Then
  assert.equal(blocked, null);
  assert.deepEqual(buildable, [
    { tx: 1, ty: 1 },
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
  ]);
});
