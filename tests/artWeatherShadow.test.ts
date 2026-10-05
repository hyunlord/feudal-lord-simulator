import assert from 'node:assert/strict';
import test from 'node:test';
import baseline from './fixtures/weather-shadow-migration.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createWeatherShadowArt } from '../src/render/art/weatherShadowArt';

test('weather-shadow absence works, complete base works, partial ownership fails', () => {
  assert.doesNotThrow(() => createArtRegistry([]));
  assert.doesNotThrow(() => createArtRegistry([baseline]));
  for (const broken of [
    { ...baseline, rules: [] }, { ...baseline, entries: [] },
    { ...baseline, rules: baseline.rules.slice(1) },
  ]) assert.throws(() => createArtRegistry([broken]));
});
test('non-normal and unavailable browser never paint', () => {
  const art = createWeatherShadowArt(createArtRegistry([baseline]), { createImage: null, baseUrl: '/' });
  for (const weather of ['wet', 'dry', 'cold', null] as const) assert.equal(art.resolve(weather), null);
  assert.deepEqual(art.resolve('normal'), { family: 'base', lower: null, upper: null });
});

const variants = {
  ...baseline, bundleId: 'cloud-variants',
  entries: baseline.entries.map(entry => ({ ...entry, id: `${entry.id}-new`, image: { ...entry.image, url: entry.image.url.replace('.png', '-new.png'), height: 256 }, geometry: { ...entry.geometry, pivot: { x: 256, y: 128 } } })),
  rules: baseline.rules.map(rule => ({ ...rule, id: rule.id.replace('base', 'variant'), slot: rule.slot.replace('base', 'variant'), variants: rule.variants.map(variant => ({ ...variant, assetId: `${variant.assetId}-new` })) })),
};
function fakeImages(withVariants = true) {
  const images: HTMLImageElement[] = [];
  const registry = createArtRegistry(withVariants ? [baseline, variants] : [baseline]);
  const art = createWeatherShadowArt(registry, { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { src: '', naturalWidth: 512, naturalHeight: 512, onload: null, onerror: null, decode: () => Promise.resolve() });
    images.push(image); return image;
  } });
  async function settle(index: number, failure?: 'request' | 'decode' | 'size') {
    const image = images[index]; assert.ok(image);
    Object.defineProperty(image, 'naturalHeight', { value: failure === 'size' ? 1 : index >= 2 ? 256 : 512, configurable: true });
    if (failure === 'decode') image.decode = () => Promise.reject(new Error('decode failure'));
    if (failure === 'request') image.onerror?.call(image, new Event('error'));
    else image.onload?.call(image, new Event('load'));
    await Promise.resolve(); await Promise.resolve();
  }
  return { art, images, settle };
}
test('base decks ready independently; optional pair freezes atomically in each frame', async () => {
  const f = fakeImages();
  assert.equal(f.images.length, 0);
  for (const weather of ['wet', 'dry', 'cold', null] as const) assert.equal(f.art.resolve(weather), null);
  assert.equal(f.images.length, 0);
  f.art.resolve('normal'); assert.equal(f.images.length, 4);
  await f.settle(0);
  const lowerOnly = f.art.resolve('normal'); assert.ok(lowerOnly?.lower); assert.equal(lowerOnly.upper, null);
  await f.settle(1); await f.settle(2);
  const oldFrame = f.art.resolve('normal'); assert.equal(oldFrame?.family, 'base');
  await f.settle(3);
  assert.equal(oldFrame?.family, 'base'); assert.ok(oldFrame?.upper?.entry.id.endsWith('-b'));
  const next = f.art.resolve('normal'); assert.equal(next?.family, 'variant');
  assert.ok(Object.isFrozen(next));
  for (let i = 0; i < 20; i++) f.art.resolve('normal');
  assert.equal(f.images.length, 4, 'one lazy shared loader, no retry or per-frame images');
});
for (const failure of ['request', 'decode', 'size'] as const) test(`optional ${failure} failure is terminal and retains base pair`, async () => {
  const f = fakeImages(); f.art.resolve('normal');
  await f.settle(0); await f.settle(1); await f.settle(3); await f.settle(2, failure);
  for (let i = 0; i < 5; i++) assert.equal(f.art.resolve('normal')?.family, 'base');
  assert.equal(f.images.length, 4);
});
test('optional upper-only cannot replace ready base lower', async () => {
  const f = fakeImages(); f.art.resolve('normal'); await f.settle(0); await f.settle(3);
  const receipt = f.art.resolve('normal'); assert.equal(receipt?.family, 'base'); assert.ok(receipt?.lower); assert.equal(receipt.upper, null);
});
test('malformed rule/geometry rejects atomically before any image is constructed', () => {
  const entry = baseline.entries[0]; const rule = baseline.rules[0]; assert.ok(entry && rule);
  const invalid = [
    { ...baseline, entries: [{ ...entry, geometry: { ...entry.geometry, pivot: { x: 1, y: 256 } } }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, geometry: { ...entry.geometry, scale: 2 } }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, geometry: { ...entry.geometry, crop: { x: 0, y: 0, width: 1, height: 1 } } }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, geometry: { ...entry.geometry, allowMirror: true } }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, image: { ...entry.image, height: 1024 } }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, opacityMax: 1 }, baseline.entries[1]] },
    { ...baseline, entries: [{ ...entry, deck: 'upper' }, baseline.entries[1]] },
    ...['wet', 'dry', 'cold', 'unknown'].map(value => ({ ...baseline, rules: [{ ...rule, conditions: [{ op: 'eq', field: 'weather', value }] }, baseline.rules[1]] })),
    ...[NaN, Infinity, -1].map(width => ({ ...baseline, entries: [{ ...entry, image: { ...entry.image, width } }, baseline.entries[1]] })),
    ...[{ slot: 'cloud-extra' }, { priority: 1 }, { conditions: [] }, { variants: [{ assetId: entry.id, weight: 2 }] }, { variants: [{ assetId: 'missing', weight: 1 }] }].map(change => ({ ...baseline, rules: [{ ...rule, ...change }, baseline.rules[1]] })),
  ];
  let requests = 0;
  for (const data of invalid) assert.throws(() => createWeatherShadowArt(createArtRegistry([data]), { baseUrl: '/', createImage: () => { requests++; throw new Error('Must not load'); } }));
  assert.equal(requests, 0);
  assert.throws(() => createArtRegistry([baseline, { ...variants, rules: variants.rules.slice(1) }]));
  assert.throws(() => createArtRegistry([baseline, { ...variants, rules: variants.rules.map(rule => ({ ...rule, variants: [{ assetId: baseline.entries[0]?.id, weight: 1 }] })) }]));
});

test('old square rectangles are bit-exact; rectangular variants keep center and uniform world width', async () => {
  const { CLOUD_DECKS, cloudSprites } = await import('../src/render/weatherPlacement');
  const f = fakeImages(); f.art.resolve('normal'); await f.settle(0); await f.settle(1);
  const old = f.art.resolve('normal'); assert.ok(old);
  const calls: number[][] = []; let depth = 0;
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), {
    imageSmoothingEnabled: false, save() { depth++; }, restore() { depth--; },
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    drawImage(_image: CanvasImageSource, ...coordinates: number[]) { calls.push(coordinates); },
  });
  for (const [index, deck] of CLOUD_DECKS.entries()) for (const nowMs of [0, 1234, 60000, 3600000]) {
    const positions = [...cloudSprites(deck, { x: -2000, y: -1000, width: 4000, height: 2600 }, nowMs), { x: 123.4, y: 1e-8 }];
    for (const origin of positions) {
      assert.equal(f.art.drawResolved(context, old, index === 0 ? 'lower' : 'upper', { origin, size: deck.size }), true);
      assert.deepEqual(calls.at(-1), [0, 0, 512, 512, origin.x, origin.y, deck.size, deck.size]);
    }
  }
  await f.settle(2); await f.settle(3); const next = f.art.resolve('normal'); assert.ok(next);
  assert.equal(f.art.drawResolved(context, next, 'lower', { origin: { x: 123.4, y: 200 }, size: 614.4 }), true);
  assert.deepEqual(calls.at(-1), [0, 0, 512, 256, 123.4, 353.6, 614.4, 307.2]);
  assert.equal(depth, 0);
  context.drawImage = () => { throw new Error('native blit failed'); };
  assert.throws(() => f.art.drawResolved(context, next, 'lower', { origin: { x: 0, y: 0 }, size: 614.4 })); assert.equal(depth, 0);
  for (const size of [0, -1, Infinity, NaN]) assert.throws(() => f.art.drawResolved(context, next, 'lower', { origin: { x: 0, y: 0 }, size }));
});
test('canonical82 migration keeps exact80 and repeated generation cannot resurrect either cloud', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseCsv } = await import('../scripts/provenanceLedgerCsv');
  const { legacyWave23Records } = await import('../scripts/wave23CloudOwnership');
  const { WAVE23_IMAGES } = await import('../src/render/wave23ArtManifest.generated');
  const [header, ...rows] = parseCsv(readFileSync('assets-inbox/wave23/candidates-20260928/records/assets.csv', 'utf8').replace(/^\uFEFF/, ''));
  assert.ok(header);
  const canonical = rows.filter(row => row.length === header.length).map(row => {
    const record = Object.fromEntries(header.map((column, index) => [column, row[index]]));
    const file = record.file; assert.ok(file); const digest = record.sha256; assert.ok(digest);
    const filename = file.split('/').at(-1); assert.ok(filename);
    const stem = filename.replace('.png', '').replace(/^newborn/, 'child_born');
    return { key: stem, url: `assets/wave23/${file.split('/').at(-2)}/${stem}.png`, sha256: digest };
  });
  const first = legacyWave23Records(canonical, [baseline]);
  assert.equal(first.length, 80); assert.deepEqual(legacyWave23Records(canonical, [baseline]), first);
  assert.deepEqual(Object.keys(WAVE23_IMAGES).sort(), first.map(row => row.key).sort());
  assert.throws(() => legacyWave23Records(first, [baseline]), 'already filtered80 must not be used as canonical');
  assert.throws(() => legacyWave23Records(canonical, []));
  assert.throws(() => legacyWave23Records(canonical.map(row => ({ ...row, sha256: '0'.repeat(64) })), [baseline]));
});
