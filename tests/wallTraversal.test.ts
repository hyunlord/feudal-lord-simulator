import assert from "node:assert/strict";
import test from "node:test";
import { findExistingRoadPath } from "../src/world/roadGraph";
import { canTraverseWallBoundary, type WallGrid } from "../src/world/wallTraversal";
import type { TileEdgePoint } from "../src/world/palisadeGeometry";

function grid(path: readonly TileEdgePoint[], gate = { x: 3, y: 3 }, completed = true): WallGrid {
  return {
    width: 7, height: 7,
    tiles: Array.from({ length: 49 }, (_, index) => ({ tx: index % 7, ty: Math.floor(index / 7), terrain: "grass", buildingId: null, hasRoad: true })),
    palisade: { gate, segments: [{ completed, edgePath: path }] },
  };
}

test("completed wall blocks both directions except both center lanes at its gate", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 7 }]);
  for (let ty = 0; ty < 7; ty += 1) {
    const left = { tx: 2, ty }; const right = { tx: 3, ty };
    assert.equal(canTraverseWallBoundary(state, left, right), ty === 2 || ty === 3);
    assert.equal(canTraverseWallBoundary(state, right, left), ty === 2 || ty === 3);
  }
});

test("planned segments do not block but completion changes the same road graph", () => {
  const path = [{ x: 3, y: 0 }, { x: 3, y: 7 }];
  assert.equal(canTraverseWallBoundary(grid(path, { x: 3, y: 3 }, false), { tx: 2, ty: 0 }, { tx: 3, ty: 0 }), true);
  const route = findExistingRoadPath(grid(path), { start: { tx: 2, ty: 0 }, destination: { tx: 3, ty: 0 } });
  assert.ok(route);
  assert.ok(route.some(point => point.ty === 2));
});

test("diagonal walls block endpoint touches and collinear travel outside the opening", () => {
  const state = grid([{ x: 0, y: 0 }, { x: 7, y: 7 }]);
  assert.equal(canTraverseWallBoundary(state, { tx: 0, ty: 1 }, { tx: 1, ty: 1 }), false);
  assert.equal(canTraverseWallBoundary(state, { tx: 0, ty: 0 }, { tx: 1, ty: 1 }), false);
  assert.equal(canTraverseWallBoundary(state, { tx: 2, ty: 3 }, { tx: 3, ty: 3 }), true);
});

test("corner opening admits turns but does not excuse an unrelated crossing wall", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 3 }, { x: 7, y: 3 }]);
  assert.equal(canTraverseWallBoundary(state, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), true);
  assert.equal(canTraverseWallBoundary(state, { tx: 3, ty: 2 }, { tx: 3, ty: 3 }), true);
  assert.ok(state.palisade);
  const overlapping: WallGrid = { ...state, palisade: { ...state.palisade, segments: [...state.palisade.segments, { completed: true, edgePath: [{ x: 2, y: 4 }, { x: 4, y: 2 }] }] } };
  assert.equal(canTraverseWallBoundary(overlapping, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), true);
  const unrelated: WallGrid = { ...state, palisade: { ...state.palisade, segments: [...state.palisade.segments, { completed: true, edgePath: [{ x: 2, y: 3 }, { x: 4, y: 1 }] }] } };
  assert.equal(canTraverseWallBoundary(unrelated, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), false);
});

test("no palisade preserves plain grids and long access hops cannot tunnel", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 7 }]);
  assert.equal(canTraverseWallBoundary({ ...state, palisade: null }, { tx: 0, ty: 0 }, { tx: 6, ty: 0 }), true);
  assert.equal(canTraverseWallBoundary(state, { tx: 0, ty: 0 }, { tx: 6, ty: 0 }), false);
});

test("gate traversal is invariant under rotation, path reversal, and segment installation order", () => {
  for (let turns = 0; turns < 4; turns += 1) {
    const rotate = (point: TileEdgePoint): TileEdgePoint => {
      let result = point;
      for (let index = 0; index < turns; index += 1) result = { x: 6 - result.y, y: result.x };
      return result;
    };
    const tile = (tx: number, ty: number) => {
      const point = rotate({ x: tx + 0.5, y: ty + 0.5 });
      return { tx: point.x - 0.5, ty: point.y - 0.5 };
    };
    for (const reverse of [false, true]) {
      const points = [{ x: 3, y: 0 }, { x: 3, y: 3 }, { x: 3, y: 6 }].map(rotate);
      if (reverse) points.reverse();
      const a = points[0]; const b = points[1]; const c = points[2];
      assert.ok(a && b && c);
      const state = grid(points);
      for (const segments of [
        [{ completed: true, edgePath: [a, b] }, { completed: true, edgePath: [b, c] }],
        [{ completed: true, edgePath: [b, c] }, { completed: true, edgePath: [a, b] }],
      ]) {
        const split = { ...state, palisade: { gate: { x: 3, y: 3 }, segments } };
        assert.equal(canTraverseWallBoundary(split, tile(2, 2), tile(3, 2)), true);
        assert.equal(canTraverseWallBoundary(split, tile(2, 3), tile(3, 3)), true);
        assert.equal(canTraverseWallBoundary(split, tile(2, 0), tile(3, 0)), false);
      }
    }
  }
});

test("a diagonal wall cannot seed a road component or zero-length route on solid masonry", () => {
  const state = grid([{ x: 0, y: 0 }, { x: 7, y: 7 }]);
  assert.equal(findExistingRoadPath(state, { start: { tx: 1, ty: 1 }, destination: { tx: 1, ty: 1 } }), null);
  assert.deepEqual(findExistingRoadPath(state, { start: { tx: 3, ty: 3 }, destination: { tx: 3, ty: 3 } }), [{ tx: 3, ty: 3 }]);
});

test("repeated edge queries stay correct across topology completion and grid dimensions", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 7 }], { x: 3, y: 3 }, false);
  const a = { tx: 2, ty: 0 }; const b = { tx: 3, ty: 0 };
  assert.ok(state.palisade);
  for (let i = 0; i < 3; i += 1) assert.equal(canTraverseWallBoundary(state, a, b), true);
  const complete = { ...state, palisade: { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed: true })) } };
  for (const width of [7, 14, 7]) {
    const resized = { ...complete, width };
    assert.equal(canTraverseWallBoundary(resized, a, b), false);
    assert.equal(canTraverseWallBoundary(resized, b, a), false);
    assert.equal(canTraverseWallBoundary(resized, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), true);
  }
});

test("fractional and long access queries retain exact collision after cached neighbor queries", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 7 }]);
  assert.equal(canTraverseWallBoundary(state, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), true);
  assert.equal(canTraverseWallBoundary(state, { tx: 2, ty: 1.6 }, { tx: 3, ty: 1.6 }), false);
  assert.equal(canTraverseWallBoundary(state, { tx: 0, ty: 0 }, { tx: 6, ty: 0 }), false);
});

test("additional gates open separate and overlapping intervals without erasing other masonry", () => {
  const state = grid([{ x: 3, y: 0 }, { x: 3, y: 7 }], { x: 3, y: 2 });
  assert.ok(state.palisade);
  const extra = { ...state, palisade: { ...state.palisade, additionalGates: [{ x: 3, y: 5 }, { x: 3, y: 5 }] } };
  for (const ty of [1, 2, 4, 5]) assert.equal(canTraverseWallBoundary(extra, { tx: 2, ty }, { tx: 3, ty }), true);
  for (const ty of [0, 3, 6]) assert.equal(canTraverseWallBoundary(extra, { tx: 2, ty }, { tx: 3, ty }), false);
  const adjacent = { ...state, palisade: { ...state.palisade, additionalGates: [{ x: 3, y: 3 }] } };
  assert.equal(canTraverseWallBoundary(adjacent, { tx: 2, ty: 2 }, { tx: 3, ty: 2 }), true);
  assert.equal(canTraverseWallBoundary(adjacent, { tx: 2, ty: 5 }, { tx: 3, ty: 5 }), false);
});
