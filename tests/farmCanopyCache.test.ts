import assert from "node:assert/strict";
import test from "node:test";
import { CROP_REGISTRATION, cropDestination, farmCropRoots } from "../src/render/farmCropLayout";
import { createFarmCanopyCache, FARM_CANOPY_CAPACITY } from "../src/render/farmCanopyCache";

function withCanvas(run: (calls: number[][]) => void, contextAvailable = true) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  const calls: number[][] = [];
  class TestCanvas {
    constructor(readonly width: number, readonly height: number) {}
    getContext() {
      if (!contextAvailable) return null;
      return {
        imageSmoothingEnabled: false,
        getTransform: () => ({ a: 3, b: 0, c: 0, d: 3, e: 0, f: 0 }),
        save: () => {}, restore: () => {}, setTransform: () => {},
        drawImage: (_image: CanvasImageSource, ...values: number[]) => { calls.push(values); },
      };
    }
  }
  Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: TestCanvas });
  try { run(calls); } finally {
    if (previous) Object.defineProperty(globalThis, "OffscreenCanvas", previous);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  }
}

test("unchanged canopy rasterizes its 144 roots once across repeated frames", () => withCanvas(calls => {
  const cache = createFarmCanopyCache();
  const sprite = { image: new OffscreenCanvas(52, 64), source: { x: 0, y: 0, width: 52, height: 64 } };
  const first = cache.get({ tx: 47, ty: 43 }, "ripe", sprite);
  const repeated = cache.get({ tx: 47, ty: 43 }, "ripe", sprite);
  assert.ok(first);
  assert.equal(repeated, first);
  assert.equal(calls.length, 144);
  const destinations = farmCropRoots({ tx: 47, ty: 43 }).map(root => cropDestination(root, CROP_REGISTRATION.ripe));
  assert.deepEqual(calls.map(call => call.slice(4)), destinations.map(rect => [rect.x, rect.y, rect.width, rect.height]));
  assert.ok(destinations.every(rect => rect.x >= first.destination.x && rect.y >= first.destination.y
    && rect.x + rect.width <= first.destination.x + first.destination.width
    && rect.y + rect.height <= first.destination.y + first.destination.height));
  assert.ok(first.source.width * first.source.height * 4 < 400_000);
}));

test("growth, position and source replacement cannot reuse stale crop pixels", () => withCanvas(calls => {
  const cache = createFarmCanopyCache();
  const sprite = { image: new OffscreenCanvas(52, 64), source: { x: 0, y: 0, width: 52, height: 64 } };
  const first = cache.get({ tx: 0, ty: 0 }, "seedling", sprite);
  const grown = cache.get({ tx: 0, ty: 0 }, "growing", sprite);
  const moved = cache.get({ tx: 2, ty: 0 }, "seedling", sprite);
  const replaced = cache.get({ tx: 0, ty: 0 }, "seedling", { ...sprite, image: new OffscreenCanvas(52, 64) });
  assert.notEqual(grown, first);
  assert.notEqual(moved, first);
  assert.notEqual(replaced, first);
  assert.equal(calls.length, 144 * 4);
}));

test("capacity eviction retains recently used fields and bounds raster memory", () => withCanvas(calls => {
  const cache = createFarmCanopyCache();
  const sprite = { image: new OffscreenCanvas(52, 64), source: { x: 0, y: 0, width: 52, height: 64 } };
  const first = cache.get({ tx: 0, ty: 0 }, "ripe", sprite);
  for (let tx = 1; tx < FARM_CANOPY_CAPACITY; tx += 1) cache.get({ tx, ty: 0 }, "ripe", sprite);
  cache.beginFrame();
  cache.get({ tx: 0, ty: 0 }, "ripe", sprite);
  cache.get({ tx: 100, ty: 0 }, "ripe", sprite);
  assert.equal(cache.get({ tx: 0, ty: 0 }, "ripe", sprite), first);
  cache.get({ tx: 1, ty: 0 }, "ripe", sprite);
  assert.equal(calls.length, (FARM_CANOPY_CAPACITY + 2) * 144);
  assert.equal(cache.size(), FARM_CANOPY_CAPACITY);
}));

test("canopy cache returns direct-draw fallback when a 2D buffer is unavailable", () => withCanvas(calls => {
  const cache = createFarmCanopyCache();
  const sprite = { image: new OffscreenCanvas(52, 64), source: { x: 0, y: 0, width: 52, height: 64 } };
  assert.equal(cache.get({ tx: 0, ty: 0 }, "ripe", sprite), null);
  assert.equal(cache.size(), 0);
  assert.equal(calls.length, 0);
}, false));


test("overflow fields use direct rendering without evicting this frame's reused canopies", () => withCanvas(calls => {
  const cache = createFarmCanopyCache();
  const sprite = { image: new OffscreenCanvas(52, 64), source: { x: 0, y: 0, width: 52, height: 64 } };
  for (let frame = 0; frame < 2; frame += 1) {
    cache.beginFrame();
    for (let tx = 0; tx < 200; tx += 1) {
      const canopy = cache.get({ tx, ty: 0 }, "ripe", sprite);
      assert.equal(canopy !== null, tx < FARM_CANOPY_CAPACITY);
    }
  }
  assert.equal(calls.length, FARM_CANOPY_CAPACITY * 144);
  assert.equal(cache.stats().hits, FARM_CANOPY_CAPACITY);
  assert.equal(cache.stats().evictions, 0);
  assert.equal(cache.size(), FARM_CANOPY_CAPACITY);
}));
