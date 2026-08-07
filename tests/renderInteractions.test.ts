import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import {
  placementPreview,
  releaseTileFromMouseUp,
  resolveBuildingPlacementAttempt,
  resolveRoadPlacementAttempt,
} from "../src/render/interactions";
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
  constructionSites: [],
  wallTick: 0,
  era: "hamlet",
  eraProclaimedTick: null,
  palisade: null,
  nextConstructionOrdinal: 1,
  houses: [],
  walkers: [],
  population: 0,
  idleWorkers: 0,
  treasuryTimber: 20,
  roadRevision: 0,
  pathCache: {},
  forestHarvests: [],
} satisfies GameState;

const roadState = {
  ...state,
  width: 3,
  height: 1,
  tiles: [
    tile(0, 0, "grass"),
    tile(1, 0, "grass"),
    tile(2, 0, "grass"),
  ],
} satisfies GameState;

test("road preview reports out of bounds for invalid road drag endpoints", () => {
  // Given / When
  const preview = placementPreview(state, "road", { tx: 3, ty: 1 }, { tx: 1, ty: 1 });

  // Then
  assert.equal(preview.ok, false);
  assert.equal(preview.reason, PlacementFailure.out_of_bounds);
});

test("road preview covers every path tile and reports the modeled zero timber cost", () => {
  // Given / When
  const preview = placementPreview(state, "road", { tx: 1, ty: 1 }, { tx: 1, ty: 0 });

  // Then
  assert.deepEqual(preview.roadPath, [
    { tx: 1, ty: 0 },
    { tx: 1, ty: 1 },
  ]);
  assert.equal(preview.timberCost, 0);
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
    timberCost: null,
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

test("building placement attempts preflight invalid outcomes without dispatching and keep the tool armed", () => {
  // Given / When
  const attempt = resolveBuildingPlacementAttempt({
    state,
    tool: "house",
    tile: { tx: 1, ty: 0 },
    nowMs: 10,
  });

  // Then
  assert.equal(attempt.action, null);
  assert.equal(attempt.keepToolArmed, true);
  assert.deepEqual(attempt.feedback, {
    kind: "failure",
    message: "물 위에는 지을 수 없습니다",
    anchor: { kind: "tile", tile: { tx: 1, ty: 0 } },
    createdAtMs: 10,
    expiresAtMs: 4510,
  });
});

test("building placement attempts dispatch a valid building exactly once with success feedback", () => {
  // Given / When
  const attempt = resolveBuildingPlacementAttempt({
    state,
    tool: "well",
    tile: { tx: 0, ty: 0 },
    nowMs: 20,
  });

  // Then
  assert.deepEqual(attempt.action, {
    type: "place_building",
    kind: "well",
    tx: 0,
    ty: 0,
  });
  assert.equal(attempt.keepToolArmed, true);
  assert.deepEqual(attempt.feedback, {
    kind: "success",
    message: "건설했습니다",
    anchor: { kind: "tile", tile: { tx: 0, ty: 0 } },
    createdAtMs: 20,
    expiresAtMs: 620,
  });
});

test("road placement attempts evaluate the whole path before dispatching", () => {
  // Given / When
  const attempt = resolveRoadPlacementAttempt({
    state,
    start: { tx: 0, ty: 0 },
    destination: { tx: 1, ty: 0 },
    nowMs: 30,
  });

  // Then
  assert.equal(attempt.action, null);
  assert.equal(attempt.keepToolArmed, true);
  assert.deepEqual(attempt.feedback, {
    kind: "failure",
    message: "물 위에는 지을 수 없습니다",
    anchor: {
      kind: "path",
      path: [
        { tx: 0, ty: 0 },
        { tx: 1, ty: 0 },
      ],
    },
    createdAtMs: 30,
    expiresAtMs: 4530,
  });
});

test("road placement attempts dispatch a valid road once and keep modeled road cost zero", () => {
  // Given / When
  const attempt = resolveRoadPlacementAttempt({
    state: roadState,
    start: { tx: 0, ty: 0 },
    destination: { tx: 2, ty: 0 },
    nowMs: 40,
  });

  // Then
  assert.deepEqual(attempt.action, {
    type: "place_road_line",
    start: { tx: 0, ty: 0 },
    destination: { tx: 2, ty: 0 },
  });
  assert.equal(attempt.keepToolArmed, true);
  assert.deepEqual(attempt.feedback, {
    kind: "success",
    message: "길을 놓았습니다 · 목재 0",
    anchor: {
      kind: "path",
      path: [
        { tx: 0, ty: 0 },
        { tx: 1, ty: 0 },
        { tx: 2, ty: 0 },
      ],
    },
    createdAtMs: 40,
    expiresAtMs: 640,
  });
});
