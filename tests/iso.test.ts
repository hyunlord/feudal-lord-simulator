import assert from "node:assert/strict";
import test from "node:test";

import {
  TILE_H,
  TILE_W,
  depthKey,
  screenToTile,
  tileToScreen,
} from "../src/render/iso";

const EPSILON = 1e-9;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= EPSILON,
    `expected ${actual} to be within ${EPSILON} of ${expected}`,
  );
}

test("tileToScreen maps known tile coordinates", () => {
  assert.deepEqual(tileToScreen(0, 0), { sx: 0, sy: 0 });
  assert.deepEqual(tileToScreen(1, 0), { sx: 32, sy: 16 });
  assert.deepEqual(tileToScreen(0, 1), { sx: -32, sy: 16 });
});

test("screenToTile inverts tileToScreen for integer tiles", () => {
  for (let tx = -5; tx <= 5; tx += 1) {
    for (let ty = -5; ty <= 5; ty += 1) {
      const screen = tileToScreen(tx, ty);
      const tile = screenToTile(screen.sx, screen.sy);
      assertAlmostEqual(tile.tx, tx);
      assertAlmostEqual(tile.ty, ty);
    }
  }
});

test("screenToTile preserves fractional tile coordinates", () => {
  const tile = screenToTile(TILE_W / 4, TILE_H / 4);
  assertAlmostEqual(tile.tx, 0.5);
  assertAlmostEqual(tile.ty, 0);
});

test("depthKey orders tiles back-to-front", () => {
  assert.ok(depthKey(1, 1) > depthKey(1, 0));
  assert.ok(depthKey(2, 1) > depthKey(1, 1));
  assert.equal(depthKey(2, 0), depthKey(1, 1));
});
