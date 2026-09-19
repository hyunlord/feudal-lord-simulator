import assert from "node:assert/strict";
import test from "node:test";
import { stoneWallFallbackSolids } from "../src/render/stoneWallFallbackGeometry";
import { stoneWallPieces } from "../src/render/stoneWallGeometry";

test("fallback walls retain ground thickness, battlements and exact geometry when paths reverse", () => {
  for (const end of [{ x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: -2 }]) {
    const path = [{ x: 0, y: 0 }, end];
    const solids = stoneWallPieces(path, null).flatMap(stoneWallFallbackSolids);
    assert.deepEqual(solids, stoneWallPieces([...path].reverse(), null).flatMap(stoneWallFallbackSolids));
    assert.ok(solids.some(solid => solid.base === 14 && solid.height === 4));
    for (const { footprint } of solids) {
      const [a, b, c, d] = footprint;
      const area = Math.abs(a.x * b.y + b.x * c.y + c.x * d.y + d.x * a.y
        - a.y * b.x - b.y * c.x - c.y * d.x - d.y * a.x) / 2;
      assert.ok(area > 0, "even screen-vertical paths need a nondegenerate top face");
    }
  }
});

test("gate cuts apply to the body and every battlement without end cap intrusion", () => {
  const gate = { x: 1, y: 1 };
  for (const piece of stoneWallPieces([{ x: 0, y: 0 }, gate, { x: 2, y: 2 }], gate)) {
    const dx = piece.end.x - piece.start.x;
    const dy = piece.end.y - piece.start.y;
    for (const solid of stoneWallFallbackSolids(piece)) {
      const [a, b, c, d] = solid.footprint;
      for (const point of [{ x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 },
        { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }]) {
        const t = ((point.x - piece.start.x) * dx + (point.y - piece.start.y) * dy) / (dx * dx + dy * dy);
        assert.ok(t >= piece.from - 1e-9 && t <= piece.to + 1e-9);
      }
    }
  }
});
