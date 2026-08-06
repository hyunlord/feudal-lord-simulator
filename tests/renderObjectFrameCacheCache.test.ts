import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import type { GameState } from "../src/engine/engine.types";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
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
    destinationBuildingId: "building-1",
    mission: "deliver",
    phase: "outbound",
    cargo: null,
    path: [{ tx, ty }],
    pathIndex: 0,
    previousTile: null,
    position: { tx, ty },
    spawnedTick: 0,
    reservation: {
      destinationBuildingId: "building-1",
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
}): GameState {
  return {
    tick: 0,
    seed: input.seed,
    tiles: input.tiles,
    width: input.width,
    height: input.height,
    buildings: input.buildings ?? [],
    houses: [],
    walkers: input.walkers ?? [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
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
