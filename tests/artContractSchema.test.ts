import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateArtSchema } from '../src/render/art/schemaValidation';
import type { ArtEntry, ArtBundle } from '../src/render/art/artContract';

const image = { url: 'assets/art/example.png', width: 64, height: 64 };
const provenance = { inboxFile: 'assets-inbox/wave/example.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) };
const geometry = { pivot: { x: 32, y: 60 }, scale: 0.5, allowMirror: false } as const;
const common = { image, provenance };
const entries: readonly ArtEntry[] = [
  { ...common, id: 'body', kind: 'building-body', geometry, buildingKinds: ['house'], levels: [1], variantId: 'a' },
  { ...common, id: 'overlay', kind: 'state-overlay', geometry, targetBodyIds: ['body'], layer: 'snow', transform: 'inherit-body', order: 1 },
  { ...common, id: 'prop', kind: 'ground-prop', geometry, archetypes: ['yard'], occupations: ['baker'], placement: 'front-yard' },
  { ...common, id: 'cargo', kind: 'walker-cargo', role: 'cargo', cargoKinds: ['grain'], attachment: { anchor: 'grip', pivot: { x: 4, y: 5 } }, frames: [{ sourceRect: { x: 0, y: 0, width: 32, height: 64 }, pivot: { x: 4, y: 5 }, durationMs: 100 }], scale: 0.5, allowMirror: false, facing: 'se' },
  { ...common, id: 'land', kind: 'land-stage', geometry, family: 'tree', stage: 'stump', layout: 'single' },
  { ...common, id: 'landmark', kind: 'landmark', geometry, family: 'church', growthStage: 'small', expansion: 'none' },
  { ...common, id: 'scene', kind: 'event-scene', geometry, eventIds: ['event'], group: 'crowd', placement: 'target', duration: { mode: 'while-active' } },
  { ...common, id: 'illustration', kind: 'event-illustration', eventIds: ['event'], fit: 'contain', altTextKey: 'event.alt' },
  { ...common, id: 'portrait', kind: 'portrait', pool: 'nobles', ageStage: 'adult', era: '1300', derivatives: [{ size: 96, assetId: 'portrait' }] },
  { ...common, id: 'map', kind: 'regional-map', mapId: 'east', landTypes: ['pasture'], coordinateSpace: { width: 64, height: 64 }, slots: [{ id: 'estate', x: 32, y: 32, landType: 'pasture' }] },
];
const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'example', entries, rules: [{ id: 'select', kind: 'land-stage', slot: 'ground', priority: 0, conditions: [{ op: 'range', field: 'age', min: 0 }], variants: [{ assetId: 'land', weight: 1 }], fallback: 'none' }] };
const schema: unknown = JSON.parse(readFileSync(new URL('../src/render/art/artContract.schema.json', import.meta.url), 'utf8'));

for (const entry of entries) {
  test(`accepts ${entry.kind} when its own placement contract is supplied`, () => {
    const input = { ...bundle, entries: [entry], rules: [] };
    const errors = validateArtSchema(input, schema);
    assert.deepEqual(errors, []);
  });
}
const invalid: readonly { readonly name: string; readonly value: unknown }[] = [
  { name: 'unknown key', value: { ...bundle, surprise: true } },
  { name: 'wrong version type', value: { ...bundle, schemaVersion: '1' } },
  { name: 'empty variants', value: { ...bundle, rules: bundle.rules.map(rule => ({ ...rule, variants: [] })) } },
  { name: 'negative geometry scale', value: { ...bundle, entries: [{ ...entries[0], geometry: { ...geometry, scale: -1 } }] } },
  { name: 'empty range', value: { ...bundle, rules: bundle.rules.map(rule => ({ ...rule, conditions: [{ op: 'range', field: 'age' }] })) } },
  { name: 'runtime traversal', value: { ...bundle, entries: [{ ...entries[0], image: { ...image, url: 'assets/../private.png' } }] } },
  { name: 'external image scheme', value: { ...bundle, entries: [{ ...entries[0], image: { ...image, url: 'https://example.org/a.png' } }] } },
  { name: 'invalid source hash', value: { ...bundle, entries: [{ ...entries[0], provenance: { ...provenance, sourceSha256: 'bad' } }] } },
  { name: 'UI world geometry', value: { ...bundle, entries: [{ ...entries[7], geometry }] } },
];
for (const fixture of invalid) {
  test(`rejects bundle when it contains ${fixture.name}`, () => {
    const errors = validateArtSchema(fixture.value, schema);
    assert.ok(errors.length > 0);
  });
}
test('accepts all ten kinds together with range selection', () => {
  const errors = validateArtSchema(bundle, schema);
  assert.deepEqual(errors, []);
});

for (const fixture of [
  { name: 'strip endpoints', layout: 'strip', ports: { start: { x: 0, y: 32 }, end: { x: 64, y: 32 } } },
  { name: 'connector pixels', layout: 'connector', ports: { NW: { x: 16, y: 16 }, SW: { x: 16, y: 48 } } },
]) {
  test(`accepts land layout with ${fixture.name}`, () => {
    const input = { ...bundle, entries: [{ ...entries[4], layout: fixture.layout, ports: fixture.ports }] };
    const errors = validateArtSchema(input, schema);
    assert.deepEqual(errors, []);
  });
}
for (const fixture of [
  { name: 'cargo foot anchor', entry: { ...entries[3], attachment: { anchor: 'foot', pivot: { x: 1, y: 1 } } } },
  { name: 'strip missing endpoints', entry: { ...entries[4], layout: 'strip' } },
  { name: 'connector strip endpoints', entry: { ...entries[4], layout: 'connector', ports: { start: { x: 1, y: 1 } } } },
  { name: 'nonfinite geometry', entry: { ...entries[0], geometry: { ...geometry, scale: Infinity } } },
  { name: 'negative crop', entry: { ...entries[0], geometry: { ...geometry, crop: { x: -1, y: 0, width: 10, height: 10 } } } },
  { name: 'negative footprint', entry: { ...entries[0], geometry: { ...geometry, footprint: { width: -1, height: 1 } } } },
]) {
  test(`rejects ${fixture.name}`, () => {
    const input = { ...bundle, entries: [fixture.entry] };
    const errors = validateArtSchema(input, schema);
    assert.ok(errors.length > 0);
  });
}
