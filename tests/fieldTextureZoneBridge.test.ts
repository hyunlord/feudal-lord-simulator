import assert from 'node:assert/strict';
import test from 'node:test';
import { ZONE_ASSETS } from '../src/render/zoneAssetManifest';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

test('zone preload and field preparation share the four legacy owners plus catalog additions and await decoded terminal outcomes', async () => {
  const fields = ART_REGISTRY.entries('ground-texture');
  const assets = [...ZONE_ASSETS, ...fields.map(entry => entry.image)];
  const expectedUrls = new Set(assets.map(asset => asset.url));
  assert.equal(fields.filter(entry => ['ridge_ploughed_a', 'ridge_ploughed_b', 'ridge_seedling_a', 'ridge_seedling_b'].includes(entry.id)).length, 4);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const created: FakeImage[] = [];
  const pending = new Map<string, { resolve: () => void; reject: (reason: Error) => void }>();
  class FakeImage {
    naturalWidth = 0; naturalHeight = 0; onload: (() => void) | null = null; onerror: (() => void) | null = null;
    url = '';
    constructor() { created.push(this); }
    set src(url: string) {
      this.url = url; const asset = assets.find(asset => url === `/${asset.url}`); assert.ok(asset);
      this.naturalWidth = asset.width; this.naturalHeight = asset.height;
      queueMicrotask(() => this.onload?.());
    }
    decode(): Promise<void> { return new Promise((resolve, reject) => pending.set(this.url, { resolve, reject })); }
  }
  Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true });
  try {
    const { preloadZoneAssets, zoneAsset, zoneAssetReadiness, zoneAssetStatuses } = await import('../src/render/zoneAssets');
    const { fieldTextures, FIELD_TEXTURE_IDS } = await import('../src/render/art/fieldTextures');
    assert.equal(zoneAsset('ridge_ploughed_a'), null); assert.equal(created.length, 0);
    const first = preloadZoneAssets(); assert.equal(preloadZoneAssets(), first);
    fieldTextures().prepare([{ fieldState: 'ploughed', season: 'spring' }]);
    await Promise.resolve(); assert.equal(created.length, expectedUrls.size); assert.equal(pending.size, fields.length);
    assert.deepEqual(new Set(created.map(image => image.url)), new Set([...expectedUrls].map(url => `/${url}`)));
    assert.deepEqual(FIELD_TEXTURE_IDS, fields.map(entry => entry.id));
    assert.equal(zoneAssetReadiness(['ridge_ploughed_a', 'ridge_ploughed_b', 'ridge_seedling_a', 'ridge_seedling_b']), '0000');
    let settled = false; void first.then(() => { settled = true; }); await Promise.resolve(); assert.equal(settled, false);
    for (const [url, decode] of pending) {
      if (url === '/assets/fields/ridge_seedling_a-v1.png') decode.reject(new Error('decode failed'));
      else { if (url === '/assets/fields/ridge_seedling_b-v1.png') { const image = created.find(image => image.url === url); assert.ok(image); image.naturalWidth = 1; } decode.resolve(); }
    }
    await first; assert.equal(settled, true);
    assert.equal(zoneAssetReadiness(['ridge_ploughed_a', 'ridge_ploughed_b', 'ridge_seedling_a', 'ridge_seedling_b']), '1100');
    for (const entry of fields) {
      assert.equal(created.filter(image => image.url === `/${entry.image.url}`).length, 1, `${entry.id}: one image owner`);
      assert.equal(fieldTextures().status(entry.id).status, ['ridge_seedling_a', 'ridge_seedling_b'].includes(entry.id) ? 'missing' : 'ready');
    }
    assert.equal(zoneAsset('ridge_ploughed_a'), fieldTextures().image('ridge_ploughed_a'));
    assert.equal(zoneAssetStatuses().find(row => row.key === 'ridge_seedling_a')?.status, 'missing');
    await preloadZoneAssets(); assert.equal(created.length, expectedUrls.size);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'Image'); else Object.defineProperty(globalThis, 'Image', original);
  }
});
