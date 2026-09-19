import assert from "node:assert/strict";
import test from "node:test";
import { CROP_REGISTRATION, cropDestination, farmCropRoots, farmSoilTiles } from "../src/render/farmCropLayout";

test("crop roots stay inside owned land and are independent of growth or neighbors", () => {
  for (const tx of [0, 47, 94]) for (const ty of [0, 43, 94]) {
    const roots = farmCropRoots({ tx, ty });
    assert.equal(roots.length, 144);
    assert.ok(roots.every(root => root.tx > tx - 0.44 && root.tx < tx + 1.44 && root.ty > ty - 0.44 && root.ty < ty + 1.44));
    assert.deepEqual(roots, farmCropRoots({ tx, ty }));
  }
});

test("neighboring plots continue the world crop lattice with no doubled edge margin", () => {
  const roots = [...farmCropRoots({ tx: 0, ty: 0 }), ...farmCropRoots({ tx: 2, ty: 0 })];
  const border = roots.filter(root => Math.abs(root.tx - 1.5) < 0.2);
  assert.equal(border.length, 24);
  assert.equal(new Set(roots.map(root => `${root.tx},${root.ty}`)).size, 288);
  assert.ok(border.every(root => Math.abs(root.tx - 1.5) < 0.1));
});

test("crop scaling preserves image proportions and root contact across all stages", () => {
  for (const root of farmCropRoots({ tx: 47, ty: 43 })) {
    const contacts = Object.values(CROP_REGISTRATION).map(registration => {
      const rect = cropDestination(root, registration);
      assert.ok(Math.abs(rect.width / rect.height - registration.source.width / registration.source.height) < 1e-10);
      const scale = rect.width / registration.source.width;
      return { x: rect.x + (registration.anchorX - registration.source.x) * scale, y: rect.y + (registration.anchorY - registration.source.y) * scale };
    });
    const first = contacts[0];
    assert.ok(first);
    for (const contact of contacts) {
      assert.ok(Math.abs(contact.x - first.x) < 1e-10);
      assert.ok(Math.abs(contact.y - first.y) < 1e-10);
    }
  }
});

test("soil sample tiles retain global phase at adjacent and map-edge plots", () => {
  for (const plot of [{ tx: 0, ty: 0 }, { tx: 2, ty: 0 }, { tx: 1, ty: 2 }, { tx: 94, ty: 94 }]) {
    for (const tile of farmSoilTiles(plot)) {
      assert.equal(Math.abs(tile.x % 32), 0);
      assert.equal(Math.abs(tile.y % 16), 0);
      assert.equal(tile.width, 32);
      assert.equal(tile.height, 16);
    }
  }
});
