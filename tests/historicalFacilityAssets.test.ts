import { authoredAssetPath } from "../scripts/runtimeAssetProvenance";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { historicalFacilityAssetId, historicalFacilitySpriteRect } from "../src/render/historicalFacilityAssets";

const facility = (kind: Building["kind"], workers = 0): Building => ({
  id: kind, kind, tx: 3, ty: 7, workers, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
});

test("facility source images stay identical to provenance and crop registrations remain in bounds", () => {
  for (const asset of historicalFacilityManifest) {
    const image = readFileSync(authoredAssetPath(asset.url));
    assert.equal(createHash("sha256").update(image).digest("hex"), asset.sha256);
    assert.equal(image.readUInt32BE(16), asset.width);
    assert.equal(image.readUInt32BE(20), asset.height);
    assert.ok(asset.source.x + asset.source.width <= asset.width);
    assert.ok(asset.source.y + asset.source.height <= asset.height);
  }
});

test("facility source variants share geometry and translate with their actual footprint", () => {
  for (const kind of ["mill", "masonry", "sawmill", "chapel", "church", "keep", "market", "quarry"] as const) {
    const building = facility(kind);
    const rect = historicalFacilitySpriteRect(building);
    const moved = historicalFacilitySpriteRect({ ...building, tx: building.tx + 1 });
    assert.ok(rect !== null && moved !== null);
    assert.equal(moved.x - rect.x, 32);
    assert.equal(moved.y - rect.y, 16);
    assert.deepEqual(rect, historicalFacilitySpriteRect({ ...building, workers: 99, inventory: { stone_raw: 20 } }));
    assert.ok(rect.width <= (kind === "church" || kind === "keep" || kind === "market" || kind === "quarry" ? 128 : 64));
  }
  assert.equal(historicalFacilitySpriteRect(facility("house")), null);
});

test("quarry artwork follows actual staffing and storage capacity without inventing depletion", () => {
  assert.equal(historicalFacilityAssetId(facility("quarry", 0)), "quarry_idle");
  assert.equal(historicalFacilityAssetId(facility("quarry", 4)), "quarry_idle");
  assert.equal(historicalFacilityAssetId({ ...facility("quarry", 4), inventory: { stone_raw: 20 } }), "quarry_idle");
  assert.equal(historicalFacilityAssetId(facility("market", 3)), "market_quiet");
});

for (const mode of ["ready", "error", "wrong_size", "constructor_throw", "src_throw", "raster_throw"] as const) {
  test(`facility loading settles and preserves fallback after ${mode}`, () => {
    const script = `
      import assert from 'node:assert/strict';
      import { preloadHistoricalFacilityAssets, historicalFacilityAssetStatuses, drawHistoricalFacility } from './src/render/historicalFacilityAssets.ts';
      import { DEFAULT_GAME_STATE } from './src/state/gameStore.ts';
      let count = 0;
      if ('${mode}' === 'raster_throw') globalThis.OffscreenCanvas = class {
        getContext() { return { getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }, save() {}, restore() {}, drawImage() { throw new Error('raster draw failed'); } }; }
      };
      globalThis.Image = class {
        constructor() { count++; if ('${mode}' === 'constructor_throw') throw new Error('unavailable'); }
        set src(url) {
          if ('${mode}' === 'src_throw') throw new Error('unavailable');
          this.naturalWidth = '${mode}' === 'wrong_size' ? 1 : 1254;
          this.naturalHeight = 1254;
          queueMicrotask(() => '${mode}' === 'error' ? this.onerror() : this.onload());
        }
      };
      const first = preloadHistoricalFacilityAssets();
      assert.equal(first, preloadHistoricalFacilityAssets());
      await first;
      assert.equal(count, 11);
      assert.ok(historicalFacilityAssetStatuses().every(asset => asset.status === (['ready', 'raster_throw'].includes('${mode}') ? 'ready' : 'missing')));
      if ('${mode}' === 'raster_throw') {
        assert.ok(historicalFacilityAssetStatuses().every(asset => asset.rasterError === 'raster draw failed'));
        let source = null;
        const context = { getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }, save() {}, restore() {}, drawImage(image) { source = image; } };
        const building = { id: 'mill', kind: 'mill', tx: 1, ty: 1, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
        assert.equal(drawHistoricalFacility(context, building, DEFAULT_GAME_STATE), true);
        assert.ok(source instanceof globalThis.Image);
      }
    `;
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script]);
  });
}
