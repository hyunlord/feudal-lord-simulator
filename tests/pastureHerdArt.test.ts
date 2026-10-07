import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import catalog from '../src/render/art/catalog.json';
import metadata from '../assets-inbox/wave13/candidates-v1/records/metadata-herds.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { WAVE13_ANIMAL_SCALE } from '../src/render/animalScale';

const bundle = () => {
  const found = catalog.find(value => value.bundleId === 'core-wave13-pasture-herds');
  assert.ok(found, 'installed pasture herd contract');
  return found;
};

test('Given the Wave13 static sheep sheet When the installed contract is read Then four native crops share one unchanged image and common animal scale', () => {
  // Given
  const registry = createArtRegistry([bundle()]);
  const source = metadata.find(value => value.id === 'herd/sheep_cluster_moving_a-v1');
  assert.ok(source);
  assert.equal(source.qa.staticCluster, true); assert.equal(source.qa.animation, false);
  // When
  const entries = registry.entries('ground-prop');
  // Then
  assert.equal(entries.length, 4);
  for (const [index, entry] of entries.entries()) {
    assert.equal(entry.kind, 'ground-prop'); if (entry.kind !== 'ground-prop') continue;
    assert.deepEqual(entry.geometry.crop, { x: index * 128, y: 0, width: 128, height: 96 });
    assert.deepEqual(entry.geometry.pivot, { x: index * 128 + 64, y: 63 });
    assert.equal(entry.geometry.scale, WAVE13_ANIMAL_SCALE);
    assert.equal(entry.geometry.allowMirror, false); assert.equal('frames' in entry, false);
    const runtime = readFileSync(new URL(`../public/${entry.image.url}`, import.meta.url));
    const inbox = readFileSync(new URL(`../${entry.provenance.inboxFile}`, import.meta.url));
    assert.deepEqual(runtime, inbox);
    assert.equal(createHash('sha256').update(runtime).digest('hex'), entry.provenance.runtimeSha256);
  }
});

async function herdHarness() {
  const { createFarmPropArt } = await import('../src/render/farmPropArt');
  const images: HTMLImageElement[] = [];
  const art = createFarmPropArt(createArtRegistry([bundle()]), { baseUrl: '/test/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 512, naturalHeight: 96, decode: async () => {}, onload: null, onerror: null, src: '' });
    images.push(image); return image;
  } });
  return { art, images };
}
const flock = { kind: 'sheep_flock', x: 4, y: 4, id: 'farm-prop:pasture:44' } as const;
function canvas() {
  const calls: unknown[][] = [];
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), { globalAlpha: 1, imageSmoothingEnabled: false, save() {}, restore() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), drawImage: (...args: unknown[]) => calls.push(args) });
  return { calls, context };
}

test('Given a ready static herd When selected and drawn Then the crop and pivot remain deterministic at the unchanged world anchor', async () => {
  // Given
  const { art, images } = await herdHarness(); const entry = art.select(flock); assert.ok(entry);
  assert.equal(art.ready(flock), null);
  for (const image of images) image.onload?.call(image, new Event('load'));
  await art.loadSettled(entry.id);
  const { context, calls } = canvas();
  // When
  assert.equal(art.draw(context, flock), true);
  // Then
  assert.deepEqual(art.select({ ...flock }), entry);
  const bounds = art.bounds(flock); assert.ok(bounds);
  assert.deepEqual(calls[0]?.slice(1, 5), [entry.geometry.crop?.x, 0, 128, 96]);
  assert.deepEqual(calls[0]?.slice(5), [bounds.x, bounds.y, bounds.width, bounds.height]);
  assert.equal(bounds.x + 64 * WAVE13_ANIMAL_SCALE, 0);
  assert.equal(bounds.y + 63 * WAVE13_ANIMAL_SCALE, 128);
});

test('Given loading or failed herd art When rendered Then the legacy image and legacy bounds stay paired', async () => {
  // Given
  const { setZoneAssetsForTest } = await import('../src/render/zoneAssets');
  const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 128, naturalHeight: 96 });
  setZoneAssetsForTest({ sheep_flock: image });
  try {
    for (const fail of [false, true]) {
      const { art, images } = await herdHarness(); const entry = art.select(flock); assert.ok(entry);
      art.ready(flock);
      if (fail) { for (const pending of images) pending.onerror?.call(pending, new Event('error')); await art.loadSettled(entry.id); }
      const { context, calls } = canvas();
      // When
      assert.equal(art.draw(context, flock), true);
      // Then
      assert.deepEqual(art.bounds(flock), { x: -15, y: 108.3125, width: 30, height: 22.5 });
      assert.equal(calls[0]?.[0], image); assert.deepEqual(calls[0]?.slice(1, 5), [0, 0, 128, 96]);
    }
  } finally { setZoneAssetsForTest({ sheep_flock: null }); }
});

test('Given unavailable or wrong-size herd art When queried Then no invented actor or empty replacement is returned', async () => {
  // Given
  const { art, images } = await herdHarness(); const entry = art.select(flock); assert.ok(entry);
  art.ready(flock);
  for (const image of images) { Object.defineProperty(image, 'naturalWidth', { value: 128 }); image.onload?.call(image, new Event('load')); }
  await art.loadSettled(entry.id);
  // When / Then
  assert.equal(art.ready(flock), null);
  assert.equal(art.select({ ...flock, kind: 'cattle_pair' }), null);
  assert.equal(art.select({ ...flock, kind: 'sheep_flock_b' }), null);
  assert.equal(art.draw(canvas().context, flock), false);
});

test('Given static farm-prop contracts When animation or out-of-sheet crops are supplied Then registry construction rejects them', () => {
  // Given
  const good = bundle();
  // When / Then
  for (const patch of [{ animation: true }, { staticCluster: false }, { geometry: { pivot: { x: 64, y: 63 }, crop: { x: 500, y: 0, width: 128, height: 96 }, scale: 1, allowMirror: false } }]) {
    const invalid = { ...good, entries: good.entries.map(entry => ({ ...entry, ...patch })) };
    assert.throws(() => createArtRegistry([invalid]));
  }
});
