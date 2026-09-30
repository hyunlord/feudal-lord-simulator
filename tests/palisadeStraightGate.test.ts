/**
 * FIX-11 (12): gates prefer straight-segment ring points over corners.
 * Tests cover `isStraightRingPoint` classification and the synthetic ring shape.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isStraightRingPoint,
} from "../src/engine/palisadeSegments";
import type { TileEdgePoint } from "../src/world/palisadeGeometry";

/**
 * A closed 3×2 rectangle ring (path corners: (0,0),(3,0),(3,2),(0,2)).
 * Ring points with the duplicate first/last removed — 10 points:
 *
 *   0:(0,0)  1:(1,0)  2:(2,0)  3:(3,0)
 *   9:(0,1)                    4:(3,1)
 *   8:(0,2)  7:(1,2)  6:(2,2)  5:(3,2)
 *
 * Straight (same axis before and after): 1,2,4,6,7,9
 * Corner   (axis changes):               0,3,5,8
 */
const RECT_RING: readonly TileEdgePoint[] = [
  { x: 0, y: 0 }, // 0 corner: prev=(0,1) next=(1,0) — neither x nor y constant across the triple
  { x: 1, y: 0 }, // 1 straight: y=0 across prev,point,next
  { x: 2, y: 0 }, // 2 straight: y=0 across prev,point,next
  { x: 3, y: 0 }, // 3 corner
  { x: 3, y: 1 }, // 4 straight: x=3 across prev,point,next
  { x: 3, y: 2 }, // 5 corner
  { x: 2, y: 2 }, // 6 straight: y=2 across prev,point,next
  { x: 1, y: 2 }, // 7 straight: y=2
  { x: 0, y: 2 }, // 8 corner
  { x: 0, y: 1 }, // 9 straight: x=0 across prev,point,next
];

test("isStraightRingPoint identifies interior edge points as straight", () => {
  const straightIndices = [1, 2, 4, 6, 7, 9];
  for (const index of straightIndices) {
    assert.equal(
      isStraightRingPoint(RECT_RING, index),
      true,
      `index ${index} should be straight`,
    );
  }
});

test("isStraightRingPoint identifies corner points as not straight", () => {
  const cornerIndices = [0, 3, 5, 8];
  for (const index of cornerIndices) {
    assert.equal(
      isStraightRingPoint(RECT_RING, index),
      false,
      `index ${index} should be a corner`,
    );
  }
});

test("isStraightRingPoint returns false for rings shorter than 3 points", () => {
  const short: readonly TileEdgePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  assert.equal(isStraightRingPoint(short, 0), false);
  assert.equal(isStraightRingPoint(short, 1), false);
});

test("isStraightRingPoint wraps around for the first and last indices", () => {
  // Index 0 in RECT_RING uses index 9 (last) as predecessor — it is a corner.
  assert.equal(isStraightRingPoint(RECT_RING, 0), false, "index 0 wraps to use last as prev");
  // Index 9 (last) uses index 8 as predecessor and index 0 as successor — x=0 for all three → straight.
  assert.equal(isStraightRingPoint(RECT_RING, 9), true, "index 9 wraps to use first as next");
});
