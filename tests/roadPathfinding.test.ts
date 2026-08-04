import assert from "node:assert/strict";
import test from "node:test";

import type { Grid } from "../src/world/grid";
import { findExistingRoadPath } from "../src/world/roadGraph";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, hasRoad = false): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad };
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

function setRoads(
  grid: Grid,
  coordinates: readonly { readonly tx: number; readonly ty: number }[],
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

test("findExistingRoadPath returns the deterministic NESW shortest road path", () => {
  // Given
  const grid = setRoads(grassGrid(5, 5), [
    { tx: 2, ty: 2 },
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 4, ty: 2 },
    { tx: 3, ty: 3 },
    { tx: 4, ty: 3 },
  ]);

  // When
  const path = findExistingRoadPath(grid, {
    start: { tx: 2, ty: 2 },
    destination: { tx: 4, ty: 2 },
  });

  // Then
  assert.deepEqual(path, [
    { tx: 2, ty: 2 },
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 4, ty: 2 },
  ]);
});

test("findExistingRoadPath returns null when endpoints are not connected road tiles", () => {
  // Given
  const grid = setRoads(grassGrid(4, 3), [
    { tx: 0, ty: 1 },
    { tx: 1, ty: 1 },
    { tx: 3, ty: 1 },
  ]);

  // When / Then
  assert.equal(
    findExistingRoadPath(grid, {
      start: { tx: 0, ty: 1 },
      destination: { tx: 3, ty: 1 },
    }),
    null,
  );
  assert.equal(
    findExistingRoadPath(grid, {
      start: { tx: 0, ty: 0 },
      destination: { tx: 1, ty: 1 },
    }),
    null,
  );
});
