import assert from "node:assert/strict";
import test from "node:test";

import { depthKey } from "../src/render/iso";
import {
  computeVisibleTileRange,
  visibleTilesInDrawOrder,
} from "../src/render/renderVisibility";
import { terrainVariation } from "../src/world/terrain";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad: false };
}

test("computeVisibleTileRange clips iteration so a small viewport never draws every world tile", () => {
  // Given
  const fullTileCount = 64 * 64;

  // When
  const range = computeVisibleTileRange({
    camera: { zoom: 1, panX: 320, panY: 48 },
    viewport: { width: 320, height: 180 },
    world: { width: 64, height: 64 },
  });
  const visibleTileCount =
    (range.maxTx - range.minTx + 1) * (range.maxTy - range.minTy + 1);

  // Then
  assert.ok(visibleTileCount > 0);
  assert.ok(
    visibleTileCount < fullTileCount / 4,
    `expected visible range to be clipped, got ${visibleTileCount}`,
  );
});

test("computeVisibleTileRange includes tall sprite anchors whose tops overhang the viewport", () => {
  // Given / When
  const range = computeVisibleTileRange({
    camera: { zoom: 1, panX: 0, panY: 0 },
    viewport: { width: 64, height: 32 },
    world: { width: 20, height: 20 },
  });

  // Then
  assert.ok(range.maxTy >= 5, `expected house_l3 at ty=5 to stay visible, got ${range.maxTy}`);
});

test("terrain variation remains within plus or minus five percent and frame-stable", () => {
  // Given
  const sample = { tx: 6, ty: 7 };

  // When
  const firstFrame = terrainVariation(sample.tx, sample.ty, 73);
  const secondFrame = terrainVariation(sample.tx, sample.ty, 73);

  // Then
  assert.ok(firstFrame >= -0.05);
  assert.ok(firstFrame <= 0.05);
  assert.deepEqual(secondFrame, firstFrame);
});

test("visibleTilesInDrawOrder returns visible tiles back-to-front by depth key", () => {
  // Given
  const tiles = [
    tile(0, 0),
    tile(1, 0),
    tile(2, 0),
    tile(3, 0),
    tile(0, 1),
    tile(1, 1),
    tile(2, 1),
    tile(3, 1),
  ];

  // When
  const ordered = visibleTilesInDrawOrder({
    grid: { tiles, width: 4, height: 2 },
    range: { minTx: 1, minTy: 1, maxTx: 3, maxTy: 1 },
  });

  // Then
  assert.deepEqual(
    ordered.map((candidate) => depthKey(candidate.tx, candidate.ty)),
    [2, 3, 4],
  );
});

test("visibleTilesInDrawOrder reads only row-major indices inside the clipped range", () => {
  // Given
  const reads: number[] = [];
  const tiles = Array.from({ length: 8 }, (_, index) => tile(index % 4, Math.floor(index / 4)));
  const trackedTiles = new Proxy(tiles, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads.push(Number(property));
      return Reflect.get(target, property, receiver);
    },
  });

  // When
  visibleTilesInDrawOrder({
    grid: { tiles: trackedTiles, width: 4, height: 2 },
    range: { minTx: 1, minTy: 1, maxTx: 2, maxTy: 1 },
  });

  // Then
  assert.deepEqual(reads, [5, 6]);
});

test("visibleTilesInDrawOrder skips range corners outside viewport depth and diagonal bounds", () => {
  // Given
  const tiles = Array.from({ length: 16 }, (_, index) => tile(index % 4, Math.floor(index / 4)));

  // When
  const ordered = visibleTilesInDrawOrder({
    grid: { tiles, width: 4, height: 4 },
    range: {
      minTx: 0,
      minTy: 0,
      maxTx: 3,
      maxTy: 3,
      minDepth: 2,
      maxDepth: 4,
      minDiagonal: -1,
      maxDiagonal: 1,
    },
  });

  // Then
  assert.deepEqual(
    ordered.map((candidate) => `${candidate.tx},${candidate.ty}`),
    ["1,1", "2,1", "1,2", "2,2"],
  );
});

test("visibleTilesInDrawOrder derives clipped draw order without per-frame sorting", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const originalSort = Array.prototype.sort;
  let sortCalls = 0;
  const countingSort: typeof Array.prototype.sort = function <T>(
    this: T[],
    compareFn?: (left: T, right: T) => number,
  ): T[] {
    sortCalls += 1;
    return originalSort.call(this, compareFn);
  };
  let ordered: readonly Tile[] = [];

  // When
  Array.prototype.sort = countingSort;
  try {
    ordered = visibleTilesInDrawOrder({
      grid: { tiles, width: 3, height: 3 },
      range: { minTx: 0, minTy: 0, maxTx: 2, maxTy: 2 },
    });
  } finally {
    Array.prototype.sort = originalSort;
  }

  // Then
  assert.deepEqual(
    ordered.map((candidate) => `${candidate.tx},${candidate.ty}`),
    ["0,0", "1,0", "0,1", "2,0", "1,1", "0,2", "2,1", "1,2", "2,2"],
  );
  assert.equal(sortCalls, 0, `expected draw-order iteration to avoid Array.sort, got ${sortCalls}`);
});

test("visibleTilesInDrawOrder caches repeated visible ranges by tiles identity", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const range = { minTx: 0, minTy: 0, maxTx: 1, maxTy: 1 } as const;

  // When
  const first = visibleTilesInDrawOrder({ grid: { tiles, width: 3, height: 3 }, range });
  const second = visibleTilesInDrawOrder({ grid: { tiles, width: 3, height: 3 }, range });
  const shiftedRange = visibleTilesInDrawOrder({
    grid: { tiles, width: 3, height: 3 },
    range: { minTx: 1, minTy: 1, maxTx: 2, maxTy: 2 },
  });
  const newTilesIdentity = visibleTilesInDrawOrder({
    grid: { tiles: [...tiles], width: 3, height: 3 },
    range,
  });

  // Then
  assert.equal(second, first);
  assert.notEqual(shiftedRange, first);
  assert.notEqual(newTilesIdentity, first);
  assert.deepEqual(
    second.map((candidate) => `${candidate.tx},${candidate.ty}`),
    ["0,0", "1,0", "0,1", "1,1"],
  );
});
