import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

for (const mode of ["ready", "error", "wrong_size", "constructor_throw", "src_throw"] as const) {
  test(`historical single-house asset loader settles cached promises after ${mode}`, () => {
    const script = `
      import { historicalHouseAssetManifest } from './src/render/historicalHouseAssetManifest.generated.ts';
      import { preloadHistoricalHouseAssets, historicalHouseAssetStatuses } from './src/render/historicalHouseAssets.ts';
      let count = 0;
      globalThis.Image = class {
        constructor() { count++; if ('${mode}' === 'constructor_throw') throw new Error('image unavailable'); }
        set src(url) {
          if ('${mode}' === 'src_throw') throw new Error('source unavailable');
          const meta = historicalHouseAssetManifest.find(meta => '/' + meta.url === url);
          this.naturalWidth = '${mode}' === 'wrong_size' ? 1 : meta.width;
          this.naturalHeight = meta.height;
          queueMicrotask(() => '${mode}' === 'error' ? this.onerror() : this.onload());
        }
      };
      const one = preloadHistoricalHouseAssets(); const two = preloadHistoricalHouseAssets();
      if (one !== two) throw new Error('uncached loading');
      await one; await preloadHistoricalHouseAssets();
      console.log(JSON.stringify({ count, statuses: historicalHouseAssetStatuses(), expected: historicalHouseAssetManifest.length }));
    `;
    const output = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8" })) as { count: number; expected: number; statuses: { status: string; url: string }[] };
    assert.equal(output.count, output.expected);
    assert.ok(output.statuses.every(asset => asset.status === (mode === "ready" ? "ready" : "missing")));
    assert.ok(output.statuses.every(asset => asset.url.startsWith("/assets/")));
  });
}
