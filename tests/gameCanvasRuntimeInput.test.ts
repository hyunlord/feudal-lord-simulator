import assert from "node:assert/strict";
import test from "node:test";

import { canvasToWorld } from "../src/render/camera";
import {
  advanceCameraMotion,
  cameraInputKeyDown,
  cameraInputKeyUp,
  createCameraInputState,
  shouldAdvanceCameraMotion,
  updateCameraEdgePoint,
} from "../src/render/gameCanvasRuntimeInput";
import { beginCanvasDrag, advanceCanvasDrag } from "../src/render/canvasDragResolution";
import { zoomAtPoint } from "../src/render/interactions";

const VIEWPORT = { width: 400, height: 300 } as const;
const WORLD = { minX: -10_000, minY: -10_000, maxX: 10_000, maxY: 10_000 } as const;
const CAMERA = { zoom: 1, panX: 0, panY: 0 } as const;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to equal ${expected}`);
}

test("left-button movement within three pixels remains a click without panning", () => {
  // Given
  const started = beginCanvasDrag({
    button: 0,
    point: { x: 100, y: 100 },
    hover: { tx: 1, ty: 1 },
    spacePressed: false,
    selectedTool: null,
  });

  // When
  const result = advanceCanvasDrag({
    drag: started.drag,
    point: { x: 103, y: 100 },
    camera: CAMERA,
  });

  // Then
  assert.equal(result.drag.moved, false);
  assert.equal(result.suppressClick, false);
  assert.deepEqual(result.camera, CAMERA);
});

test("left-button movement past ten pixels pans one-to-one from the drag origin", () => {
  // Given
  const started = beginCanvasDrag({
    button: 0,
    point: { x: 100, y: 100 },
    hover: { tx: 1, ty: 1 },
    spacePressed: false,
    selectedTool: null,
  });

  // When
  const result = advanceCanvasDrag({
    drag: started.drag,
    point: { x: 110, y: 94 },
    camera: CAMERA,
  });

  // Then
  assert.equal(result.drag.moved, true);
  assert.equal(result.suppressClick, true);
  assert.deepEqual(result.camera, { zoom: 1, panX: 10, panY: -6 });
});

test("middle-button movement past threshold pans one-to-one from the drag origin", () => {
  // Given
  const started = beginCanvasDrag({
    button: 1,
    point: { x: 40, y: 50 },
    hover: { tx: 1, ty: 1 },
    spacePressed: false,
    selectedTool: "road",
  });

  // When
  const result = advanceCanvasDrag({
    drag: started.drag,
    point: { x: 52, y: 64 },
    camera: CAMERA,
  });

  // Then
  assert.equal(started.drag.mode, "pan");
  assert.equal(result.drag.moved, true);
  assert.deepEqual(result.camera, { zoom: 1, panX: 12, panY: 14 });
});

test("space plus left-button movement pans instead of road dragging", () => {
  // Given
  const started = beginCanvasDrag({
    button: 0,
    point: { x: 80, y: 90 },
    hover: { tx: 1, ty: 1 },
    spacePressed: true,
    selectedTool: "road",
  });

  // When
  const result = advanceCanvasDrag({
    drag: started.drag,
    point: { x: 70, y: 105 },
    camera: CAMERA,
  });

  // Then
  assert.equal(started.drag.mode, "pan");
  assert.equal(result.drag.moved, true);
  assert.deepEqual(result.camera, { zoom: 1, panX: -10, panY: 15 });
});

test("active camera pan drag suppresses keyboard and edge motion during raf", () => {
  // Given
  const state = createCameraInputState();
  cameraInputKeyDown(state, "ArrowRight", 4_000);
  updateCameraEdgePoint(state, { x: 390, y: 150 });
  const started = beginCanvasDrag({
    button: 0,
    point: { x: 100, y: 100 },
    hover: { tx: 1, ty: 1 },
    spacePressed: false,
    selectedTool: null,
  });
  const dragged = advanceCanvasDrag({
    drag: started.drag,
    point: { x: 112, y: 100 },
    camera: CAMERA,
  });

  // When
  const shouldAdvance = shouldAdvanceCameraMotion(dragged.drag);

  // Then
  assert.equal(shouldAdvance, false);
  assert.deepEqual(dragged.camera, { zoom: 1, panX: 12, panY: 0 });
});

test("keyboard panning ramps from eight to twenty-four tiles per second", () => {
  // Given
  const state = createCameraInputState();
  cameraInputKeyDown(state, "ArrowRight", 1_000);

  // When
  const early = advanceCameraMotion({
    input: state,
    camera: CAMERA,
    nowMs: 1_100,
    previousMs: 1_000,
    viewport: VIEWPORT,
    world: WORLD,
  });
  const ramped = advanceCameraMotion({
    input: state,
    camera: CAMERA,
    nowMs: 1_500,
    previousMs: 1_400,
    viewport: VIEWPORT,
    world: WORLD,
  });

  // Then
  assertAlmostEqual(early.panX, -640 / 10);
  assertAlmostEqual(ramped.panX, -1_536 / 10);
});

test("keyboard panning decays after release instead of stopping abruptly", () => {
  // Given
  const state = createCameraInputState();
  cameraInputKeyDown(state, "d", 2_000);
  cameraInputKeyUp(state, "d", 2_500);

  // When
  const decaying = advanceCameraMotion({
    input: state,
    camera: CAMERA,
    nowMs: 2_600,
    previousMs: 2_500,
    viewport: VIEWPORT,
    world: WORLD,
  });
  const settled = advanceCameraMotion({
    input: state,
    camera: CAMERA,
    nowMs: 2_900,
    previousMs: 2_800,
    viewport: VIEWPORT,
    world: WORLD,
  });

  // Then
  assert.ok(decaying.panX < 0);
  assert.ok(decaying.panX > -154);
  assert.deepEqual(settled, CAMERA);
});

test("edge panning starts within twenty pixels of the viewport edge", () => {
  // Given
  const state = createCameraInputState();
  updateCameraEdgePoint(state, { x: 385, y: 150 });

  // When
  const camera = advanceCameraMotion({
    input: state,
    camera: CAMERA,
    nowMs: 3_100,
    previousMs: 3_000,
    viewport: VIEWPORT,
    world: WORLD,
  });

  // Then
  assert.ok(camera.panX < 0);
  assert.equal(camera.panY, 0);
});

test("wheel zoom keeps the world point under the cursor stationary", () => {
  // Given
  const canvasPoint = { x: 320, y: 80 };
  const camera = { zoom: 1, panX: 40, panY: -20 };
  const before = canvasToWorld(canvasPoint, camera);

  // When
  const zoomed = zoomAtPoint({ camera, canvasPoint, deltaY: -100, viewport: VIEWPORT, world: WORLD });
  const after = canvasToWorld(canvasPoint, zoomed);

  // Then
  assertAlmostEqual(after.x, before.x);
  assertAlmostEqual(after.y, before.y);
});
