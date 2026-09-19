import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import * as geometry from "../src/render/farmGeometry";

const farm: Building = { id: "farm", kind: "wheat_farm", tx: 0, ty: 0, workers: 4, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };

test("isolated farm contour stays inward at map edges and varies without changing growth stages", () => {
  for (const tx of [0, 47, 94]) for (const ty of [0, 43, 94]) {
    const current = { ...farm, tx, ty };
    const contour = geometry.farmBoundary(current, []);
    assert.ok(contour.every(p => p.tx >= tx - 0.5 && p.tx <= tx + 1.5 && p.ty >= ty - 0.5 && p.ty <= ty + 1.5));
    assert.ok(contour.some(p => p.tx > tx - 0.5 && p.tx < tx + 1.5 && p.ty > ty - 0.5 && p.ty < ty + 1.5));
    const ripe = { ...current, productionProgress: 35 };
    assert.deepEqual(contour, geometry.farmBoundary(ripe, []));
  }
});

test("all farm shared edges remain exact with offset neighbors, independent of insertion order", () => {
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [1, -2]] as const) {
    const neighbor = { ...farm, id: "neighbor", tx: dx, ty: dy };
    const farms = [farm, neighbor];
    const points = geometry.farmBoundary(farm, farms);
    assert.deepEqual(points, geometry.farmBoundary(farm, [...farms].reverse()));
    const onEdge = points.filter(p => dx === 2 ? p.tx === 1.5 && p.ty > Math.max(-0.5, dy - 0.5) && p.ty < Math.min(1.5, dy + 1.5)
      : dx === -2 ? p.tx === -0.5 && p.ty > -0.5 && p.ty < 1.5
      : dy === 2 ? p.ty === 1.5 && p.tx > -0.5 && p.tx < 1.5
      : p.ty === -0.5 && p.tx > Math.max(-0.5, dx - 0.5) && p.tx < Math.min(1.5, dx + 1.5));
    assert.ok(onEdge.length >= 7, `shared edge ${dx},${dy}`);
    assert.notDeepEqual(points, geometry.farmBoundary(farm, [farm]));
    assert.deepEqual(geometry.farmBoundary(farm, [farm, { ...neighbor, kind: "house" }]), geometry.farmBoundary(farm, [farm]));
  }
});
