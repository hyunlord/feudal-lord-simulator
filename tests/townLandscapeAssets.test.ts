import assert from "node:assert/strict";
import test from "node:test";
import { preloadTownLandscapeAssets, townLandscapeAssetReady, townLandscapeRect } from "../src/render/townLandscapeAssets";

test("landscape URLs stay on the deployment origin and missing optional images finish preload", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const requested: string[] = [];
  class MissingImage {
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    set src(value: string) { requested.push(value); queueMicrotask(() => this.onerror?.()); }
  }
  Object.defineProperty(globalThis, "Image", { configurable: true, value: MissingImage });
  try {
    await preloadTownLandscapeAssets();
    assert.deepEqual(requested, ["/assets/phase16-landscape/vegetable.png", "/assets/phase16-landscape/orchard.png", "/assets/phase16-landscape/pasture.png"]);
    for (const kind of ["vegetable", "orchard", "pasture"] as const) assert.equal(townLandscapeAssetReady(kind), false);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, "Image");
    else Object.defineProperty(globalThis, "Image", original);
  }
});

import { townLandscapeManifest } from "../src/render/townLandscapeManifest.generated";
import { tileCenter } from "../src/render/picking";

test("each landscape ground anchor shares the exact selectable tile center at every map edge", () => {
  for (const meta of townLandscapeManifest) for (const tx of [0, 25, 95]) for (const ty of [0, 42, 95]) {
    const rect = townLandscapeRect(meta, { tx, ty });
    const center = tileCenter(tx, ty);
    assert.ok(Math.abs(rect.x + rect.width * meta.groundAnchor.x - center.x) < 1e-8);
    assert.ok(Math.abs(rect.y + rect.height * meta.groundAnchor.y - center.y) < 1e-8);
    assert.ok(Math.abs(rect.width / rect.height - meta.width / meta.height) < 1e-8);
  }
});
