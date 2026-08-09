import assert from "node:assert/strict";
import test from "node:test";

import { visibleTilesInDrawOrder, type TileRange } from "../src/render/visibleTiles";
import type { Grid } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad: false };
}

function grid(width: number, height: number): Grid {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) =>
      tile(index % width, Math.floor(index / width)),
    ),
  };
}

test("visibleTilesInDrawOrder reads only range coordinates by row-major index", () => {
  // Given
  const source = grid(64, 64);
  const range: TileRange = { minTx: 10, minTy: 20, maxTx: 11, maxTy: 21 };

  // When
  const tiles = visibleTilesInDrawOrder(source, range);

  // Then
  assert.deepEqual(
    tiles.map((candidate) => `${candidate.tx},${candidate.ty}`),
    ["10,20", "11,20", "10,21", "11,21"],
  );
});

test("visibleTilesInDrawOrder clamps ranges to grid bounds", () => {
  // Given
  const source = grid(3, 2);
  const range: TileRange = { minTx: -2, minTy: -1, maxTx: 1, maxTy: 0 };

  // When
  const tiles = visibleTilesInDrawOrder(source, range);

  // Then
  assert.deepEqual(
    tiles.map((candidate) => `${candidate.tx},${candidate.ty}`),
    ["0,0", "1,0"],
  );
});
