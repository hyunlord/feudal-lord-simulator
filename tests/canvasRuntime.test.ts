import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { clampPan, worldToCanvas } from "../src/render/camera";
import { cameraAfterViewportResize, cameraForStartingHouse } from "../src/render/canvasRuntime";
import { worldBounds } from "../src/render/interactions";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import { STARTING_LANDMARKS } from "../src/render/startingLandmarks";

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

function openingTableauPoints(): readonly { readonly label: string; readonly x: number; readonly y: number }[] {
  const buildingPoints = DEFAULT_GAME_STATE.buildings.map((building) => {
    const anchor = tileToScreen(building.tx, building.ty);
    return { label: building.id, x: anchor.sx, y: anchor.sy };
  });
  const landmarkPoints = STARTING_LANDMARKS.map((landmark) => {
    const anchor = tileToScreen(landmark.tx, landmark.ty);
    return { label: landmark.kind, x: anchor.sx, y: anchor.sy };
  });
  return [...buildingPoints, ...landmarkPoints];
}

function screenBounds(
  points: readonly { readonly x: number; readonly y: number }[],
  camera: ReturnType<typeof cameraForStartingHouse>,
) {
  const screenPoints = points.map((point) => worldToCanvas(point, camera));
  return {
    minX: Math.min(...screenPoints.map((point) => point.x)),
    maxX: Math.max(...screenPoints.map((point) => point.x)),
    minY: Math.min(...screenPoints.map((point) => point.y)),
    maxY: Math.max(...screenPoints.map((point) => point.y)),
  };
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

test("cameraForStartingHouse centers the opening focus in the responsive viewport above the court console", () => {
  // Given: the measured court-console layout contract at each responsive breakpoint.
  const startingHouse = houseAt("house-0-0-0", 0, 0);
  const scenarios = [
    { width: 901, height: 600, consoleHeight: 150 },
    { width: 900, height: 375, consoleHeight: 276 },
    { width: 640, height: 375, consoleHeight: 276 },
    { width: 601, height: 500, consoleHeight: 276 },
    { width: 600, height: 812, consoleHeight: 224 },
    { width: 375, height: 812, consoleHeight: 224 },
  ];

  for (const scenario of scenarios) {
    const canvas = { clientWidth: scenario.width, clientHeight: scenario.height };

    // When: the render runtime derives the first camera.
    const camera = cameraForStartingHouse(canvas, {
      width: 64,
      height: 64,
      buildings: [startingHouse],
    });
    const anchor = transformedAnchor(startingHouse, camera);

    // Then: the opening focus is centered in the canvas area that remains visible above the console.
    assertAlmostEqual(anchor.x, scenario.width / 2);
    assertAlmostEqual(anchor.y, (scenario.height - scenario.consoleHeight) / 2);
    assert.ok(anchor.y >= 0 && anchor.y <= scenario.height - scenario.consoleHeight);
    assert.ok(camera.zoom >= 0.5 && camera.zoom <= 2);
  }
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

test("cameraAfterViewportResize reframes the untouched opening tableau for responsive safe maps", () => {
  // Given: browser QA starts on desktop, then resizes to the two blocked responsive viewports.
  const desktopCanvas = { clientWidth: 1280, clientHeight: 720 };
  const desktopCamera = cameraForStartingHouse(desktopCanvas, DEFAULT_GAME_STATE);
  const scenarios = [
    { width: 375, height: 812, consoleHeight: 224, topInset: 176 },
    { width: 640, height: 375, consoleHeight: 276, topInset: 0 },
  ];

  for (const scenario of scenarios) {
    const nextCanvas = { clientWidth: scenario.width, clientHeight: scenario.height };

    // When: the runtime receives a resize before any user pan or zoom.
    const camera = cameraAfterViewportResize({
      camera: desktopCamera,
      canvas: nextCanvas,
      state: DEFAULT_GAME_STATE,
      userControlled: false,
    });
    const freshCamera = cameraForStartingHouse(nextCanvas, DEFAULT_GAME_STATE);
    const bounds = screenBounds(openingTableauPoints(), camera);
    const safeBottom = scenario.height - scenario.consoleHeight;

    // Then: it derives the same deterministic opening camera as a fresh responsive load.
    assert.deepEqual(camera, freshCamera);
    assert.ok(bounds.minX >= 0, `${scenario.width}x${scenario.height} tableau left ${bounds.minX}`);
    assert.ok(bounds.maxX <= scenario.width, `${scenario.width}x${scenario.height} tableau right ${bounds.maxX}`);
    assert.ok(bounds.minY >= scenario.topInset, `${scenario.width}x${scenario.height} tableau top ${bounds.minY}`);
    assert.ok(bounds.maxY <= safeBottom, `${scenario.width}x${scenario.height} tableau bottom ${bounds.maxY}`);
  }
});

test("cameraAfterViewportResize preserves a user-controlled camera through clamping", () => {
  // Given: the user has already panned or zoomed the opening map before a responsive resize.
  const userCamera = { zoom: 0.75, panX: 100, panY: -200 };
  const canvas = { clientWidth: 375, clientHeight: 812 };

  // When: the runtime receives a resize after user camera control.
  const camera = cameraAfterViewportResize({
    camera: userCamera,
    canvas,
    state: DEFAULT_GAME_STATE,
    userControlled: true,
  });

  // Then: the runtime preserves the user's zoom/pan intent by using the same world clamp path.
  assert.deepEqual(
    camera,
    clampPan(
      userCamera,
      { width: canvas.clientWidth, height: canvas.clientHeight },
      worldBounds(DEFAULT_GAME_STATE.width, DEFAULT_GAME_STATE.height),
    ),
  );
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
