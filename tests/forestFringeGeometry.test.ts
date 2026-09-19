import assert from "node:assert/strict";
import test from "node:test";
import { forestEdgeContour } from "../src/render/forestFringeGeometry";
import { screenToTile } from "../src/render/iso";

test("forest edge stays within eligible grass tile for all directions and seeds", () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let seed = 0; seed < 128; seed += 1) {
      for (const point of forestEdgeContour(4, 4, dx, dy, seed, 4.2)) {
        const tile = screenToTile(point.x, point.y);
        assert.ok(Math.abs(tile.tx - 4) <= 0.500001);
        assert.ok(Math.abs(tile.ty - 4) <= 0.500001);
      }
    }
  }
});

test("forest edge conceals the straight join with stable seed-varying material extent", () => {
  const points = forestEdgeContour(4, 4, 1, 0, 73, 4.2);
  assert.deepEqual(points, forestEdgeContour(4, 4, 1, 0, 73, 4.2));
  assert.notDeepEqual(points, forestEdgeContour(4, 4, 1, 0, 74, 4.2));
  assert.ok(points.some((point) => screenToTile(point.x, point.y).tx < 4.4));
});
