import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import type { ArtBundle } from '../src/render/art/artContract';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createSeasonalGroundArt } from '../src/render/art/seasonalGroundArt';
import { createArtImageLoader } from '../src/render/art/artImageLoader';
import { drawWave7, preloadWave7Art, wave7Art } from '../src/render/wave7Art';
import { WAVE7_ART } from '../src/render/wave7ArtManifest.generated';
import { drawSeasonalDecals, seasonalDecal } from '../src/render/seasonalDecals';
import { resetSeasonBlendForTest } from '../src/render/seasonTransition';
import { tileToScreen, TILE_H } from '../src/render/iso';

const bundles = catalog as readonly ArtBundle[];
const leafBundle = bundles.find(bundle => bundle.bundleId === 'wave7-seasonal-ground-old3');
assert.ok(leafBundle);
const registry = createArtRegistry([leafBundle]);

type FakeImage = HTMLImageElement & { src: string; naturalWidth: number; naturalHeight: number; onload: ((this: HTMLImageElement, ev: Event) => unknown) | null; onerror: ((this: HTMLImageElement, ev: Event) => unknown) | null; decode: () => Promise<void> };
function fakeImage(width = 96, height = 48): FakeImage {
  const image = Object.create(null) as FakeImage;
  Object.assign(image, { src: '', naturalWidth: width, naturalHeight: height, onload: null, onerror: null, decode: () => new Promise<void>(() => undefined) });
  return image;
}
function context() {
  const calls: unknown[][] = [];
  const canvas = Object.assign(Object.create(null), { imageSmoothingEnabled: false, save() {}, restore() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), drawImage: (...args: unknown[]) => { calls.push(args); } }) as CanvasRenderingContext2D;
  return { canvas, calls };
}
function withImageConstructor(images: readonly FakeImage[], run: () => void): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  let index = 0;
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: function Image() { const image = images[index]; index += 1; if (image === undefined) throw new Error('unexpected Image allocation'); return image; } });
  try { run(); }
  finally {
    if (previous === undefined) delete (globalThis as { Image?: unknown }).Image;
    else Object.defineProperty(globalThis, 'Image', previous);
  }
}

test('seasonal-ground registry accepts the complete old3 family and rejects partial or wrong semantic slots', () => {
  assert.deepEqual(registry.entries('ground-prop').map(entry => entry.id), ['leaves_a', 'leaves_b', 'leaves_c']);
  assert.deepEqual([0, 1, 2, 3, -1].map(seed => registry.select('ground-prop', 'seasonal-leaves', { season: 'autumn', placement: 'seasonal-ground' }, seed)?.id), ['leaves_a', 'leaves_b', 'leaves_c', 'leaves_a', 'leaves_c']);
  const oneEntry = { ...leafBundle, entries: leafBundle.entries.slice(0, 2) };
  assert.throws(() => createArtRegistry([oneEntry]));
  const wrongKind = { ...leafBundle, rules: [{ ...leafBundle.rules[0]!, kind: 'land-stage' }] };
  assert.throws(() => createArtRegistry([wrongKind]));
  const wrongOrder = { ...leafBundle, rules: [{ ...leafBundle.rules[0]!, variants: [...leafBundle.rules[0]!.variants].reverse() }] };
  assert.throws(() => createArtRegistry([wrongOrder]));
  const firstEntry = leafBundle.entries.find(entry => entry.id === 'leaves_a');
  assert.ok(firstEntry?.kind === 'ground-prop' && firstEntry.placement === 'seasonal-ground');
  const footprint = { ...leafBundle, entries: [{ ...firstEntry, geometry: { ...firstEntry.geometry, footprint: { width: 1, height: 1 } } }, ...leafBundle.entries.filter(entry => entry.id !== firstEntry.id)] };
  assert.throws(() => createArtRegistry([footprint]));
});

test('empty registries do not create a hidden legacy leaf loader', () => {
  const facade = createSeasonalGroundArt(createArtRegistry([]), { baseUrl: '/', createImage: () => { throw new Error('must not allocate'); } });
  assert.equal(facade.owns('leaves_a'), false);
  assert.equal(facade.image('leaves_a'), null);
  assert.equal(facade.draw(context().canvas, 'leaves_a', 0, 0, 0.5), false);
});

test('seasonal-ground images become independently ready on onload without waiting for decode', async () => {
  const first = fakeImage(); const second = fakeImage(); let allocations = 0;
  const facade = createSeasonalGroundArt(registry, { baseUrl: '/game/', createImage: () => { allocations += 1; return allocations === 1 ? first : second; } });
  assert.equal(facade.image('leaves_a'), null);
  assert.equal(facade.image('leaves_b'), null);
  first.onload?.call(first, new Event('load'));
  assert.equal(facade.status('leaves_a').status, 'ready');
  assert.equal(facade.image('leaves_a'), first);
  assert.equal(facade.status('leaves_b').status, 'loading');
  assert.equal(facade.image('leaves_b'), null);
  assert.deepEqual(await facade.loadSettled('leaves_a'), { status: 'ready', reason: null });
  assert.equal(first.src, '/game/assets/wave7/season/leaves_a-v1.png');
});

test('seasonal-ground onload still rejects wrong native dimensions', async () => {
  const bad = fakeImage(95, 48);
  const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => bad });
  const pending = loader.loadSettled('leaves_a');
  bad.onload?.call(bad, new Event('load'));
  const state = await pending;
  assert.equal(state.status, 'missing');
  assert.match(state.reason ?? '', /Decoded size 95x48/);
  assert.equal(loader.image('leaves_a'), null);
});

test('wave7 leaf draw uses caller absolute scale and full-canvas pivot', () => {
  const image = fakeImage();
  withImageConstructor([image], () => {
    assert.equal(wave7Art('leaves_a'), null);
    image.onload?.call(image, new Event('load'));
    const { canvas, calls } = context();
    assert.equal(drawWave7(canvas, 'leaves_a', 100, 200, 0.5), true);
    assert.deepEqual(calls.at(-1)?.slice(1), [0, 0, 96, 48, 76, 177, 48, 24]);
  });
});

test('wave7 preload preserves manifest order and include predicate positions while routing old3 leaves through catalog', () => {
  const urls: string[] = [];
  const images = Array.from({ length: Object.keys(WAVE7_ART).length }, () => fakeImage());
  withImageConstructor(images, () => {
    preloadWave7Art(url => { urls.push(url); return url.includes('/season/'); });
    for (const image of images) if (image.src.includes('/season/leaves_')) image.onload?.call(image, new Event('load'));
  });
  assert.deepEqual(urls, Object.values(WAVE7_ART).map(entry => entry.url));
  for (const leaf of ['leaves_a', 'leaves_b', 'leaves_c'] as const) assert.equal(wave7Art(leaf) === null || wave7Art(leaf)?.src.endsWith(WAVE7_ART[leaf].url), true);
});

test('drawSeasonalDecals keeps the old autumn tile anchor and inherited alpha', () => {
  const tile = { tx: 0, ty: 0, terrain: 'grass', buildingId: null, hasRoad: false } as const;
  let chosen: 'leaves_a' | 'leaves_b' | 'leaves_c' | null = null;
  let seed = 0;
  for (; seed < 10_000; seed += 1) {
    chosen = seasonalDecal(seed, tile, 2) as typeof chosen;
    if (chosen !== null) break;
  }
  assert.ok(chosen);
  const image = fakeImage();
  withImageConstructor([image], () => {
    wave7Art(chosen); image.onload?.call(image, new Event('load'));
    const { canvas, calls } = context();
    canvas.globalAlpha = 0.42;
    resetSeasonBlendForTest();
    drawSeasonalDecals(canvas, { seed, tick: 2_000, scenarioId: 'core:campaign_market_town' } as never, [tile as never], 0.6);
    const at = tileToScreen(tile.tx, tile.ty);
    assert.equal(canvas.globalAlpha, 0.42);
    assert.deepEqual(calls.at(-1)?.slice(1), [0, 0, 96, 48, at.sx - 24, at.sy + TILE_H * 0.35 - 23, 48, 24]);
  });
});
