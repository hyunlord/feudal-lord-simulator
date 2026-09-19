import assert from "node:assert/strict";
import test from "node:test";
import { stoneWallPieces, stoneWallTransform, STONE_WALL_SOURCES } from "../src/render/stoneWallGeometry";

for (const end of [{ x: 4, y: 0 }, { x: 0, y: 4 }]) {
  test(`axis ${end.x},${end.y} keeps reversed endpoint registration identical`, () => {
    const forward = stoneWallPieces([{ x: 0, y: 0 }, end], null);
    const backward = stoneWallPieces([end, { x: 0, y: 0 }], null);
    assert.deepEqual(forward, backward);
    for (const piece of forward) {
      assert.notEqual(piece.axis, null);
      if (piece.axis === null) continue;
      const source = STONE_WALL_SOURCES[piece.axis];
      const matrix = stoneWallTransform(piece, source);
      for (const [point, target] of [[source.start, piece.start], [source.end, piece.end]] as const) {
        assert.ok(Math.abs(matrix.a * point.x + matrix.e - target.x) < 1e-8);
        assert.ok(Math.abs(matrix.b * point.x + matrix.d * point.y + matrix.f - target.y) < 1e-8);
      }
      assert.equal(matrix.c, 0);
      assert.ok(matrix.a > 0 && matrix.d > 0);
    }
  });
}
test("gate at shared segment endpoint clears both adjacent wall halves", () => {
  const pieces = stoneWallPieces([{ x: 0, y: 0 }, { x: 2, y: 0 }], { x: 1, y: 0 });
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs((pieces[0]?.to ?? 0) - 0.2) < 1e-8);
  assert.equal(pieces[1]?.from, 0.8);
});
test("diagonal and turning paths retain each world edge with procedural fallback", () => {
  const pieces = stoneWallPieces([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }], null);
  assert.equal(pieces.length, 2);
  assert.equal(pieces.filter(piece => piece.axis === null).length, 1);
});
test("zero length paths produce no wall", () => {
  assert.deepEqual(stoneWallPieces([{ x: 1, y: 1 }, { x: 1, y: 1 }], null), []);
});
test("opposite adjacent run calls preserve a gate opening without affecting distant pieces", () => {
  const gate = { x: 2, y: 2 };
  const incoming = stoneWallPieces([{ x: 0, y: 2 }, gate], gate);
  const outgoing = stoneWallPieces([gate, { x: 2, y: 4 }], gate);
  assert.equal(incoming.filter(piece => piece.from !== 0 || piece.to !== 1).length, 1);
  assert.equal(outgoing.filter(piece => piece.from !== 0 || piece.to !== 1).length, 1);
  const unchanged = stoneWallPieces([{ x: 5, y: 5 }, { x: 6, y: 5 }], gate);
  assert.equal(unchanged[0]?.from, 0);
  assert.equal(unchanged[0]?.to, 1);
});

for (const neighbor of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]) {
  test(`gate cut leaves both road lanes open along ${JSON.stringify(neighbor)}`, () => {
    const gate = { x: 0, y: 0 };
    const [piece] = stoneWallPieces([gate, neighbor], gate);
    assert.ok(piece);
    const cut = piece.from > 0 ? piece.from : 1 - piece.to;
    assert.ok(Math.abs(cut * Math.max(Math.abs(neighbor.x), Math.abs(neighbor.y)) - 0.8) < 1e-8);
  });
}
