import assert from "node:assert/strict";
import test from "node:test";
import { stoneWallNodeSolids } from "../src/render/stoneWallNodeGeometry";
import { palisadeScreenPath } from "../src/render/palisadeRenderGeometry";

for (const neighbors of [
  [{ x: 1, y: 0 }, { x: -1, y: 0 }],
  [{ x: 0, y: 1 }, { x: 0, y: -1 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 1, y: 1 }, { x: -1, y: -1 }],
]) {
  test(`gate ${JSON.stringify(neighbors)} preserves ground clearance and human-height lintel`, () => {
    const point = { x: 0, y: 0 };
    const center = palisadeScreenPath([point])[0];
    assert.ok(center);
    const solids = stoneWallNodeSolids({ point, neighbors, kind: "gate" });
    assert.equal(solids.filter(solid => solid.base === 0).length, 2);
    for (const solid of solids) {
      if (solid.base > 0) { assert.ok(solid.base >= 20); continue; }
      for (const vertex of solid.footprint) {
        const sx = vertex.x - center.x; const sy = vertex.y - center.y;
        const worldX = sx / 64 + sy / 32;
        const worldY = sy / 32 - sx / 64;
        assert.ok(Math.max(Math.abs(worldX), Math.abs(worldY)) >= 0.8 - 1e-8);
      }
    }
    assert.deepEqual(solids, stoneWallNodeSolids({ point, neighbors: [...neighbors].reverse(), kind: "gate" }));
  });
}
test("a partly converted gate creates only a side pier until the opposite stone run is complete", () => {
  const solids = stoneWallNodeSolids({ point: { x: 0, y: 0 }, neighbors: [{ x: 1, y: 0 }], kind: "gate" });
  assert.equal(solids.length, 1);
  assert.equal(solids[0]?.base, 0);
});
