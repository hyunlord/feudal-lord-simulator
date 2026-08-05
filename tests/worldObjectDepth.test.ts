import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import {
  buildObjectRenderItems,
  groundCoverProtectedTileKeys,
} from "../src/render/objectRenderOrder";
import type { TileRange } from "../src/render/renderer";
import type { Tile } from "../src/world/world.types";

const range: TileRange = { minTx: 0, minTy: 0, maxTx: 6, maxTy: 6 };

function tile(tx: number, ty: number, terrain: Tile["terrain"] = "grass"): Tile {
  return { tx, ty, terrain, buildingId: null, hasRoad: false };
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
    kind: "distributor",
    homeBuildingId: "granary",
    position: { tx, ty },
    path: [{ tx, ty }],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  };
}

test("walkers sort between buildings by fractional anchor depth", () => {
  // Given
  const rear = building("rear-house", "house", 1, 1);
  const front = building("front-house", "house", 3, 3);

  // When
  const items = buildObjectRenderItems({
    tiles: [],
    buildings: [front, rear],
    walkers: [walker("between-walker", 2.25, 2.5)],
    range,
    seed: 19,
  });

  // Then
  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.id}`),
    ["building:rear-house", "walker:between-walker", "building:front-house"],
  );
});

test("building depth uses the forwardmost footprint tile", () => {
  // Given
  const rearWalker = walker("rear-walker", 1, 0.3);
  const largeBuilding = building("granary", "granary", 0, 0);

  // When
  const items = buildObjectRenderItems({
    tiles: [],
    buildings: [largeBuilding],
    walkers: [rearWalker],
    range,
    seed: 19,
  });

  // Then
  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.id}`),
    ["walker:rear-walker", "building:granary"],
  );
});

test("walker depth uses the same visual foot anchor as drawing", () => {
  // Given
  const house = building("house", "house", 1, 2);
  const crossingWalker = walker("crossing-walker", 2.9, 0);

  // When
  const items = buildObjectRenderItems({
    tiles: [],
    buildings: [house],
    walkers: [crossingWalker],
    range,
    seed: 19,
  });

  // Then
  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.id}`),
    ["building:house", "walker:crossing-walker"],
  );
});

test("stable id breaks ties after depth and anchor tx", () => {
  // Given
  const walkers = [walker("walker-b", 2.5, 1.5), walker("walker-a", 2.5, 1.5)];

  // When
  const items = buildObjectRenderItems({ tiles: [], buildings: [], walkers, range, seed: 7 });

  // Then
  assert.deepEqual(items.map((item) => item.id), ["walker-a", "walker-b"]);
});

test("individual trees and ground cover enter the shared object queue", () => {
  // Given
  const forestTiles = [
    tile(1, 1, "forest"),
    tile(0, 1, "forest"),
    tile(2, 1, "forest"),
    tile(1, 0, "forest"),
    tile(1, 2, "forest"),
  ];
  const grassTiles = Array.from({ length: 49 }, (_, index) =>
    tile(index % 7, Math.floor(index / 7), "grass"),
  );

  // When
  const items = buildObjectRenderItems({
    tiles: [...forestTiles, ...grassTiles],
    buildings: [],
    walkers: [],
    range,
    seed: 73,
  });

  // Then
  assert.ok(items.filter((item) => item.kind === "tree").length > 1);
  assert.ok(items.some((item) => item.kind === "groundCover"));
});

test("ground cover descriptors can be skipped outside full detail", () => {
  // Given
  const grassTile = tile(3, 0, "grass");

  // When
  const items = buildObjectRenderItems({
    tiles: [grassTile],
    buildings: [],
    walkers: [],
    range,
    seed: 73,
    includeGroundCover: false,
  });

  // Then
  assert.deepEqual(items, []);
});

test("forest density uses full world neighbors before visible and clearing filters", () => {
  // Given
  const target = tile(4, 4, "forest");
  const worldTiles = [
    target,
    tile(3, 4, "forest"),
    tile(5, 4, "forest"),
    tile(4, 3, "forest"),
    tile(4, 5, "forest"),
  ];

  // When
  const items = buildObjectRenderItems({
    tiles: [target],
    worldTiles,
    buildings: [building("clearing-house", "house", 2, 4)],
    walkers: [],
    range: { minTx: 4, minTy: 4, maxTx: 4, maxTy: 4 },
    seed: 73,
  });

  // Then
  assert.equal(items.filter((item) => item.kind === "tree").length, 2);
});

test("ground cover protection reaches two tiles from every building footprint edge", () => {
  // Given
  const house = building("protected-house", "house", 4, 4);

  // When
  const protectedTiles = groundCoverProtectedTileKeys([], [house]);

  // Then
  for (let ty = 2; ty <= 6; ty += 1) {
    for (let tx = 2; tx <= 6; tx += 1) {
      assert.equal(protectedTiles.has(`${tx}:${ty}`), true, `missing ${tx}:${ty}`);
    }
  }
  assert.equal(protectedTiles.has("1:4"), false);
  assert.equal(protectedTiles.has("7:4"), false);
});

test("ground cover protection reaches two tiles from roads", () => {
  // Given
  const road = { ...tile(4, 4), hasRoad: true };

  // When
  const protectedTiles = groundCoverProtectedTileKeys([road], []);

  // Then
  for (let ty = 2; ty <= 6; ty += 1) {
    for (let tx = 2; tx <= 6; tx += 1) {
      assert.equal(protectedTiles.has(`${tx}:${ty}`), true, `missing ${tx}:${ty}`);
    }
  }
  assert.equal(protectedTiles.has("1:4"), false);
  assert.equal(protectedTiles.has("7:4"), false);
});

test("ground cover protection reuses immutable world geometry across simulation ticks", () => {
  // Given
  const worldTiles = [{ ...tile(4, 4), hasRoad: true }];
  const firstBuildings = [building("house-before-tick", "house", 8, 8)];
  const nextTickBuildings = [building("house-after-tick", "house", 8, 8)];

  // When
  const first = groundCoverProtectedTileKeys(worldTiles, firstBuildings);
  const repeat = groundCoverProtectedTileKeys(worldTiles, nextTickBuildings);

  // Then
  assert.equal(repeat, first);
});

test("the object queue excludes cover within two tiles and permits distance three", () => {
  // Given
  const road = { ...tile(4, 4), hasRoad: true };
  const candidates = Array.from({ length: 4_096 }, (_, index) =>
    tile(index % 64, Math.floor(index / 64)),
  );
  const worldTiles = [...candidates, road];

  // When
  const items = buildObjectRenderItems({
    tiles: candidates,
    worldTiles,
    buildings: [],
    walkers: [],
    range: { minTx: 0, minTy: 0, maxTx: 63, maxTy: 63 },
    seed: 73,
  });
  const coveredTiles = new Set(
    items
      .filter((item) => item.kind === "groundCover")
      .map((item) => {
        const [, tx, ty] = item.id.split(":");
        return `${tx}:${ty}`;
      }),
  );

  // Then
  for (let ty = 2; ty <= 6; ty += 1) {
    for (let tx = 2; tx <= 6; tx += 1) {
      assert.equal(coveredTiles.has(`${tx}:${ty}`), false);
    }
  }
  assert.ok(
    [...coveredTiles].some((key) => {
      const [txText, tyText] = key.split(":");
      const tx = Number(txText);
      const ty = Number(tyText);
      return Math.max(Math.abs(tx - 4), Math.abs(ty - 4)) >= 3;
    }),
  );
});
