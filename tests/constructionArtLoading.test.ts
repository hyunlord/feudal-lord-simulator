import assert from 'node:assert/strict';
import test from 'node:test';
import { constructionArtAssetStatuses, preloadConstructionArtAssets } from '../src/render/constructionArtAssets';

test('failed image loading settles all records and retains renderer fallback', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  class FailedImage {
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FailedImage });
  try {
    await preloadConstructionArtAssets();
    const statuses = constructionArtAssetStatuses();
    assert.equal(statuses.length, 9);
    assert.ok(statuses.every(value => value.status === 'missing'));
    assert.deepEqual(statuses.filter(value => value.usage === 'reserved').map(value => value.key), ['wall', 'salvage', 'smoke']);
    assert.ok(statuses.every(value => value.url.startsWith('/assets/') && !value.url.startsWith('//')));
  } finally {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});
