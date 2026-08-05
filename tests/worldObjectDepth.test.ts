import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
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
  const grassTile = tile(3, 0, "grass");

  // When
  const items = buildObjectRenderItems({
    tiles: [...forestTiles, grassTile],
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
    seed: 1,
  });

  // Then
  assert.equal(items.filter((item) => item.kind === "tree").length, 3);
});
