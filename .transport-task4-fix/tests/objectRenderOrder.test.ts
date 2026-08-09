import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { objectRenderItems, type TileRange } from "../src/render/objectRenderOrder";
import type { GameState } from "../src/engine/engine.types";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, patch: Partial<Tile> = {}): Tile {
  return {
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
    ...patch,
  };
}

function state(tiles: readonly Tile[], buildings: readonly Building[] = []): GameState {
  return {
    tick: 0,
    seed: 1,
    tiles: [...tiles],
    width: 4,
    height: 4,
    buildings: [...buildings],
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 100,
  };
}

const FULL_RANGE: TileRange = { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 };

test("objectRenderItems draws rear building before foreground tree regardless input order", () => {
  // Given
  const building: Building = {
    id: "house-1-1",
    kind: "house",
    tx: 1,
    ty: 1,
    workers: 0,
    inventory: {},
    productionProgress: 0,
  };
  const world = state([tile(1, 2, { terrain: "forest" })], [building]);

  // When
  const items = objectRenderItems(world, FULL_RANGE);

  // Then
  assert.deepEqual(items.map((item) => item.kind), ["building", "tree"]);
  assert.equal(items[0]?.id, "house-1-1");
});

test("objectRenderItems building order is independent of insertion order", () => {
  // Given
  const west: Building = {
    id: "house-west",
    kind: "house",
    tx: 0,
    ty: 2,
    workers: 0,
    inventory: {},
    productionProgress: 0,
  };
  const east: Building = { ...west, id: "house-east", tx: 1, ty: 1 };

  // When
  const first = objectRenderItems(state([], [west, east]), FULL_RANGE);
  const second = objectRenderItems(state([], [east, west]), FULL_RANGE);

  // Then
  assert.deepEqual(
    first.map((item) => item.id),
    second.map((item) => item.id),
  );
});

test("objectRenderItems omits forest road tree candidates", () => {
  // Given
  const world = state([tile(1, 1, { terrain: "forest", hasRoad: true })]);

  // When
  const items = objectRenderItems(world, FULL_RANGE);

  // Then
  assert.deepEqual(items, []);
});

test("objectRenderItems includes a 2x2 building whose footprint overlaps the visible range", () => {
  // Given
  const building: Building = {
    id: "farm-0-0",
    kind: "wheat_farm",
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: {},
    productionProgress: 0,
  };
  const range: TileRange = { minTx: 1, minTy: 1, maxTx: 1, maxTy: 1 };

  // When
  const items = objectRenderItems(state([], [building]), range);

  // Then
  assert.deepEqual(items.map((item) => item.id), ["farm-0-0"]);
});
