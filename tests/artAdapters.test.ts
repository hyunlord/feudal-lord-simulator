import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtEntry } from '../src/render/art/artContract';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createArtAdapters, artFrameAt, ArtAdapterError } from '../src/render/art/artAdapters';

const image = { url: 'assets/art/example.png', width: 64, height: 64 };
const provenance = { inboxFile: 'assets-inbox/test/example.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) };
const geometry = { pivot: { x: 32, y: 60 }, scale: 0.5, allowMirror: false } as const;
const frames = [
  { sourceRect: { x: 0, y: 0, width: 32, height: 64 }, pivot: { x: 4, y: 5 }, durationMs: 100 },
  { sourceRect: { x: 32, y: 0, width: 32, height: 64 }, pivot: { x: 6, y: 7 }, durationMs: 200 },
];
const common = { image, provenance };
const entries: readonly ArtEntry[] = [
  { ...common, id: 'body', kind: 'building-body', geometry, buildingKinds: ['house'], levels: [1], variantId: 'a' },
  { ...common, id: 'overlay', kind: 'state-overlay', geometry, targetBodyIds: ['body'], layer: 'snow', transform: 'inherit-body', order: 1 },
  { ...common, id: 'prop', kind: 'ground-prop', geometry: { ...geometry, crop: { x: 8, y: 16, width: 40, height: 40 } }, archetypes: ['yard'], occupations: ['baker'], placement: 'front-yard' },
  { ...common, id: 'cargo', kind: 'walker-cargo', role: 'cargo', cargoKinds: ['grain'], attachment: { anchor: 'grip', pivot: { x: 4, y: 5 } }, frames, scale: 0.5, allowMirror: false, facing: 'se' },
  { ...common, id: 'walker', kind: 'walker-cargo', role: 'walker', cargoKinds: [], attachment: { anchor: 'foot', pivot: { x: 4, y: 5 } }, frames, scale: 0.5, allowMirror: false, facing: 'se' },
  { ...common, id: 'land', kind: 'land-stage', geometry, family: 'tree', stage: 'stump', layout: 'single' },
  { ...common, id: 'strip', kind: 'land-stage', geometry, family: 'path', stage: 'strip', layout: 'strip', ports: { start: { x: 0, y: 32 }, end: { x: 64, y: 32 } } },
  { ...common, id: 'connector', kind: 'land-stage', geometry, family: 'path', stage: 'join', layout: 'connector', ports: { NW: { x: 0, y: 0 } } },
  { ...common, id: 'landmark', kind: 'landmark', geometry, family: 'church', growthStage: 'small', expansion: 'none' },
  { ...common, id: 'scene', kind: 'event-scene', geometry, eventIds: ['event'], group: 'crowd', placement: 'target', duration: { mode: 'while-active' }, frames },
  { ...common, id: 'illustration', kind: 'event-illustration', eventIds: ['event'], fit: 'contain', altTextKey: 'event.alt' },
  { ...common, id: 'portrait', image: { ...image, width: 96, height: 96 }, kind: 'portrait', pool: 'nobles', ageStage: 'adult', era: '1300', derivatives: [{ size: 96, assetId: 'portrait' }] },
  { ...common, id: 'map', kind: 'regional-map', mapId: 'east', landTypes: ['pasture'], coordinateSpace: { width: 64, height: 64 }, slots: [{ id: 'estate', x: 32, y: 32, landType: 'pasture' }] },
];
const registry = createArtRegistry([{ schemaVersion: 1, bundleId: 'adapters', entries, rules: [] }]);
const adapters = createArtAdapters(registry, { createImage: null, baseUrl: '/game/' });
const at = { x: 100, y: 200 };
const body = { bodyId: 'body', sourceRect: { x: 8, y: 9, width: 20, height: 30 }, targetRect: { x: 20, y: 30, width: 40, height: 60 } };

for (const entry of entries) test(`dispatches ${entry.id} through its declared kind`, () => {
  // Given a fully validated registry entry and supplied placement facts.
  const expected = ['illustration', 'portrait', 'map'].includes(entry.id) ? 'ui-handoff' : ['strip', 'connector'].includes(entry.id) ? 'land-primitive' : 'blit';
  // When / Then every kind has an explicit adapter branch.
  assert.equal(adapters.placement(entry.id, { at, body, grip: at, elapsedMs: 0 })?.type, expected);
});
test('crop preserves full-canvas pivot using uniform positive scale', () => {
  // Given a cropped prop with a full-canvas pivot.
  // When / Then crop origin is removed from the pivot, not stretched independently.
  assert.deepEqual(adapters.placement('prop', { at }), { type: 'blit', sourceRect: { x: 8, y: 16, width: 40, height: 40 }, targetRect: { x: 88, y: 178, width: 20, height: 20 } });
});
test('overlay inherits exact body source and target geometry', () => {
  // Given a body registration with crop and target rect.
  const placed = adapters.placement('overlay', { at, body });
  // When / Then its exact rectangles are reused rather than recomputed or rescaled.
  assert.ok(placed?.type === 'blit');
  assert.equal(placed.sourceRect, body.sourceRect);
  assert.equal(placed.targetRect, body.targetRect);
});
test('overlay rejects another body instead of silently drawing', () => {
  // Given / When / Then a wrong binding cannot inherit an unrelated body.
  assert.throws(() => adapters.placement('overlay', { at, body: { ...body, bodyId: 'other' } }), ArtAdapterError);
});
for (const [elapsed, index] of [[0, 0], [99, 0], [100, 1], [299, 1], [300, 0]] as const) test(`uses authored frame at ${elapsed}ms`, () => {
  // Given / When / Then declared half-open frame boundaries are exact.
  assert.equal(artFrameAt(frames, elapsed), frames[index]);
});
test('cargo anchors current frame at supplied grip without extra attachment offset', () => {
  // Given the second frame has a different local pivot.
  // When / Then only that pivot translates the provided grip.
  assert.deepEqual(adapters.placement('cargo', { at, grip: { x: 20, y: 30 }, elapsedMs: 100 }), { type: 'blit', sourceRect: frames[1]?.sourceRect, targetRect: { x: 17, y: 26.5, width: 16, height: 32 } });
});
test('cargo rejects missing grip instead of using walker feet', () => {
  // Given / When / Then missing transport geometry stays unbound.
  assert.throws(() => adapters.placement('cargo', { at, elapsedMs: 0 }), ArtAdapterError);
});
test('walker anchors its frame at supplied foot position', () => {
  // Given / When / Then foot position and frame pivot determine one uniform blit.
  assert.deepEqual(adapters.placement('walker', { at, elapsedMs: 100 }), { type: 'blit', sourceRect: frames[1]?.sourceRect, targetRect: { x: 97, y: 196.5, width: 16, height: 32 } });
});
test('UI descriptor resolves base URL while preserving fit and alt text', () => {
  // Given / When a descriptor is requested without loading an image.
  const entry = adapters.descriptor('illustration');
  // Then UI-owned rendering receives its complete data contract.
  assert.ok(entry?.kind === 'event-illustration');
  assert.deepEqual([entry.image.url, entry.fit, entry.altTextKey], ['/game/assets/art/example.png', 'contain', 'event.alt']);
});

test('ready world draw uses the existing unsnapped smoothed crop primitive without mirroring', async () => {
  // Given a decoded browser-boundary image and a recording canvas boundary.
  const imageElement: HTMLImageElement = Object.create(null);
  Object.assign(imageElement, { naturalWidth: 64, naturalHeight: 64, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
  const runtime = createArtAdapters(registry, { baseUrl: '/', createImage: () => imageElement });
  const calls: unknown[][] = [];
  let saves = 0, restores = 0;
  const context = { imageSmoothingEnabled: false, save: () => { saves++; }, restore: () => { restores++; },
    drawImage: (...args: unknown[]) => { calls.push(args); }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  assert.equal(runtime.draw(context, 'body', { at }), false);
  imageElement.onload?.call(imageElement, new Event('load')); await Promise.resolve();
  // When the ready body is drawn through the real world primitive.
  assert.equal(runtime.draw(context, 'body', { at }), true);
  // Then source and uniformly scaled destination match the authored pivot with no transform flip.
  assert.deepEqual(calls, [[imageElement, 0, 0, 64, 64, 84, 170, 32, 32]]);
  assert.equal(saves, 1); assert.equal(restores, 1); assert.equal(context.imageSmoothingEnabled, true);
});

// Weather scheduling/alpha are owned by the cloud consumer, never by a generic blit.
test('weather-shadow exposes only a source descriptor to generic adapters', async () => {
  const { default: shadows } = await import('./fixtures/weather-shadow-migration.json');
  const art = createArtAdapters(createArtRegistry([shadows]), { createImage: null, baseUrl: '/' });
  const id = shadows.entries[0]?.id; assert.ok(id);
  assert.equal(art.placement(id, { at: { x: 0, y: 0 } })?.type, 'weather-shadow-source');
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), { drawImage() { throw new Error('Unexpected generic weather paint'); } });
  assert.equal(art.draw(context, id, { at: { x: 0, y: 0 } }), false);
});
