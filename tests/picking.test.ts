import assert from "node:assert/strict";
import test from "node:test";

import { canvasToWorld, clientToCanvas } from "../src/render/camera";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import {
  containsPointInTile,
  pickTile,
  tileCenter,
} from "../src/render/picking";

const EDGE_EPSILON = 1e-6;

test("tileCenter returns the isometric tile centre", () => {
  const origin = tileToScreen(0, 0);
  const negative = tileToScreen(2, -1);

  assert.deepEqual(tileCenter(0, 0), { x: origin.sx, y: origin.sy });
  assert.deepEqual(tileCenter(2, -1), { x: negative.sx, y: negative.sy });
});

test("pickTile picks tile centres exactly", () => {
  assert.deepEqual(pickTile(tileCenter(0, 0)), { tx: 0, ty: 0 });
  assert.deepEqual(pickTile(tileCenter(4, 3)), { tx: 4, ty: 3 });
});

test("pickTile handles negative tile coordinates", () => {
  assert.deepEqual(pickTile(tileCenter(-3, -2)), { tx: -3, ty: -2 });
  assert.deepEqual(pickTile(tileCenter(-4, 1)), { tx: -4, ty: 1 });
});

test("containsPointInTile includes points just inside all four diamond edges", () => {
  const center = tileCenter(2, -1);
  const points = [
    { x: center.x, y: center.y - TILE_H / 2 + EDGE_EPSILON },
    { x: center.x + TILE_W / 2 - EDGE_EPSILON, y: center.y },
    { x: center.x, y: center.y + TILE_H / 2 - EDGE_EPSILON },
    { x: center.x - TILE_W / 2 + EDGE_EPSILON, y: center.y },
  ];

  for (const point of points) {
    assert.equal(containsPointInTile(point, { tx: 2, ty: -1 }), true);
    assert.deepEqual(pickTile(point), { tx: 2, ty: -1 });
  }
});

test("pickTile returns a tile whose diamond contains sampled world points", () => {
  for (let tx = -3; tx <= 3; tx += 1) {
    for (let ty = -3; ty <= 3; ty += 1) {
      const center = tileCenter(tx, ty);
      for (let dx = -24; dx <= 24; dx += 12) {
        for (let dy = -10; dy <= 10; dy += 5) {
          const point = { x: center.x + dx, y: center.y + dy };

          if (!containsPointInTile(point, { tx, ty })) {
            continue;
          }

          const picked = pickTile(point);
          if (picked === null) {
            assert.fail("expected sampled contained point to pick a tile");
          }
          assert.equal(containsPointInTile(point, picked), true);
        }
      }
    }
  }
});

test("pickTile accepts world points derived from camera-transformed client points", () => {
  const worldCenter = tileCenter(3, -2);
  const camera = { zoom: 1.5, panX: 120, panY: 40 };
  const clientPoint = {
    clientX: worldCenter.x * camera.zoom + camera.panX + 10,
    clientY: worldCenter.y * camera.zoom + camera.panY + 20,
  };
  const canvasPoint = clientToCanvas(clientPoint, {
    left: 10,
    top: 20,
    width: 800,
    height: 450,
  });
  const worldPoint = canvasToWorld(canvasPoint, camera);

  assert.deepEqual(pickTile(worldPoint), { tx: 3, ty: -2 });
});
