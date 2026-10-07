import test from 'node:test';
import assert from 'node:assert/strict';
import { createWashPoolArt, WASH_POOL_ID } from '../src/render/washPoolArt';
import { createArtRegistry } from '../src/render/art/artRegistry';
import catalog from '../src/render/art/catalog.json';
function image(width = 192) {
  const element: HTMLImageElement = Object.create(null);
  Object.assign(element, { naturalWidth: width, naturalHeight: 128, onload: null, onerror: null, src: '', decode: () => Promise.resolve() });
  return element;
}
test('wash image loads lazily once; decode readiness releases placement', async () => {
  const fake = image(); let allocations = 0;
  const art = createWashPoolArt({ baseUrl: '/game/', createImage: () => { allocations++; return fake; } });
  assert.equal(allocations, 0);
  assert.equal(art.readyEntry(), null); assert.equal(art.readyEntry(), null);
  assert.equal(allocations, 1);
  fake.onload?.call(fake, new Event('load'));
  await art.loadSettled(WASH_POOL_ID);
  assert.equal(art.readyEntry()?.id, WASH_POOL_ID);
  assert.equal(fake.src, '/game/assets/wave3/pasture/wash_pool-v1.png');
});
test('missing and malformed images leave empty fallback', async () => {
  const unavailable = createWashPoolArt({ baseUrl: '/', createImage: null });
  assert.equal(unavailable.readyEntry(), null);
  const bad = image(1), art = createWashPoolArt({ baseUrl: '/', createImage: () => bad });
  assert.equal(art.readyEntry(), null);
  bad.onload?.call(bad, new Event('load')); await art.loadSettled(WASH_POOL_ID);
  assert.equal(art.readyEntry(), null);
  assert.equal(art.status(WASH_POOL_ID).status, 'missing');
});
test('facility contract coexists with all existing catalog kinds and rejects absent building facts', () => {
  const registry = createArtRegistry(catalog);
  assert.equal(registry.entry(WASH_POOL_ID)?.kind, 'ground-prop');
  const invalid = structuredClone(catalog);
  for (const bundle of invalid) for (const entry of bundle.entries) if (entry.id === WASH_POOL_ID) Reflect.deleteProperty(entry, 'buildingKinds');
  assert.throws(() => createArtRegistry(invalid));
});
