import assert from 'node:assert/strict';
import test from 'node:test';
import { SEASON_IMAGES } from '../src/render/seasonArtManifest.generated';
import { seasonVariant } from '../src/render/seasonArt';
const baseline = SEASON_IMAGES;
const springOak = seasonVariant('tree_oak_large', 0);
const springApple = seasonVariant('orchard_apple_c', 0);
const springBirch = seasonVariant('tree_birch', 0);
assert.ok(springOak && springApple && springBirch);
import { preloadSeasonArt, seasonArtStatuses, seasonArtReadiness, seasonImage, seasonPropRaster, seasonSprite, setSeasonArtForTest } from '../src/render/seasonArt';

/** Controlled DOM boundary: image decode and raster allocation are independently observable. */
function browser() {
  const requests: string[] = [];
  const images: HTMLImageElement[] = [];
  const decode = new Map<HTMLImageElement, () => void>();
  const metadata = new Map(Object.values(baseline).map(meta => [`/${meta.url}`, meta]));
  class FakeImage {
    constructor() {
      const image: HTMLImageElement = Object.create(null);
      let url = '';
      Object.defineProperty(image, 'src', { get: () => url, set(value: string) {
        url = value; requests.push(value); const meta = metadata.get(value); assert.ok(meta);
        Object.assign(image, { naturalWidth: meta.width, naturalHeight: meta.height });
      } });
      Object.assign(image, { onload: null, onerror: null, decode: () => new Promise<void>(resolve => { decode.set(image, resolve); }) });
      images.push(image); return image;
    }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  return { requests, images, decode, restore() {
    setSeasonArtForTest(null);
    if (original) Object.defineProperty(globalThis, 'Image', original); else Reflect.deleteProperty(globalThis, 'Image');
  } };
}
test('first request preserves the exact active union URL order and repeated reads allocate nothing', () => {
  const fake = browser();
  try {
    setSeasonArtForTest(null); preloadSeasonArt();
    assert.deepEqual(fake.requests, Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)).map(([, meta]) => `/${meta.url}`));
    preloadSeasonArt(); seasonImage(springOak); seasonArtReadiness([springOak]);
    assert.equal(fake.requests.length, Object.keys(baseline).length);
    assert.deepEqual(seasonArtStatuses().map(row => row.key), Object.keys(baseline).sort());
  } finally { fake.restore(); }
});
test('decode gates substitution; raster failure is terminal without corrupting decoded image status', async () => {
  const fake = browser();
  const priorCanvas = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
  let allocations = 0;
  class FailedCanvas { constructor() { allocations++; throw new Error('no raster'); } }
  Object.defineProperty(globalThis, 'OffscreenCanvas', { configurable: true, value: FailedCanvas });
  try {
    setSeasonArtForTest(null); preloadSeasonArt();
    for (const key of [springApple, springOak]) {
      const index = seasonArtStatuses().findIndex(row => row.key === key); const image = fake.images[index]; assert.ok(image);
      assert.equal(seasonImage(key), null); image.onload?.call(image, new Event('load'));
      assert.equal(seasonImage(key), null); fake.decode.get(image)?.(); await Promise.resolve();
      assert.equal(seasonImage(key), image);
      assert.equal(seasonArtStatuses().find(row => row.key === key)?.status, 'ready');
      const before = allocations;
      for (let repeat = 0; repeat < 4; repeat++) assert.equal(key === springApple ? seasonPropRaster(key) : seasonSprite(key), null);
      assert.equal(allocations, before);
    }
    assert.equal(allocations, 2);
    const legacy = fake.images[seasonArtStatuses().findIndex(row => row.key === 'orchard_tree_spring')]; assert.ok(legacy);
    legacy.onload?.call(legacy, new Event('load'));
    const legacyAttempts = allocations;
    seasonPropRaster('orchard_tree_spring'); seasonPropRaster('orchard_tree_spring');
    assert.equal(allocations, legacyAttempts + 2, 'legacy raster retry behavior remains unchanged');
    assert.equal(seasonArtReadiness([springOak, springBirch, springApple]), '101');
  } finally {
    if (priorCanvas) Object.defineProperty(globalThis, 'OffscreenCanvas', priorCanvas); else Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
    fake.restore();
  }
});
test('wrong dimensions and network failure remain unavailable with one request each', async () => {
  const fake = browser();
  try {
    setSeasonArtForTest(null); preloadSeasonArt();
    const image = fake.images[seasonArtStatuses().findIndex(row => row.key === springBirch)]; assert.ok(image);
    Object.assign(image, { naturalWidth: 1 }); image.onload?.call(image, new Event('load')); fake.decode.get(image)?.(); await Promise.resolve();
    assert.equal(seasonImage(springBirch), null);
    assert.equal(seasonArtStatuses().find(row => row.key === springBirch)?.status, 'missing');
    const second = fake.images[seasonArtStatuses().findIndex(row => row.key === springOak)]; assert.ok(second);
    second.onerror?.call(second, new Event('error'));
    assert.equal(seasonImage(springOak), null);
    assert.equal(seasonArtStatuses().find(row => row.key === springOak)?.status, 'missing');
    assert.equal(fake.requests.length, Object.keys(baseline).length);
  } finally { fake.restore(); }
});
