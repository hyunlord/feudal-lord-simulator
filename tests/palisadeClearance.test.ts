import assert from "node:assert/strict";
import { test } from "node:test";
import { palisadePathHasBuildingClearance, type PalisadeFootprint, type PalisadePath } from "../src/world/palisadeGeometry";

// SIM-SPEED ③a: the clearance check on widened rectangles answers as the old one did (each raster point and each step's
// middle against every footprint by clearanceFromFootprint) — on random closed paths with diagonal steps, random
// footprints, margins 0 to 3.
function reference(path: PalisadePath, footprints: readonly PalisadeFootprint[], margin = 1): boolean {
  const clearance = (point: { x: number; y: number }, footprint: PalisadeFootprint) => {
    const right = footprint.tx + footprint.width; const bottom = footprint.ty + footprint.height;
    const dx = point.x < footprint.tx ? footprint.tx - point.x : point.x > right ? point.x - right : 0;
    const dy = point.y < footprint.ty ? footprint.ty - point.y : point.y > bottom ? point.y - bottom : 0;
    return Math.max(dx, dy);
  };
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!; const to = path[index]!;
    const points = [from]; let current = from;
    while (current.x !== to.x || current.y !== to.y) { current = { x: current.x + Math.sign(to.x - current.x), y: current.y + Math.sign(to.y - current.y) }; points.push(current); }
    for (let step = 0; step < points.length; step += 1) {
      const point = points[step]!; const next = points[step + 1];
      if (footprints.some(footprint => clearance(point, footprint) < margin)) return false;
      if (next !== undefined && footprints.some(footprint => clearance({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }, footprint) < margin)) return false;
    }
  }
  return true;
}
function random(seed: number) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test("the widened-rectangle clearance check answers as the per-footprint one, on 4,000 random paths", () => {
  const next = random(3); let passed = 0;
  for (let trial = 0; trial < 4000; trial += 1) {
    const at = () => Math.floor(next() * 30);
    const corners = Array.from({ length: 3 + Math.floor(next() * 4) }, () => ({ x: at(), y: at() }));
    const path: PalisadePath = [...corners, corners[0]!];   // any steps: straight, diagonal, uneven (the raster walks them all)
    const footprints = Array.from({ length: Math.floor(next() * 6) }, (_, id) => ({ id: `b${id}`, tx: at(), ty: at(), width: 1 + Math.floor(next() * 3), height: 1 + Math.floor(next() * 3) }));
    const margin = Math.floor(next() * 4);
    const expected = reference(path, footprints, margin);
    assert.equal(palisadePathHasBuildingClearance(path, footprints, margin), expected, JSON.stringify({ path, footprints, margin }));
    if (expected) passed += 1;
  }
  assert.ok(passed > 400 && passed < 3600, `both answers occur (${passed} clear of 4,000)`);
});
