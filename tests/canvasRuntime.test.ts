import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { worldToCanvas } from "../src/render/camera";
import { cameraForStartingHouse } from "../src/render/canvasRuntime";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";

const EPSILON = 1;

function houseAt(id: string, tx: number, ty: number): Building {
  return {
    id,
    kind: "house",
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function nonHouseAt(id: string, tx: number, ty: number): Building {
  return {
    ...houseAt(id, tx, ty),
    kind: "logging_camp",
  };
}

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= EPSILON,
    `expected ${actual} to be within ${EPSILON} CSS px of ${expected}`,
  );
}

function transformedAnchor(building: Building, camera: ReturnType<typeof cameraForStartingHouse>) {
  const anchor = tileToScreen(building.tx, building.ty);
  return worldToCanvas({ x: anchor.sx, y: anchor.sy }, camera);
}

test("cameraForStartingHouse centers the edge starting house in the desktop usable viewport", () => {
  // Given: the canonical edge starting house and a desktop canvas with a 150px console.
  const startingHouse = houseAt("house-0-0-0", 0, 0);
  const canvas = { clientWidth: 1440, clientHeight: 900 };

  // When: the render runtime derives the first camera.
  const camera = cameraForStartingHouse(canvas, {
    width: 64,
    height: 64,
    buildings: [startingHouse],
  });
  const anchor = transformedAnchor(startingHouse, camera);
  const usableCenter = { x: 720, y: 375 };
  const visibleTileSpan = Math.min(
    canvas.clientWidth / (TILE_W * camera.zoom),
    (canvas.clientHeight - 150) / (TILE_H * camera.zoom),
  );

  // Then: the house anchor is centered and the limiting axis frames about 20 isometric tiles.
  assertAlmostEqual(anchor.x, usableCenter.x);
  assertAlmostEqual(anchor.y, usableCenter.y);
  assert.ok(visibleTileSpan >= 18 && visibleTileSpan <= 22);
  assert.ok(camera.zoom >= 0.5 && camera.zoom <= 2);
});

test("cameraForStartingHouse keeps the edge starting house visible on mobile", () => {
  // Given: the canonical edge starting house and a mobile canvas with a 224px console.
  const startingHouse = houseAt("house-0-0-0", 0, 0);
  const canvas = { clientWidth: 375, clientHeight: 812 };

  // When: the render runtime derives the first camera.
  const camera = cameraForStartingHouse(canvas, {
    width: 64,
    height: 64,
    buildings: [startingHouse],
  });
  const anchor = transformedAnchor(startingHouse, camera);

  // Then: the anchor remains in the usable viewport above the console.
  assert.ok(anchor.x >= 0 && anchor.x <= canvas.clientWidth);
  assert.ok(anchor.y >= 0 && anchor.y <= canvas.clientHeight - 224);
  assert.ok(camera.zoom >= 0.5 && camera.zoom <= 2);
});

test("cameraForStartingHouse prefers the authored Phase 8 starting house before another house", () => {
  // Given: another house appears before the authored starting house.
  const firstHouse = houseAt("house-9-9-0", 9, 9);
  const startingHouse = houseAt("house-46-40-0", 46, 40);

  // When: the camera is derived.
  const camera = cameraForStartingHouse(
    { clientWidth: 1440, clientHeight: 900 },
    {
      width: 64,
      height: 64,
      buildings: [firstHouse, startingHouse],
    },
  );
  const openingCenter = houseAt("opening-center", 45, 41);
  const anchor = transformedAnchor(openingCenter, camera);

  // Then: the authored village center, not the first house, is centered.
  assertAlmostEqual(anchor.x, 720);
  assertAlmostEqual(anchor.y, 375);
});

test("cameraForStartingHouse falls back to the first house when the canonical id is absent", () => {
  // Given: a non-house and a later house.
  const firstHouse = houseAt("house-4-3-0", 4, 3);

  // When: the camera is derived.
  const camera = cameraForStartingHouse(
    { clientWidth: 1440, clientHeight: 900 },
    {
      width: 64,
      height: 64,
      buildings: [nonHouseAt("logging-0-0-0", 0, 0), firstHouse],
    },
  );
  const anchor = transformedAnchor(firstHouse, camera);

  // Then: the first house by kind is centered.
  assertAlmostEqual(anchor.x, 720);
  assertAlmostEqual(anchor.y, 375);
});

test("cameraForStartingHouse returns a finite generic fallback when no house exists", () => {
  // Given: no house is available in the state.
  const canvas = { clientWidth: 1440, clientHeight: 900 };

  // When: the camera is derived.
  const camera = cameraForStartingHouse(canvas, {
    width: 64,
    height: 64,
    buildings: [nonHouseAt("logging-0-0-0", 0, 0)],
  });

  // Then: every camera component is finite and zoom remains clamped.
  assert.equal(Number.isFinite(camera.zoom), true);
  assert.equal(Number.isFinite(camera.panX), true);
  assert.equal(Number.isFinite(camera.panY), true);
  assert.ok(camera.zoom >= 0.5 && camera.zoom <= 2);
});
