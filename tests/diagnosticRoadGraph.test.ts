import assert from "node:assert/strict";
import test from "node:test";

import type { Grid, TileCoordinate } from "../src/world/grid";
import { existingRoadComponent, getOrthogonalRoadNeighbors } from "../src/world/roadGraph";
import type { Tile } from "../src/world/world.types";

function roadGrid(
  width: number,
  height: number,
  roads: readonly TileCoordinate[],
): Grid {
  const tiles: Tile[] = Array.from({ length: width * height }, (_unused, index) => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    return {
      tx,
      ty,
      terrain: "grass",
      buildingId: null,
      hasRoad: roads.some((road) => road.tx === tx && road.ty === ty),
    };
  });
  return { width, height, tiles };
}

function bruteRoadComponent(
  grid: Grid,
  starts: readonly TileCoordinate[],
): readonly string[] {
  const frontier = starts.filter(
    (start) => grid.tiles[start.ty * grid.width + start.tx]?.hasRoad === true,
  );
  const visited = new Set<string>();
  for (let index = 0; index < frontier.length; index += 1) {
    const current = frontier[index];
    if (current === undefined) continue;
    const key = `${current.tx},${current.ty}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const neighbor of getOrthogonalRoadNeighbors(grid, current)) {
      const neighborKey = `${neighbor.tx},${neighbor.ty}`;
      if (!visited.has(neighborKey)) frontier.push(neighbor);
    }
  }
  return [...visited].sort();
}

test("existing road component matches an independent BFS for multiple starts", () => {
  // Given
  const grid = roadGrid(7, 5, [
    { tx: 0, ty: 1 },
    { tx: 1, ty: 1 },
    { tx: 2, ty: 1 },
    { tx: 2, ty: 2 },
    { tx: 2, ty: 3 },
    { tx: 3, ty: 3 },
    { tx: 6, ty: 0 },
    { tx: 6, ty: 1 },
  ]);
  const starts = [{ tx: 0, ty: 1 }, { tx: 2, ty: 3 }, { tx: 6, ty: 4 }] as const;

  // When
  const actual = existingRoadComponent(grid, starts)
    .map((tile) => `${tile.tx},${tile.ty}`)
    .sort();

  // Then
  assert.deepEqual(actual, bruteRoadComponent(grid, starts));
});

test("existing road component ignores duplicate and non-road starts", () => {
  // Given
  const grid = roadGrid(3, 2, [{ tx: 1, ty: 0 }, { tx: 1, ty: 1 }]);

  // When
  const component = existingRoadComponent(grid, [
    { tx: 1, ty: 0 },
    { tx: 1, ty: 0 },
    { tx: 0, ty: 0 },
  ]);

  // Then
  assert.deepEqual(component, [{ tx: 1, ty: 0 }, { tx: 1, ty: 1 }]);
});
