import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtRegistryStore, createArtRegistry } from '../src/render/art/artRegistry';
import { createArtAdapters } from '../src/render/art/artAdapters';

const image = { url: 'assets/art/attachment.png', width: 137, height: 137 };
const provenance = { inboxFile: 'assets-inbox/test.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) };
const geometry = { pivot: { x: 27, y: 27 }, scale: 0.2, allowMirror: false } as const;
const body = { id: 'body', kind: 'building-body', image, provenance, geometry: { ...geometry, crop: { x: 10, y: 20, width: 100, height: 100 } }, buildingKinds: ['house'], levels: [1], variantId: 'a' } as const;
const attachment = { id: 'early', kind: 'building-attachment', image, provenance, geometry, role: 'trade-sign', occupations: ['baker'], minZoom: 0.8, mounts: [{ bodyId: 'body', point: { x: 50, y: 80 } }] } as const;
const late = { ...attachment, id: 'late' };
const rules = [
  { id: 'early-rule', kind: 'building-attachment', slot: 'trade-sign', priority: 0, conditions: [{ op: 'range', field: 'calendarYear', min: 1300, max: 1400 }], variants: [{ assetId: 'early', weight: 1 }], fallback: 'none' },
  { id: 'late-rule', kind: 'building-attachment', slot: 'trade-sign', priority: 0, conditions: [{ op: 'range', field: 'calendarYear', min: 1400, max: 1451 }], variants: [{ assetId: 'late', weight: 1 }], fallback: 'none' },
] as const;
const bundle = { schemaVersion: 1, packId: 'core', bundleId: 'attachments', entries: [body, attachment, late], rules };

test('selects the authored attachment on half-open calendar boundaries', () => {
  // Given the same body with two authored era paintings.
  const registry = createArtRegistry([bundle]);
  // When / Then 1400 belongs only to the later range.
  for (const [year, id] of [[1399, 'early'], [1400, 'late'], [1420, 'late']] as const) {
    assert.equal(registry.select('building-attachment', 'trade-sign', { calendarYear: year }, 0)?.id, id);
  }
});

for (const [name, mounts] of [
  ['missing body', [{ bodyId: 'missing', point: { x: 50, y: 80 } }]],
  ['wrong body kind', [{ bodyId: 'early', point: { x: 50, y: 80 } }]],
  ['outside crop', [{ bodyId: 'body', point: { x: 9, y: 80 } }]],
  ['outside image', [{ bodyId: 'body', point: { x: 200, y: 80 } }]],
  ['duplicate body', [{ bodyId: 'body', point: { x: 50, y: 80 } }, { bodyId: 'body', point: { x: 60, y: 80 } }]],
] as const) test(`rejects ${name} without replacing the previous registry`, () => {
  // Given a published immutable registry.
  const store = new ArtRegistryStore([bundle]); const previous = store.registry;
  // When an invalid attachment replaces the snapshot.
  assert.throws(() => store.replace([{ ...bundle, entries: [body, { ...attachment, mounts }, late] }]));
  // Then the prior entry remains unchanged.
  assert.equal(store.registry, previous);
  assert.deepEqual(store.registry.entry('early'), attachment);
});

test('accepts an explicitly registered landmark mount', () => {
  // Given a landmark using the same authored crop.
  const landmark = { id: 'body', kind: 'landmark', image, provenance, geometry: body.geometry, family: 'hall', growthStage: 'small', expansion: 'none' };
  // When / Then target kinds include landmarks without inferring an anchor.
  assert.doesNotThrow(() => createArtRegistry([{ ...bundle, entries: [landmark, attachment, late] }]));
});

test('supports legacy omitted pack ownership while rejecting empty explicit pack IDs', () => {
  // Given existing bundles predate pack ownership.
  const { packId: _packId, ...legacy } = bundle;
  // When / Then omission is accepted but malformed explicit ownership is not.
  assert.doesNotThrow(() => createArtRegistry([legacy]));
  assert.throws(() => createArtRegistry([{ ...bundle, packId: '' }]));
});

test('keeps the authored fixing point under positive uniform scaling without a source image', () => {
  // Given no browser Image API is available.
  const adapters = createArtAdapters(createArtRegistry([bundle]), { createImage: null, baseUrl: '/' });
  // When placing the supplied wall contact.
  const placed = adapters.placement('early', { at: { x: 100, y: 200 } });
  // Then the bracket pivot stays fixed and image readiness does not fabricate pixels.
  assert.deepEqual(placed, { type: 'blit', sourceRect: { x: 0, y: 0, width: 137, height: 137 }, targetRect: { x: 94.6, y: 194.6, width: 27.400000000000002, height: 27.400000000000002 } });
  assert.equal(adapters.image('early'), null);
  assert.deepEqual(adapters.status('early'), { status: 'unavailable', reason: 'Image API unavailable' });
  assert.equal(adapters.placement('missing', { at: { x: 0, y: 0 } }), null);
});

test('rejects mirrored attachment geometry', () => {
  // Given the original orientation is part of the art contract.
  const mirrored = { ...attachment, geometry: { ...geometry, allowMirror: true } };
  // When / Then no unapproved mirror reaches the adapter.
  assert.throws(() => createArtRegistry([{ ...bundle, entries: [body, mirrored, late] }]));
});

test('draws only a decoded source with a positive unmirrored transform', async () => {
  // Given the image boundary reports real dimensions but has not decoded yet.
  const source: HTMLImageElement = Object.create(null);
  Object.assign(source, { naturalWidth: 137, naturalHeight: 137, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
  const adapters = createArtAdapters(createArtRegistry([bundle]), { createImage: () => source, baseUrl: '/' });
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, save() {}, restore() {}, drawImage: (...args: unknown[]) => calls.push(args), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  assert.equal(adapters.draw(context, 'early', { at: { x: 100, y: 200 } }), false);
  assert.deepEqual(calls, []);
  source.onload?.call(source, new Event('load')); await Promise.resolve();
  // When the source has decoded, the common world adapter can draw it.
  assert.equal(adapters.draw(context, 'early', { at: { x: 100, y: 200 } }), true);
  // Then no mirror operation or independent axis stretch was introduced.
  assert.deepEqual(calls, [[source, 0, 0, 137, 137, 94.6, 194.6, 27.400000000000002, 27.400000000000002]]);
});
