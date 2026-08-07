import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import type { GameState } from "../src/engine/engine.types";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { visibleTilesInDrawOrder } from "../src/render/renderVisibility";
import type { Tile } from "../src/world/world.types";

function tile(
  tx: number,
  ty: number,
  terrain: Tile["terrain"] = "grass",
  buildingId: string | null = null,
): Tile {
  return { tx, ty, terrain, buildingId, hasRoad: false };
}

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function walker(id: string, tx: number, ty: number): Walker {
  return {
    id,
    kind: "carter",
    homeBuildingId: "building-1",
    destination: { kind: "building", buildingId: "building-1" },
    mission: "deliver",
    phase: "outbound",
    cargo: null,
    path: [{ tx, ty }],
    pathIndex: 0,
    previousTile: null,
    position: { tx, ty },
    spawnedTick: 0,
    reservation: {
      destination: { kind: "building", buildingId: "building-1" },
      resource: "timber",
      amount: 0,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    cancellation: null,
  };
}

function worldState(input: {
  readonly seed: number;
  readonly tiles: Tile[];
  readonly width: number;
  readonly height: number;
  readonly buildings?: Building[];
  readonly walkers?: Walker[];
  readonly forestHarvests?: GameState["forestHarvests"];
}): GameState {
  return {
    tick: 0,
    seed: input.seed,
    tiles: input.tiles,
    width: input.width,
    height: input.height,
    buildings: input.buildings ?? [],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: input.walkers ?? [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: input.forestHarvests ?? [],
  };
}

test("objectRenderItemsForFrame reuses the static object queue when only walkers move", () => {
  // Given
  const tiles = [
    tile(0, 0, "grass", "building-1"),
    tile(1, 0, "forest"),
    tile(0, 1),
    tile(1, 1),
  ];
  const state = worldState({
    seed: 7,
    tiles,
    width: 2,
    height: 2,
    buildings: [building("building-1", "house", 0, 0)],
    walkers: [walker("walker-1", 0, 1)],
  });
  const range = { minTx: 0, minTy: 0, maxTx: 1, maxTy: 1 } as const;
  objectRenderItemsForFrame({ state, visibleTiles: tiles, range, includeGroundCover: false });
  const originalSort = Array.prototype.sort;
  let sortCalls = 0;
  const countingSort: typeof Array.prototype.sort = function <T>(
    this: T[],
    compareFn?: (left: T, right: T) => number,
  ): T[] {
    sortCalls += 1;
    return originalSort.call(this, compareFn);
  };
  let secondFrame: ReturnType<typeof objectRenderItemsForFrame> = [];

  // When
  Array.prototype.sort = countingSort;
  try {
    secondFrame = objectRenderItemsForFrame({
      state: { ...state, tick: 1, walkers: [walker("walker-1", 1, 1)] },
      visibleTiles: tiles,
      range,
      includeGroundCover: false,
    });
  } finally {
    Array.prototype.sort = originalSort;
  }

  // Then
  assert.equal(sortCalls, 0, `expected static queue cache to avoid Array.sort, got ${sortCalls}`);
  assert.deepEqual(
    secondFrame.map((item) => `${item.kind}:${item.id}`),
    ["building:building-1", "walker:walker-1"],
  );
});

test("objectRenderItemsForFrame invalidates static cache when culling changes visible tiles", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) =>
    tile(index % 3, Math.floor(index / 3), index === 0 ? "forest" : "grass"),
  );
  const state = worldState({ seed: 11, tiles, width: 3, height: 3 });
  const rectRange = { minTx: 0, minTy: 0, maxTx: 2, maxTy: 2 } as const;
  const culledRange = {
    ...rectRange,
    minDepth: 4,
    maxDepth: 4,
    minDiagonal: 0,
    maxDiagonal: 0,
  } as const;

  // When
  const fullFrame = objectRenderItemsForFrame({
    state,
    visibleTiles: visibleTilesInDrawOrder({ grid: state, range: rectRange }),
    range: rectRange,
    includeGroundCover: false,
  });
  const culledFrame = objectRenderItemsForFrame({
    state,
    visibleTiles: visibleTilesInDrawOrder({ grid: state, range: culledRange }),
    range: culledRange,
    includeGroundCover: false,
  });

  // Then
  assert.ok(fullFrame.some((item) => item.kind === "tree"), "expected setup to cache a tree");
  assert.deepEqual(culledFrame.map((item) => `${item.kind}:${item.id}`), []);
});

test("objectRenderItemsForFrame excludes buildings outside depth and diagonal culling", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const state = worldState({
    seed: 13,
    tiles,
    width: 3,
    height: 3,
    buildings: [building("building-culled", "house", 2, 2)],
  });
  const range = {
    minTx: 0,
    minTy: 0,
    maxTx: 2,
    maxTy: 2,
    minDepth: 0,
    maxDepth: 0,
    minDiagonal: 0,
    maxDiagonal: 0,
  } as const;

  // When
  const items = objectRenderItemsForFrame({
    state,
    visibleTiles: visibleTilesInDrawOrder({ grid: state, range }),
    range,
    includeGroundCover: false,
  });

  // Then
  assert.deepEqual(items.map((item) => `${item.kind}:${item.id}`), []);
});

test("objectRenderItemsForFrame excludes walkers outside depth and diagonal culling", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const state = worldState({
    seed: 17,
    tiles,
    width: 3,
    height: 3,
    walkers: [walker("walker-culled", 2, 2)],
  });
  const range = {
    minTx: 0,
    minTy: 0,
    maxTx: 2,
    maxTy: 2,
    minDepth: 0,
    maxDepth: 0,
    minDiagonal: 0,
    maxDiagonal: 0,
  } as const;

  // When
  const items = objectRenderItemsForFrame({
    state,
    visibleTiles: visibleTilesInDrawOrder({ grid: state, range }),
    range,
    includeGroundCover: false,
  });

  // Then
  assert.deepEqual(items.map((item) => `${item.kind}:${item.id}`), []);
});

test("objectRenderItemsForFrame includes a building when any footprint tile is visible", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const state = worldState({
    seed: 19,
    tiles,
    width: 3,
    height: 3,
    buildings: [building("building-partial", "storehouse", 1, 1)],
  });
  const range = {
    minTx: 0,
    minTy: 0,
    maxTx: 2,
    maxTy: 2,
    minDepth: 4,
    maxDepth: 4,
    minDiagonal: 0,
    maxDiagonal: 0,
  } as const;

  // When
  const items = objectRenderItemsForFrame({
    state,
    visibleTiles: visibleTilesInDrawOrder({ grid: state, range }),
    range,
    includeGroundCover: false,
  });

  // Then
  assert.deepEqual(items.map((item) => `${item.kind}:${item.id}`), ["building:building-partial"]);
});
