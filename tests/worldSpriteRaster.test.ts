import assert from "node:assert/strict";
import test from "node:test";
import { rasterizeWorldSprite } from "../src/render/worldSpriteRaster";

test("runtime sprite thumbnails filter once into a bounded transparent buffer", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  const calls: number[][] = [];
  let allocations = 0;
  class TestCanvas {
    constructor(readonly width: number, readonly height: number) { allocations += 1; }
    getContext() {
      let smoothing = false;
      let saved = false;
      return {
        get imageSmoothingEnabled() { return smoothing; },
        set imageSmoothingEnabled(value: boolean) { smoothing = value; },
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        save: () => { saved = smoothing; }, restore: () => { smoothing = saved; },
        drawImage: (_image: CanvasImageSource, ...values: number[]) => {
          assert.equal(smoothing, true);
          calls.push(values);
        },
      };
    }
  }
  Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: TestCanvas });
  try {
    const source = new OffscreenCanvas(1254, 1254);
    const result = rasterizeWorldSprite(source, { x: 244, y: 148, width: 778, height: 958 }, 64);
    assert.ok(result);
    assert.deepEqual(result.source, { x: 0, y: 0, width: 52, height: 64 });
    assert.equal(allocations, 2);
    assert.deepEqual(calls, [[244, 148, 778, 958, 0, 0, 52, 64]]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "OffscreenCanvas", previous);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  }
});
