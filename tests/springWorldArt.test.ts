import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { ArtRegistryStore, createArtRegistry } from '../src/render/art/artRegistry';
import { createSpringWorldArt } from '../src/render/art/springWorldArt';

const bundle = catalog.find(bundle => bundle.bundleId === 'wave43-spring-context');
assert.ok(bundle);
const registry = createArtRegistry([bundle]);

test('spring family requires eight native entries and spring-only deterministic static ewe variants', () => {
  assert.equal(registry.entries().length, 8);
  const context = { season: 'spring', placement: 'spring-context', role: 'ewe-lamb', group: 'all' };
  const a = registry.select('ground-prop', 'spring-ewe-lamb', context, 0);
  const b = registry.select('ground-prop', 'spring-ewe-lamb', context, 1);
  assert.ok(a && b); assert.notEqual(a.id, b.id);
  assert.equal(registry.select('ground-prop', 'spring-ewe-lamb', context, 2)?.id, a.id);
  for (const season of ['summer', 'autumn', 'winter']) assert.equal(registry.select('ground-prop', 'spring-ewe-lamb', { ...context, season }, 0), null);
});

test('malformed geometry, family and rules reject atomically', () => {
  const store = new ArtRegistryStore([bundle]); const before = store.registry;
  const first = bundle.entries[0]; assert.ok(first);
  for (const broken of [
    { ...bundle, entries: bundle.entries.slice(1) },
    { ...bundle, rules: bundle.rules.slice(1) },
    { ...bundle, entries: [{ ...first, minZoom: 0 }, ...bundle.entries.slice(1)] },
    { ...bundle, entries: [{ ...first, geometry: { pivot: { x: 1, y: 1 }, scale: 1, allowMirror: false } }, ...bundle.entries.slice(1)] },
    { ...bundle, rules: bundle.rules.map(rule => ({ ...rule, conditions: [] })) },
  ]) { assert.throws(() => store.replace([broken])); assert.equal(store.registry, before); }
});

test('absent family has no hidden loader', () => {
  const art = createSpringWorldArt(createArtRegistry([]), { baseUrl: '/', createImage: () => { throw new Error('unexpected load'); } });
  assert.equal(art.resolve('ewe-lamb'), null); assert.equal(art.select('cherry', 0), null);
});

function harness(failId?: string) {
  const images: HTMLImageElement[] = [];
  const art = createSpringWorldArt(registry, { baseUrl: '/game/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { src: '', naturalWidth: 128, naturalHeight: 96, onload: null, onerror: null, decode: async () => { if (image.src.includes(failId ?? 'NO_FAILURE')) throw new Error('decode failure'); } });
    images.push(image); return image;
  } });
  return { art, images };
}

test('a role becomes ready only after all members decode; failure keeps deterministic fallback', async () => {
  for (const failId of [undefined, 'ewe_lamb_b']) {
    const { art, images } = harness(failId);
    assert.equal(art.resolve('ewe-lamb'), null); assert.equal(images.length, 2);
    const first = images[0]; const second = images[1]; assert.ok(first && second);
    first.onload?.call(first, new Event('load')); await art.loadSettled('wave43:ewe_lamb_a_spring');
    assert.equal(art.select('ewe-lamb', 0), null);
    second.onload?.call(second, new Event('load')); await art.loadSettled('wave43:ewe_lamb_b_spring');
    assert.equal(art.resolve('ewe-lamb')?.length ?? null, failId ? null : 2);
    assert.equal(art.select('ewe-lamb', 0)?.id ?? null, failId ? null : 'wave43:ewe_lamb_a_spring');
  }
});

test('full native sprite draw preserves source pivot, scale, inherited alpha and minZoom', async () => {
  const { art, images } = harness(); art.resolve('ewe-lamb');
  for (const image of images) image.onload?.call(image, new Event('load'));
  await Promise.all(['a', 'b'].map(variant => art.loadSettled(`wave43:ewe_lamb_${variant}_spring`)));
  const calls: unknown[][] = [];
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), { globalAlpha: 0.37, imageSmoothingEnabled: false, save() {}, restore() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), drawImage: (...args: unknown[]) => calls.push(args) });
  assert.equal(art.draw(context, 'wave43:ewe_lamb_a_spring', 100, 200, 0.59), false);
  assert.equal(art.draw(context, 'wave43:ewe_lamb_a_spring', 100, 200, 0.6), true);
  assert.deepEqual(calls[0]?.slice(1), [0, 0, 128, 96, 100 - 67 * 23 / 128, 200 - 69 * 23 / 128, 23, 17.25]);
  assert.equal(context.globalAlpha, 0.37);
  assert.equal(art.draw(context, 'wave43:ewe_lamb_b_spring', 100, 200, 1), true);
  assert.deepEqual(calls[1]?.slice(1), [0, 0, 128, 96, 100 - 65 * 23 / 128, 200 - 77 * 23 / 128, 23, 17.25]);
});
