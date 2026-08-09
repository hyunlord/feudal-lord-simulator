import assert from "node:assert/strict";
import test from "node:test";

import {
  canvasToWorld,
  clampPan,
  clampZoom,
  clientToCanvas,
  worldToCanvas,
} from "../src/render/camera";

const EPSILON = 1e-9;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= EPSILON,
    `expected ${actual} to be within ${EPSILON} of ${expected}`,
  );
}

test("clampZoom clamps zoom to the supported range", () => {
  assert.equal(clampZoom(0.1), 0.5);
  assert.equal(clampZoom(0.5), 0.5);
  assert.equal(clampZoom(1.25), 1.25);
  assert.equal(clampZoom(2), 2);
  assert.equal(clampZoom(3), 2);
});

test("worldToCanvas applies zoom before pan", () => {
  const point = worldToCanvas(
    { x: 12, y: -8 },
    { zoom: 1.5, panX: 20, panY: -10 },
  );

  assertAlmostEqual(point.x, 38);
  assertAlmostEqual(point.y, -22);
});

test("canvasToWorld removes pan before zoom", () => {
  const point = canvasToWorld(
    { x: 38, y: -22 },
    { zoom: 1.5, panX: 20, panY: -10 },
  );

  assertAlmostEqual(point.x, 12);
  assertAlmostEqual(point.y, -8);
});

test("clientToCanvas converts client coordinates to canvas CSS pixels", () => {
  const point = clientToCanvas(
    { clientX: 275, clientY: 140 },
    { left: 200, top: 100, width: 640, height: 360 },
  );

  assert.deepEqual(point, { x: 75, y: 40 });
});

test("clientToCanvas uses CSS pixels without device pixel scaling", () => {
  const point = clientToCanvas(
    { clientX: 450, clientY: 260 },
    { left: 100, top: 60, width: 320, height: 180 },
  );

  assert.deepEqual(point, { x: 350, y: 200 });
});

test("camera transforms client points into world screen coordinates", () => {
  const canvasPoint = clientToCanvas(
    { clientX: 410, clientY: 240 },
    { left: 10, top: 20, width: 800, height: 450 },
  );
  const worldPoint = canvasToWorld(canvasPoint, {
    zoom: 2,
    panX: 80,
    panY: -40,
  });

  assertAlmostEqual(worldPoint.x, 160);
  assertAlmostEqual(worldPoint.y, 130);
});

test("clampPan keeps a large world anchored within a visible margin", () => {
  const bounds = { minX: 0, minY: 0, maxX: 1_000, maxY: 800 };
  const viewport = { width: 300, height: 200 };

  assert.deepEqual(
    clampPan(
      { zoom: 1, panX: 1_000, panY: 1_000 },
      { ...viewport, margin: 32 },
      bounds,
    ),
    { zoom: 1, panX: 32, panY: 32 },
  );
  assert.deepEqual(
    clampPan(
      { zoom: 1, panX: -1_000, panY: -1_000 },
      { ...viewport, margin: 32 },
      bounds,
    ),
    { zoom: 1, panX: -732, panY: -632 },
  );
});

test("clampPan centers a small world inside the viewport", () => {
  const camera = clampPan(
    { zoom: 1, panX: -500, panY: 500 },
    { width: 400, height: 300, margin: 40 },
    { minX: 0, minY: 0, maxX: 160, maxY: 80 },
  );

  assert.deepEqual(camera, { zoom: 1, panX: 120, panY: 110 });
});
