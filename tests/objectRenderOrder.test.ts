import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import type { ConstructionSite } from "../src/economy/construction";
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

function constructionSite(id: string, kind: BuildingKind, tx: number, ty: number): ConstructionSite {
  return {
    id,
    kind,
    tx,
    ty,
    required: { timber: 40 },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

const range: TileRange = { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 };

test("object render order draws rear buildings before foreground trees regardless input order", () => {
  // Given
  const tiles = [
    tile(2, 2, "forest"),
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

test("construction site order is stable and independent of input order", () => {
  // Given
  const first = [
    constructionSite("near-site", "storehouse", 2, 1),
    constructionSite("far-site", "storehouse", 0, 0),
  ];
  const second = [
    constructionSite("far-site", "storehouse", 0, 0),
    constructionSite("near-site", "storehouse", 2, 1),
  ];

  // When
  const firstOrder = buildObjectRenderItems({
    tiles: [],
    buildings: [],
    constructionSites: first,
    range,
  });
  const secondOrder = buildObjectRenderItems({
    tiles: [],
    buildings: [],
    constructionSites: second,
    range,
  });

  // Then
  assert.deepEqual(
    firstOrder.map((item) => `${item.kind}:${item.id}`),
    secondOrder.map((item) => `${item.kind}:${item.id}`),
  );
  assert.deepEqual(firstOrder.map((item) => `${item.kind}:${item.id}`), [
    "construction_site:far-site",
    "construction_site:near-site",
  ]);
});
