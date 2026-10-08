import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createNatureArt } from '../src/render/art/natureArt';
import { accumulatedLeafSpots, liveDeciduousTrees } from '../src/render/natureTreeModel';
import { c25BoardState } from '../scripts/c25Board';

const bundle = catalog.find(value => value.bundleId === 'wave39-nat3-world');
assert.ok(bundle);
const registry = createArtRegistry([bundle]);
test('nature contract keeps 50 candidates and rejects partial or misrouted families', () => {
  assert.equal(registry.entries().length, 50);
  assert.throws(() => createArtRegistry([{ ...bundle, entries: bundle.entries.slice(1) }]));
  assert.throws(() => createArtRegistry([{ ...bundle, rules: bundle.rules.map(rule => ({ ...rule, slot: 'nature-wrong' })) }]));
});
test('rain family remains legacy-owned until every decoded image is ready', async () => {
  const sources = registry.entries('weather-particle').filter(entry => entry.kind === 'weather-particle' && entry.role === 'rain');
  const images: HTMLImageElement[] = [];
  const facade = createNatureArt(registry, { baseUrl: '/', createImage: () => {
    const source = sources[images.length]; assert.ok(source);
    const image = Object.assign(Object.create(null), { naturalWidth: source.image.width, naturalHeight: source.image.height,
      src: '', onload: null, onerror: null, decode: () => Promise.resolve() }) as HTMLImageElement;
    images.push(image); return image;
  } });
  assert.equal(facade.resolve('rain'), null); assert.equal(images.length, 12);
  for (const image of images.slice(0, 11)) image.onload?.call(image, new Event('load'));
  await Promise.resolve();
  assert.equal(facade.resolve('rain'), null);
  const last = images[11]; assert.ok(last); last.onload?.call(last, new Event('load'));
  await Promise.resolve();
  const ready = facade.resolve('rain'); assert.ok(ready); assert.equal(ready.length, 12);
  const selected = ['faint', 'strong'].flatMap(group => Array.from({ length: 6 }, (_, seed) => facade.select(ready, 'rain', group, seed)?.entry.id));
  assert.equal(new Set(selected).size, 12);
  assert.ok(selected.every(id => id !== undefined));
});
test('accumulation grows monotonically at live tree edges and disappears by late winter', () => {
  const state = c25BoardState(); const trees = liveDeciduousTrees(state); assert.ok(trees.length > 0);
  const early = accumulatedLeafSpots({ ...state, tick: 2100 }, trees);
  const late = accumulatedLeafSpots({ ...state, tick: 2850 }, trees);
  assert.ok(late.length > early.length);
  for (const spot of early) assert.ok(late.some(candidate => candidate.tile.tx === spot.tile.tx && candidate.tile.ty === spot.tile.ty));
  for (const spot of late) {
    assert.equal(spot.tile.hasRoad, false); assert.equal(spot.tile.buildingId, null);
    assert.ok(trees.some(({ tree }) => Math.abs(Math.round(tree.anchorTx) - spot.tile.tx) + Math.abs(Math.round(tree.anchorTy) - spot.tile.ty) === 1));
  }
  assert.equal(accumulatedLeafSpots({ ...state, tick: 3500 }, trees).length, 0);
  assert.deepEqual(accumulatedLeafSpots({ ...state, tick: 2850 }, []), []);
});

// Current deterministic schedule only: this does not assert historical observed rainfall.
test('consecutive scheduled wet seasons keep their boundary wetness', async () => {
  const { modeledWetness } = await import('../src/render/natureWetGround');
  const { weatherAt } = await import('../src/engine/eventSchedule');
  const state = { ...c25BoardState(), seed: 1 };
  assert.equal(weatherAt(state, 16999).kind, 'wet');
  assert.equal(weatherAt(state, 17000).kind, 'wet');
  assert.equal(modeledWetness({ ...state, tick: 16999 }), 1);
  assert.equal(modeledWetness({ ...state, tick: 17000 }), 1);
});

test('rain visibility reuses the authored strong group through the contract selector', () => {
  const strongRule = bundle.rules.find(rule => rule.id === 'nature-rain-strong'); assert.ok(strongRule);
  assert.equal(strongRule.variants.length, 6);
  const allowed = new Set(strongRule.variants.map(variant => variant.assetId));
  for (let seed = 0; seed < 24; seed += 1) {
    const selected = registry.select('weather-particle', 'nature-rain', { role: 'rain', group: 'strong' }, seed);
    assert.ok(selected && allowed.has(selected.id));
    assert.equal(selected.image.width, 16); assert.equal(selected.image.height, 24);
  }
});
