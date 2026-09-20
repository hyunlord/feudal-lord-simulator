import assert from "node:assert/strict";
import test from "node:test";
import { houseConditionArt, registerHouseConditionArt } from "../src/render/houseConditionArt";
const meta = { assetId: "condition", level: 4, lot: "single", condition: "strained", url: "assets/test.png", width: 1254, height: 1254 } as const;
test("optional artwork missing in a non-browser keeps decal fallback available", async () => {
  await registerHouseConditionArt([meta]);
  assert.equal(houseConditionArt(4, "single", "strained"), null);
});
test("registered fullcanvas image is usable only when dimensions match", async () => {
  class ImageStub {
    naturalWidth = 1254; naturalHeight = 1254;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) { if (value.includes("missing")) this.onerror?.(); else this.onload?.(); }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", { configurable: true, value: ImageStub });
  try {
    await registerHouseConditionArt([meta, { ...meta, level: 3, width: 200 }, { ...meta, level: 2, url: "missing.png" }]);
    assert.ok(houseConditionArt(4, "single", "strained")?.image);
    assert.equal(houseConditionArt(3, "single", "strained"), null);
    assert.equal(houseConditionArt(2, "single", "strained"), null);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, "Image");
    else Object.defineProperty(globalThis, "Image", original);
  }
});
