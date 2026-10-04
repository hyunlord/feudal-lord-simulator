import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import baseline from './fixtures/field-texture-migration.json';
import { createArtRegistry, ArtRegistryStore } from '../src/render/art/artRegistry';
import { createArtAdapters } from '../src/render/art/artAdapters';

const first = baseline.entries[0]; assert.ok(first);
test('four historical field sources have exact received and runtime SHA provenance', () => {
  const registry = createArtRegistry([baseline]); assert.equal(registry.entries('ground-texture').length, 4);
  for (const entry of registry.entries()) {
    const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(sha(entry.provenance.inboxFile), entry.provenance.sourceSha256);
    assert.equal(sha(`public/${entry.image.url}`), entry.provenance.runtimeSha256);
    assert.equal(entry.provenance.sourceSha256, entry.provenance.runtimeSha256);
  }
  const adapter = createArtAdapters(registry, { createImage: () => { throw new Error('descriptor must not load'); }, baseUrl: '/' });
  assert.equal(adapter.placement(first.id, { at: { x: 0, y: 0 } })?.type, 'texture-source');
});
test('limited texture contract rejects invented geometry and alternative mappings', () => {
  for (const entry of [
    { ...first, image: { ...first.image, width: 511 } }, { ...first, image: { ...first.image, height: 128 } },
    { ...first, mapping: { ...first.mapping, repeat: 'xy' } }, { ...first, mapping: { ...first.mapping, sourcePixelsPerTile: 64 } },
    { ...first, mapping: { ...first.mapping, origin: { x: 1, y: 0 } } },
    { ...first, composition: { ...first.composition, joinFadeSourcePx: 20 } }, { ...first, allowMirror: true },
    { ...first, geometry: { pivot: { x: 0, y: 0 }, scale: 1 } }, { ...first, growthStage: 'fake' },
  ]) assert.throws(() => createArtRegistry([{ ...baseline, entries: [entry, ...baseline.entries.slice(1)] }]));
});
test('startup refuses every partial baseline pair, malformed role, and nonunit variant', () => {
  for (const rule of baseline.rules) {
    assert.throws(() => createArtRegistry([{ ...baseline, rules: baseline.rules.filter(candidate => candidate.id !== rule.id) }]));
    for (const replacement of [
      { ...rule, slot: 'unknown' }, { ...rule, priority: 1 }, { ...rule, variants: [{ assetId: first.id, weight: 2 }] },
      { ...rule, variants: [...rule.variants, { assetId: first.id, weight: 1 }] },
      { ...rule, conditions: [{ op: 'eq', field: 'fieldState', value: 'harvested' }] },
      { ...rule, conditions: [{ op: 'in', field: 'fieldState', values: ['ploughed', 'seedling'] }] },
    ]) assert.throws(() => createArtRegistry([{ ...baseline, rules: baseline.rules.map(candidate => candidate.id === rule.id ? replacement : candidate) }]));
  }
  assert.equal(createArtRegistry([]).entries().length, 0);
});
test('finite seasonal pairing rejects a missing counterpart in each of eight contexts before replacing registry', () => {
  const store = new ArtRegistryStore([baseline]); const prior = store.registry;
  for (const fieldState of ['ploughed', 'seedling']) for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const entry = { ...first, id: 'seasonal', composition: { ...first.composition, wash: 'none' } };
    const rule = { id: 'seasonal-rule', kind: 'ground-texture', slot: 'field-ridge-season-a', priority: 0,
      conditions: [{ op: 'eq', field: 'fieldState', value: fieldState }, { op: 'eq', field: 'season', value: season }], variants: [{ assetId: entry.id, weight: 1 }], fallback: 'none' };
    assert.throws(() => store.replace([{ ...baseline, entries: [...baseline.entries, entry], rules: [...baseline.rules, rule] }]));
    assert.equal(store.registry, prior);
    assert.doesNotThrow(() => createArtRegistry([{ ...baseline, entries: [...baseline.entries, entry], rules: [...baseline.rules, rule, { ...rule, id: 'seasonal-b', slot: 'field-ridge-season-b' }] }]));
    assert.throws(() => createArtRegistry([{ ...baseline, entries: [...baseline.entries, { ...entry, composition: { ...entry.composition, wash: 'legacy-stage' } }], rules: [...baseline.rules, rule, { ...rule, id: 'seasonal-b', slot: 'field-ridge-season-b' }] }]));
  }
});
