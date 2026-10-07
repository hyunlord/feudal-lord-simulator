import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createSpringWorldArt } from '../src/render/art/springWorldArt';
import { springPasturePlacement, drawSpringPasture, type SpringPastureState } from '../src/render/springPasture';
import type { FarmProp } from '../src/render/farmProps';

const flock: FarmProp = { kind: 'sheep_flock', x: 4, y: 4, id: 'farm-prop:pasture:44' };
function state(): SpringPastureState {
  return { width: 10, tiles: Array.from({ length: 100 }, (_, i) => ({ tx: i % 10, ty: Math.floor(i / 10), terrain: 'grass', buildingId: null, hasRoad: false })), zones: [{ id: 'pasture', kind: 'pasture', membership: Array.from({ length: 100 }, (_, i) => i), strokes: [], createdOrdinal: 0 }] };
}
async function readyArt() {
  const images: HTMLImageElement[] = [];
  const bundle = catalog.find(bundle => bundle.bundleId === 'wave43-spring-context'); assert.ok(bundle);
  const art = createSpringWorldArt(createArtRegistry([bundle]), { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 128, naturalHeight: 96, decode: async () => {}, onload: null, onerror: null, src: '' }); images.push(image); return image;
  } });
  art.resolve('ewe-lamb'); for (const image of images) image.onload?.call(image, new Event('load'));
  await Promise.all(['a', 'b'].map(v => art.loadSettled(`wave43:ewe_lamb_${v}_spring`))); return art;
}

test('spring ewe placement is stable, near existing sheep, at same depth, without state mutation', async () => {
  const art = await readyArt(); const input = state(); const before = structuredClone(input);
  const placement = springPasturePlacement(input, flock, [flock], 0, 0.6, art); assert.ok(placement);
  assert.equal(placement.y, 128); assert.ok(Math.abs(placement.x) > 28 && Math.abs(placement.x) < 40);
  assert.deepEqual(springPasturePlacement(input, flock, [flock], 0, 1.4, art), placement);
  assert.deepEqual(input, before);
});

test('wrong season, cattle, missing context, blocked support and unavailable art omit companion', async () => {
  const art = await readyArt(); const input = state();
  for (const season of [1, 2, 3]) assert.equal(springPasturePlacement(input, flock, [flock], season, 1, art), null);
  assert.equal(springPasturePlacement(input, { ...flock, kind: 'cattle_pair' }, [flock], 0, 1, art), null);
  assert.equal(springPasturePlacement(input, flock, [flock], 0, 0.59, art), null);
  assert.equal(springPasturePlacement({ ...input, zones: [] }, flock, [flock], 0, 1, art), null);
  for (const patch of [{ terrain: 'water' as const }, { hasRoad: true }, { buildingId: 'occupied' }]) {
    assert.equal(springPasturePlacement({ ...input, tiles: input.tiles.map(tile => ({ ...tile, ...patch })) }, flock, [flock], 0, 1, art), null);
  }
  assert.equal(springPasturePlacement({ ...input, zones: (input.zones ?? []).map(zone => ({ ...zone, kind: 'arable' })) }, flock, [flock], 0, 1, art), null);
  const unavailable = createSpringWorldArt(createArtRegistry([]));
  assert.equal(springPasturePlacement(input, flock, [flock], 0, 1, unavailable), null);
});

test('narrow pasture and nearby flocks reject unsupported or overlapping candidates', async () => {
  const art = await readyArt(); const input = state();
  const narrow = { ...input, zones: (input.zones ?? []).map(zone => ({ ...zone, membership: [44] })) };
  assert.equal(springPasturePlacement(narrow, flock, [flock], 0, 1, art), null);
  const neighbors: FarmProp[] = [-1, 1].map(sign => ({ ...flock, id: `neighbor-${sign}`, x: 4 + sign * 0.5, y: 4 - sign * 0.5 }));
  assert.equal(springPasturePlacement(input, flock, [flock, ...neighbors], 0, 1, art), null);
});

test('consumer draws full source with native scale/pivot and never mirrors', async () => {
  const art = await readyArt(); const input = state(); const calls: unknown[][] = [];
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), { globalAlpha: 0.8, imageSmoothingEnabled: false, save() {}, restore() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), drawImage: (...args: unknown[]) => calls.push(args) });
  assert.equal(drawSpringPasture(context, input, flock, [flock], 0, 1, art), true);
  assert.deepEqual(calls[0]?.slice(1, 5), [0, 0, 128, 96]); assert.deepEqual(calls[0]?.slice(-2), [23, 17.25]); assert.equal(context.globalAlpha, 0.8);
});

test('Given a decoded herd crop When spring companions are placed Then their gap follows the new crop bounds instead of the legacy canvas', async () => {
  // Given
  const { createFarmPropArt } = await import('../src/render/farmPropArt');
  const images: HTMLImageElement[] = [];
  const herd = createFarmPropArt(createArtRegistry(catalog), { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 512, naturalHeight: 96, decode: async () => {}, onload: null, onerror: null, src: '' }); images.push(image); return image;
  } });
  const entry = herd.select(flock); assert.ok(entry); herd.ready(flock);
  for (const image of images) image.onload?.call(image, new Event('load'));
  await herd.loadSettled(entry.id);
  const art = await readyArt();
  // When
  const placement = springPasturePlacement(state(), flock, [flock], 0, 1, art, herd.bounds);
  // Then
  assert.ok(placement); const bounds = herd.bounds(flock); assert.ok(bounds);
  const selected = art.entry(placement.id); assert.ok(selected);
  const left = placement.x - selected.geometry.pivot.x * selected.geometry.scale;
  const right = left + selected.image.width * selected.geometry.scale;
  assert.ok(Math.abs(left - bounds.x - bounds.width - 4) < 1e-8 || Math.abs(bounds.x - right - 4) < 1e-8);
  assert.equal(placement.y, 128);
});
