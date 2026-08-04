import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import type { TileRange } from "../src/render/renderer";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, terrain: Tile["terrain"], buildingId: string | null = null, hasRoad = false): Tile {
  return { tx, ty, terrain, buildingId, hasRoad };
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

const range: TileRange = { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 };

test("object render order draws rear buildings before foreground trees regardless input order", () => {
  // Given
  const tiles = [
    tile(1, 1, "forest"),
    tile(0, 0, "grass", "rear"),
  ];

  // When
  const items = buildObjectRenderItems({ tiles, buildings: [building("rear", "house", 0, 0)], range });

  // Then
  assert.deepEqual(items.map((item) => item.kind), ["building", "tree"]);
});

test("building order is independent of construction insertion order", () => {
  // Given
  const first = [building("near", "house", 2, 1), building("far", "house", 0, 0)];
  const second = [building("far", "house", 0, 0), building("near", "house", 2, 1)];

  // When
  const firstOrder = buildObjectRenderItems({ tiles: [], buildings: first, range });
  const secondOrder = buildObjectRenderItems({ tiles: [], buildings: second, range });

  // Then
  assert.deepEqual(
    firstOrder.map((item) => item.id),
    secondOrder.map((item) => item.id),
  );
  assert.deepEqual(firstOrder.map((item) => item.id), ["far", "near"]);
});

test("roads suppress forest tree render items", () => {
  // Given
  const tiles = [tile(1, 1, "forest", null, true)];

  // When
  const items = buildObjectRenderItems({ tiles, buildings: [], range });

  // Then
  assert.deepEqual(items, []);
});

test("buildings render when any configured footprint tile overlaps the visible range", () => {
  // Given
  const overlapOnlyAtFarTile: TileRange = { minTx: 1, minTy: 1, maxTx: 1, maxTy: 1 };

  // When
  const items = buildObjectRenderItems({
    tiles: [],
    buildings: [building("field", "wheat_farm", 0, 0)],
    range: overlapOnlyAtFarTile,
  });

  // Then
  assert.deepEqual(items.map((item) => item.id), ["field"]);
});
