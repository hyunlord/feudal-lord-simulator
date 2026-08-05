import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { placementPreview, releaseTileFromMouseUp } from "../src/render/interactions";
import { PlacementFailure } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, terrain: Tile["terrain"], occupied = false): Tile {
  return { tx, ty, terrain, buildingId: occupied ? "occupied" : null, hasRoad: false };
}

const state = {
  tick: 0,
  seed: 1,
  width: 2,
  height: 2,
  tiles: [
    tile(0, 0, "grass"),
    tile(1, 0, "water"),
    tile(0, 1, "grass", true),
    tile(1, 1, "forest"),
  ],
  buildings: [],
  houses: [],
  walkers: [],
  population: 0,
  idleWorkers: 0,
  treasuryTimber: 20,
  roadRevision: 0,
  pathCache: {},
} satisfies GameState;

test("road preview reports out of bounds for invalid road drag endpoints", () => {
  // Given / When
  const preview = placementPreview(state, "road", { tx: 3, ty: 1 }, { tx: 1, ty: 1 });

  // Then
  assert.equal(preview.ok, false);
  assert.equal(preview.reason, PlacementFailure.out_of_bounds);
});

test("cancelled placement preview is inert even when hovering a buildable tile", () => {
  // Given / When
  const preview = placementPreview(state, null, { tx: 0, ty: 0 }, null);

  // Then
  assert.deepEqual(preview, {
    tool: null,
    tile: null,
    footprint: [],
    roadPath: [],
    ok: true,
    reason: null,
    cursor: null,
  });
});

test("road preview reports occupied for existing structures or roads", () => {
  // Given / When
  const preview = placementPreview(state, "road", { tx: 0, ty: 1 }, null);

  // Then
  assert.equal(preview.ok, false);
  assert.equal(preview.reason, PlacementFailure.occupied);
});

test("road preview reports wrong terrain for water tiles", () => {
  // Given / When
  const preview = placementPreview(state, "road", { tx: 1, ty: 0 }, null);

  // Then
  assert.equal(preview.ok, false);
  assert.equal(preview.reason, PlacementFailure.wrong_terrain);
});

test("road release endpoint is recomputed from an inside mouseup event", () => {
  // Given
  const rect = { left: 10, top: 20, width: 320, height: 180 };
  const camera = { zoom: 1, panX: 170, panY: 20 };

  // When
  const tile = releaseTileFromMouseUp({ clientX: 212, clientY: 88 }, rect, camera);

  // Then
  assert.deepEqual(tile, { tx: 2, ty: 1 });
});

test("road release endpoint is ignored when mouseup lands outside the canvas rect", () => {
  // Given
  const rect = { left: 10, top: 20, width: 320, height: 180 };
  const camera = { zoom: 1, panX: 170, panY: 20 };

  // When
  const tile = releaseTileFromMouseUp({ clientX: 400, clientY: 56 }, rect, camera);

  // Then
  assert.equal(tile, null);
});
