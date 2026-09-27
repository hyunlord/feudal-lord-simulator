import { execFileSync } from "node:child_process";
import test from "node:test";

for (const mode of ["ready", "error", "constructor_throw", "src_throw", "raster_throw", "raster_string_throw"] as const) {
  test(`stone wall preload settles and preserves usable originals after ${mode}`, () => {
    const script = `
      import assert from 'node:assert/strict';
      import { preloadStoneWallAssets, stoneWallAssetStatuses, stoneWallImage, stoneWallMaterial } from './src/render/stoneWallAssets.ts';
      let count = 0;
      globalThis.Image = class {
        constructor() { count++; if ('${mode}' === 'constructor_throw') throw new Error('image unavailable'); }
        set src(value) {
          if ('${mode}' === 'src_throw') throw new Error('source unavailable');
          this.naturalWidth = 1254; this.naturalHeight = 1254;
          queueMicrotask(() => '${mode}' === 'error' ? this.onerror() : this.onload());
        }
      };
      if ('${mode}'.startsWith('raster_')) globalThis.OffscreenCanvas = class {
        getContext() { throw '${mode}' === 'raster_throw' ? new Error('canvas unavailable') : 'canvas unavailable'; }
      };
      const pending = preloadStoneWallAssets();
      assert.equal(pending, preloadStoneWallAssets());
      // No wall-clock race (CODE-1c): the stub image answers in a microtask, so the preload must have settled by the
      // time the event loop reaches its next macrotask, however busy the machine is.
      let settled = false;
      pending.then(() => { settled = true; }, () => { settled = true; });
      await new Promise(resolve => setImmediate(resolve));
      assert.ok(settled, 'preload never settled');
      await preloadStoneWallAssets();
      assert.equal(count, 2);
      const usable = '${mode}' === 'ready' || '${mode}'.startsWith('raster_');
      assert.ok(stoneWallAssetStatuses().every(asset => asset.status === (usable ? 'ready' : 'missing')));
      assert.equal(stoneWallImage('descending') !== null, usable);
      assert.equal(stoneWallMaterial(), null);
      if ('${mode}'.startsWith('raster_')) assert.equal(stoneWallAssetStatuses()[0].loadError, 'canvas unavailable');
    `;
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { timeout: 5000 });
  });
}
