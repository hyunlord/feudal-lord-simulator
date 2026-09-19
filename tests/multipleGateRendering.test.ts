import assert from "node:assert/strict";
import test from "node:test";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";
import { palisadeSegmentRenderItems } from "../src/render/palisadeObjectRenderItems";
import { stoneWallPieces } from "../src/render/stoneWallGeometry";
import { stoneWallNodeSolids } from "../src/render/stoneWallNodeGeometry";
import { timberWallPostPoints } from "../src/render/timberGateGeometry";
import { gatePortalBranches, gateHasSharedOpening } from "../src/render/gatePortalBranches";

const range = { minTx: -10, minTy: -10, maxTx: 10, maxTy: 10 };
for (const material of ["timber", "stone"] as const) {
  for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]) {
    for (const spacing of [1, 2]) {
      test(`${material} ${JSON.stringify(delta)} spacing ${spacing} exposes both gates with unique nodes and stable reversed paths`, () => {
        const point = (step: number) => ({ x: delta.x * step, y: delta.y * step });
        const wall = { ...palisade([palisadeSegment(0, { material, edgePath: [point(-1), point(3)] })]),
          gate: point(0), additionalGates: [point(spacing), point(spacing)] };
        const items = palisadeSegmentRenderItems(wall, range);
        const nodes = items.flatMap(item => item.stoneNodes ?? []).filter(node => node.kind === "gate");
        assert.equal(nodes.length, 2);
        assert.deepEqual(items, palisadeSegmentRenderItems({ ...wall, segments: wall.segments.map(segment =>
          ({ ...segment, edgePath: [...segment.edgePath].reverse() })) }, range));
        const shared = items.find(item => item.gates?.length === 2);
        assert.equal(shared !== undefined, spacing === 1);
        if (shared) {
          assert.deepEqual(stoneWallPieces(shared.segment.edgePath, shared.gate, shared.gates), []);
          assert.deepEqual(timberWallPostPoints(shared.segment.edgePath, shared.gate, shared.gates), []);
        }
        for (const node of nodes) {
          assert.equal(gateHasSharedOpening(node), spacing === 1);
          const branches = gatePortalBranches(node);
          assert.equal(branches.filter(branch => branch.pier).length, spacing === 1 ? 1 : 2);
          for (const branch of branches.filter(branch => branch.pier)) {
            for (const gate of [wall.gate, ...wall.additionalGates]) {
              assert.ok(Math.max(Math.abs(branch.point.x - gate.x), Math.abs(branch.point.y - gate.y)) >= 0.95 - 1e-8);
            }
          }
          assert.equal(stoneWallNodeSolids(node).filter(solid => solid.base === 0).length, spacing === 1 ? 1 : 2);
        }
      });
    }
  }
}

test("adjacent gates around a corner merge overhead without an interior ground pier", () => {
  const points = [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }];
  const wall = { ...palisade([palisadeSegment(0, { material: "stone", edgePath: points })]),
    gate: { x: 0, y: 0 }, additionalGates: [{ x: 1, y: 0 }, { x: 1, y: 1 }] };
  const nodes = palisadeSegmentRenderItems(wall, range).flatMap(item => item.stoneNodes ?? [])
    .filter(node => node.kind === "gate");
  assert.equal(nodes.length, 3);
  assert.equal(nodes.flatMap(node => stoneWallNodeSolids(node)).filter(solid => solid.base === 0).length, 2);
});
