import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtRegistryError, ArtRegistryStore, createArtRegistry } from '../src/render/art/artRegistry';
import type { ArtBundle, ArtCondition, ArtEntry, ArtRule } from '../src/render/art/artContract';
const image = { url: 'assets/art/a.png', width: 64, height: 64 };
const provenance = { inboxFile: 'assets-inbox/test/a.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) };
const geometry = { pivot: { x: 32, y: 60 }, scale: 0.5, allowMirror: false } as const;
const land: ArtEntry = { id: 'land', kind: 'land-stage', image, provenance, geometry, family: 'tree', stage: 'stump', layout: 'single' };
function rule(id = 'rule', conditions: readonly ArtCondition[] = []): ArtRule {
  return { id, kind: 'land-stage', slot: 'ground', priority: 0, conditions, variants: [{ assetId: 'land', weight: 1 }], fallback: 'none' };
}
function bundle(rules: readonly ArtRule[] = [rule()], entries: readonly ArtEntry[] = [land]): ArtBundle {
  return { schemaVersion: 1, bundleId: 'test', entries, rules };
}
test('selects the same immutable entry deterministically without touching caller objects', () => {
  const input = bundle();
  const registry = createArtRegistry([input]);
  assert.equal(registry.select('land-stage', 'ground', {}, 42)?.id, 'land');
  assert.equal(registry.entry('land'), registry.select('land-stage', 'ground', {}, 42));
  assert.ok(Object.isFrozen(registry.entry('land')));
  assert.ok(Object.isFrozen(registry.entry('land')?.image));
  assert.equal(Object.isFrozen(input), false);
});
test('caller mutation cannot alter the published snapshot', () => {
  const input = { ...bundle(), entries: [{ ...land, image: { ...image } }] };
  const registry = createArtRegistry([input]);
  const first = input.entries[0];
  assert.ok(first);
  first.image.width = 1;
  assert.equal(registry.entry('land')?.image.width, 64);
});
test('store preserves previous snapshot when the last bundle fails validation', () => {
  const store = new ArtRegistryStore([bundle()]);
  const previous = store.registry;
  assert.throws(() => store.replace([bundle(), { schemaVersion: 1, bundleId: 'bad', entries: [], rules: [{ bad: true }] }]), ArtRegistryError);
  assert.equal(store.registry, previous);
});
test('rejects duplicate identifiers across bundles', () => {
  assert.throws(() => createArtRegistry([bundle(), { ...bundle(), bundleId: 'other' }]), ArtRegistryError);
});
for (const condition of [
  { op: 'eq', field: 'state.tick', value: 1 },
  { op: 'eq', field: 'ageYears', value: 'old' },
  { op: 'range', field: 'season', min: 0 },
  { op: 'range', field: 'ageYears', min: 2, max: 2 },
] satisfies readonly ArtCondition[]) {
  test(`rejects invalid selector ${JSON.stringify(condition)}`, () => assert.throws(() => createArtRegistry([bundle([rule('invalid', [condition])])]), ArtRegistryError));
}
test('rejects overlapping same-priority intervals with different boundaries', () => {
  assert.throws(() => createArtRegistry([bundle([rule('a', [{ op: 'range', field: 'ageYears', min: 0, max: 3 }]), rule('b', [{ op: 'range', field: 'ageYears', min: 2, max: 4 }])])]), ArtRegistryError);
});
test('accepts adjacent half-open intervals and evaluates their boundary', () => {
  const registry = createArtRegistry([bundle([rule('a', [{ op: 'range', field: 'ageYears', min: 0, max: 2 }]), rule('b', [{ op: 'range', field: 'ageYears', min: 2, max: 4 }])])]);
  assert.equal(registry.select('land-stage', 'ground', { ageYears: 2 }, 0)?.id, 'land');
  assert.equal(registry.select('land-stage', 'ground', { ageYears: 4 }, 0), null);
});
test('rejects intersecting enum conditions and unconditional overlap', () => {
  assert.throws(() => createArtRegistry([bundle([rule('a', [{ op: 'in', field: 'season', values: ['summer', 'winter'] }]), rule('b', [{ op: 'eq', field: 'season', value: 'winter' }])])]), ArtRegistryError);
  assert.throws(() => createArtRegistry([bundle([rule('a'), rule('b')])]), ArtRegistryError);
});
test('higher priority rule wins over intentional fallback', () => {
  const second = { ...land, id: 'second' };
  const preferred = { ...rule('preferred', [{ op: 'eq', field: 'season', value: 'winter' }]), priority: 2, variants: [{ assetId: 'second', weight: 1 }] };
  const registry = createArtRegistry([bundle([rule('fallback'), preferred], [land, second])]);
  assert.equal(registry.select('land-stage', 'ground', { season: 'winter' }, 1)?.id, 'second');
  assert.equal(registry.select('land-stage', 'ground', { season: 'summer' }, 1)?.id, 'land');
});
test('missing or inherited fields do not match and zero remains a real value', () => {
  const registry = createArtRegistry([bundle([rule('a', [{ op: 'eq', field: 'ageYears', value: 0 }])])]);
  assert.equal(registry.select('land-stage', 'ground', {}, 1), null);
  assert.equal(registry.select('land-stage', 'ground', Object.create({ ageYears: 0 }), 1), null);
  assert.equal(registry.select('land-stage', 'ground', { ageYears: 0 }, 1)?.id, 'land');
});
test('nextChange shares numeric rule boundaries and respects other fields', () => {
  const registry = createArtRegistry([bundle([rule('a', [{ op: 'range', field: 'ageYears', min: 2, max: 4 }, { op: 'eq', field: 'season', value: 'winter' }])])]);
  assert.equal(registry.nextChange('land-stage', 'ground', { ageYears: 1, season: 'winter' }, 'ageYears'), 2);
  assert.equal(registry.nextChange('land-stage', 'ground', { ageYears: 2, season: 'winter' }, 'ageYears'), 4);
  assert.equal(registry.nextChange('land-stage', 'ground', { ageYears: 4, season: 'winter' }, 'ageYears'), null);
  assert.equal(registry.nextChange('land-stage', 'ground', { ageYears: 1, season: 'summer' }, 'ageYears'), null);
});
for (const entry of [
  { ...land, geometry: { ...geometry, crop: { x: 60, y: 0, width: 8, height: 8 } } },
  { ...land, geometry: { ...geometry, pivot: { x: 65, y: 0 } } },
  { ...land, layout: 'strip', ports: { start: { x: 0, y: 0 }, end: { x: 65, y: 0 } } },
]) {
  test(`rejects out-of-bounds geometry ${JSON.stringify(entry)}`, () => assert.throws(() => createArtRegistry([{ ...bundle(), entries: [entry] }]), ArtRegistryError));
}
test('rejects missing and kind-inconsistent variant references', () => {
  assert.throws(() => createArtRegistry([bundle([{ ...rule(), variants: [{ assetId: 'missing', weight: 1 }] }])]), ArtRegistryError);
  assert.throws(() => createArtRegistry([bundle([{ ...rule(), kind: 'portrait' }])]), ArtRegistryError);
});
test('rejects unsafe total weights', () => {
  assert.throws(() => createArtRegistry([bundle([{ ...rule(), variants: [{ assetId: 'land', weight: Number.MAX_SAFE_INTEGER }, { assetId: 'land', weight: 1 }] }])]), ArtRegistryError);
});
test('filters entries by kind and returns null for absent IDs or slots', () => {
  const registry = createArtRegistry([bundle()]);
  assert.deepEqual(registry.entries('portrait'), []);
  assert.equal(registry.entries().length, 1);
  assert.equal(registry.entry('missing'), null);
  assert.equal(registry.select('land-stage', 'missing', {}, 0), null);
});
test('weighted selection uses stable declaration order and handles negative seeds', () => {
  const second = { ...land, id: 'second' };
  const weighted = { ...rule(), variants: [{ assetId: 'land', weight: 1 }, { assetId: 'second', weight: 2 }] };
  const registry = createArtRegistry([bundle([weighted], [land, second])]);
  assert.deepEqual([0, 1, 2, 3, -1].map(seed => registry.select('land-stage', 'ground', {}, seed)?.id), ['land', 'second', 'second', 'land', 'second']);
  assert.throws(() => registry.select('land-stage', 'ground', {}, NaN), ArtRegistryError);
});
test('boundaries are sorted immutable data and nextChange ignores masked low-priority rules', () => {
  const low = rule('low', [{ op: 'range', field: 'ageYears', min: 1, max: 2 }]);
  const high = { ...rule('high', [{ op: 'range', field: 'ageYears', min: 0, max: 5 }]), priority: 2 };
  const registry = createArtRegistry([bundle([low, high])]);
  assert.deepEqual(registry.boundaries('land-stage', 'ground', 'ageYears'), [0, 1, 2, 5]);
  assert.ok(Object.isFrozen(registry.boundaries('land-stage', 'ground', 'ageYears')));
  assert.equal(registry.nextChange('land-stage', 'ground', { ageYears: 0 }, 'ageYears'), 5);
});
test('rejects contradictory conditions and intersecting eq/range predicates', () => {
  assert.throws(() => createArtRegistry([bundle([rule('bad', [{ op: 'eq', field: 'ageYears', value: 1 }, { op: 'range', field: 'ageYears', min: 2 }])])]), ArtRegistryError);
  assert.throws(() => createArtRegistry([bundle([rule('a', [{ op: 'eq', field: 'ageYears', value: 2 }]), rule('b', [{ op: 'range', field: 'ageYears', min: 1, max: 3 }])])]), ArtRegistryError);
});
const body: ArtEntry = { id: 'body', kind: 'building-body', image, provenance, geometry, buildingKinds: ['house'], levels: [1], variantId: 'a' };
const overlay: ArtEntry = { id: 'overlay', kind: 'state-overlay', image, provenance, geometry, targetBodyIds: ['body'], layer: 'snow', transform: 'inherit-body', order: 1 };
test('accepts cross-bundle overlay reference with identical geometry', () => {
  const registry = createArtRegistry([bundle([], [body]), { ...bundle([], [overlay]), bundleId: 'other' }]);
  assert.equal(registry.entry('overlay')?.id, 'overlay');
});
for (const invalid of [
  { ...overlay, targetBodyIds: ['missing'] },
  { ...overlay, geometry: { ...geometry, scale: 1 } },
  { ...overlay, geometry: { ...geometry, crop: { x: 0, y: 0, width: 32, height: 32 } } },
]) {
  test(`rejects invalid overlay relationship ${JSON.stringify(invalid)}`, () => assert.throws(() => createArtRegistry([bundle([], [body, invalid])]), ArtRegistryError));
}
test('validates portrait derivatives against actual target kind and dimensions', () => {
  const portrait: ArtEntry = { id: 'portrait', kind: 'portrait', image: { ...image, width: 96, height: 96 }, provenance, pool: 'nobles', ageStage: 'adult', era: '1300', derivatives: [{ size: 96, assetId: 'portrait' }] };
  assert.equal(createArtRegistry([bundle([], [portrait])]).entry('portrait')?.id, 'portrait');
  assert.throws(() => createArtRegistry([bundle([], [{ ...portrait, derivatives: [{ size: 256, assetId: 'portrait' }] }])]), ArtRegistryError);
});
test('rejects map slots beyond coordinate bounds or unknown land types', () => {
  const map: ArtEntry = { id: 'map', kind: 'regional-map', image, provenance, mapId: 'east', landTypes: ['pasture'], coordinateSpace: { width: 100, height: 100 }, slots: [{ id: 'slot', x: 101, y: 0, landType: 'pasture' }] };
  assert.throws(() => createArtRegistry([bundle([], [map])]), ArtRegistryError);
  assert.throws(() => createArtRegistry([bundle([], [{ ...map, slots: [{ id: 'slot', x: 1, y: 0, landType: 'unknown' }] }])]), ArtRegistryError);
});
test('rejects frame source and local pivot bounds', () => {
  const cargo: ArtEntry = { id: 'cargo', kind: 'walker-cargo', image, provenance, scale: 1, allowMirror: false, facing: 's', role: 'cargo', cargoKinds: ['grain'], attachment: { anchor: 'grip', pivot: { x: 1, y: 1 } }, frames: [{ sourceRect: { x: 40, y: 0, width: 30, height: 30 }, pivot: { x: 1, y: 1 }, durationMs: 100 }] };
  assert.throws(() => createArtRegistry([bundle([], [cargo])]), ArtRegistryError);
  assert.throws(() => createArtRegistry([bundle([], [{ ...cargo, frames: [{ sourceRect: { x: 0, y: 0, width: 30, height: 30 }, pivot: { x: 31, y: 1 }, durationMs: 100 }] }])]), ArtRegistryError);
});

test('rejects finite scales whose canvas or pivot products overflow before publishing', () => {
  const store = new ArtRegistryStore([bundle()]);
  const previous = store.registry;
  const huge = { ...land, geometry: { ...geometry, scale: 1e308 } };
  assert.throws(() => store.replace([bundle([], [huge])]), ArtRegistryError);
  assert.equal(store.registry, previous);
});

test('rejects frame-local extent products that overflow for walker scale', () => {
  const cargo: ArtEntry = { id: 'cargo', kind: 'walker-cargo', image, provenance, scale: 1e308, allowMirror: false, facing: 's', role: 'cargo', cargoKinds: ['grain'], attachment: { anchor: 'grip', pivot: { x: 1, y: 1 } }, frames: [{ sourceRect: { x: 0, y: 0, width: 30, height: 30 }, pivot: { x: 20, y: 20 }, durationMs: 100 }] };
  assert.throws(() => createArtRegistry([bundle([], [cargo])]), ArtRegistryError);
});

test('rejects finite animation durations whose combined loop period overflows', () => {
  const frame = { sourceRect: { x: 0, y: 0, width: 30, height: 30 }, pivot: { x: 1, y: 1 }, durationMs: 1e308 };
  const cargo: ArtEntry = { id: 'cargo', kind: 'walker-cargo', image, provenance, scale: 1, allowMirror: false, facing: 's', role: 'cargo', cargoKinds: ['grain'], attachment: { anchor: 'grip', pivot: { x: 1, y: 1 } }, frames: [frame, frame] };
  assert.throws(() => createArtRegistry([bundle([], [cargo])]), ArtRegistryError);
  const scene: ArtEntry = { id: 'scene', kind: 'event-scene', image, provenance, geometry, eventIds: ['event'], group: 'crowd', placement: 'target', duration: { mode: 'while-active' }, frames: [frame, frame] };
  assert.throws(() => createArtRegistry([bundle([], [scene])]), ArtRegistryError);
});

test('keeps large but finite derived geometry valid without an arbitrary scale ceiling', () => {
  const large = { ...land, geometry: { ...geometry, scale: 1e100, crop: { x: 0, y: 0, width: 32, height: 32 } } };
  assert.equal(createArtRegistry([bundle([], [large])]).entry('land')?.id, 'land');
});
