import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const PROOF_BROWSER = new URL("../scripts/phase12PublishedProofBrowser.mjs", import.meta.url);

function evalBrowserModule(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", `import * as browser from ${JSON.stringify(PROOF_BROWSER.href)}; ${source}`],
    { encoding: "utf8" },
  );
}

test("Given published PNG resource entries When classified Then cached successes are not missing while failures are missing", () => {
  const output = evalBrowserModule(`
    const entries = [
      { name: "https://example.test/assets/terrain.png", responseStatus: 200, transferSize: 4200, encodedBodySize: 3900, decodedBodySize: 3900, deliveryType: "" },
      { name: "https://example.test/assets/tree.png", responseStatus: 200, transferSize: 0, encodedBodySize: 3900, decodedBodySize: 3900, deliveryType: "cache" },
      { name: "https://example.test/assets/missing.png", responseStatus: 404, transferSize: 300, encodedBodySize: 120, decodedBodySize: 120, deliveryType: "" },
      { name: "https://example.test/assets/failed.png", responseStatus: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, deliveryType: "" },
      { name: "https://example.test/assets/data.json", responseStatus: 404, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, deliveryType: "" }
    ];
    process.stdout.write(JSON.stringify(entries.map((entry) => browser.publishedProofAssetIsMissing(entry))));
  `);

  assert.deepEqual(JSON.parse(output), [false, false, true, true, false]);
});

test("Given browser resource timing entries When page and honest captures inspect assets Then both use the cache-aware predicate", () => {
  const output = evalBrowserModule(`
    const entries = [
      { name: "https://example.test/assets/terrain.png", responseStatus: 200, transferSize: 4200, encodedBodySize: 3900, decodedBodySize: 3900, deliveryType: "" },
      { name: "https://example.test/assets/tree.png", responseStatus: 200, transferSize: 0, encodedBodySize: 3900, decodedBodySize: 3900, deliveryType: "cache" },
      { name: "https://example.test/assets/missing.png", responseStatus: 404, transferSize: 300, encodedBodySize: 120, decodedBodySize: 120, deliveryType: "" },
      { name: "https://example.test/assets/failed.png", responseStatus: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, deliveryType: "" }
    ];
    const document = { title: "Proof", querySelector: () => null };
    const performance = { getEntriesByType: () => entries };
    const client = {
      evaluate: async (source) => {
        if (source.includes("getImageData")) return { hash: "00000000", width: 1, height: 1, visiblePixels: 1 };
        return Function("document", "performance", \`return \${source};\`)(document, performance);
      },
      send: async () => ({ data: "" })
    };
    const pageMissingAssets = await browser.pageMissingAssets(client);
    const honest = await browser.honestCapture({ client, dir: "/tmp", label: "phase12-runtime-test", screenshots: [] });
    process.stdout.write(JSON.stringify({ pageMissingAssets, resourceErrors: honest.documentSummary.resourceErrors }));
  `);

  assert.deepEqual(JSON.parse(output), {
    pageMissingAssets: ["https://example.test/assets/missing.png", "https://example.test/assets/failed.png"],
    resourceErrors: ["https://example.test/assets/missing.png", "https://example.test/assets/failed.png"],
  });
});

test("Given frame probe source When resetFrameSamples clears exported samples Then identity is preserved and subsequent frames remain observable", () => {
  const output = evalBrowserModule(`
    const timers = [];
    let now = 100;
    const performance = { now: () => now };
    const window = {
      requestAnimationFrame: (callback) => {
        now += 16;
        callback(now);
        return 1;
      }
    };
    const setTimeout = (callback) => { timers.push(callback); };
    Function("window", "performance", "setTimeout", browser.frameProbeSource())(window, performance, setTimeout);
    window.requestAnimationFrame(() => {
      now += 2;
      window.requestAnimationFrame(() => { now += 4; });
    });
    timers.splice(0).forEach((callback) => callback());
    timers.splice(0).forEach((callback) => callback());
    const arrayIdentity = window.__PHASE12_FRAME_TIMES__;
    const firstLength = window.__PHASE12_FRAME_TIMES__.length;
    const client = {
      evaluate: async (source) => Function("window", \`return \${source};\`)(window),
    };
    await browser.resetFrameSamples(client);
    const sameArrayAfterReset = arrayIdentity === window.__PHASE12_FRAME_TIMES__;
    window.requestAnimationFrame(() => { now += 3; });
    timers.splice(0).forEach((callback) => callback());
    process.stdout.write(JSON.stringify({ firstLength, sameArrayAfterReset, afterReset: window.__PHASE12_FRAME_TIMES__ }));
  `);

  const result = JSON.parse(output);
  assert.ok(result.firstLength > 0);
  assert.equal(result.sameArrayAfterReset, true);
  assert.ok(result.afterReset.length > 0);
  assert.ok(result.afterReset.every((value: number) => value > 0));
});
