import { createGroundChunkCache } from '../src/render/groundChunkCache';
import { createCanvasBudget } from '../src/render/canvasBudget';
import { createLandDecalArt } from '../src/render/art/landDecalArt';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArtRegistry } from '../src/render/art/artRegistry';
const a = { id: 'a', kind: 'ground-prop', placement: 'land', baseId: 'decals/heath_patch_a', archetypes: ['core:chalk_downs'], image: { url: 'assets/a.png', width: 64, height: 48 }, provenance: { inboxFile: 'assets-inbox/a.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'a'.repeat(64) }, geometry: { pivot: { x: 32, y: 40 }, scale: 0.5, allowMirror: false } };
const base = { id: 'base', kind: 'ground-prop', slot: 'land-decal-base', priority: 0, conditions: [{ field: 'baseId', op: 'eq', value: a.baseId }, { field: 'archetype', op: 'eq', value: 'core:chalk_downs' }, { field: 'placement', op: 'eq', value: 'land' }], variants: [{ assetId: 'a', weight: 1 }], fallback: 'none' };
const bundle = () => ({ schemaVersion: 1, bundleId: 'test', entries: [structuredClone(a)], rules: [structuredClone(base)] });
test('Given land placement When all real contexts have a base Then the strict registry accepts it', () => assert.equal(createArtRegistry([bundle()]).entry('a')?.kind, 'ground-prop'));
test('Given land placement When household-only fields appear Then they fail schema', () => {
  for (const extra of [{ occupations: ['farmer'] }, { wealthRange: { min: 0 } }, { facing: 'n' }]) assert.throws(() => createArtRegistry([{ ...bundle(), entries: [{ ...a, ...extra }] }]));
  assert.throws(() => createArtRegistry([{ ...bundle(), entries: [{ ...a, placement: 'yard', baseId: undefined }] }]));
});
test('Given land rules When dormant or invalid references appear Then every reference fails before selection', () => {
  for (const changed of [
    { ...base, conditions: [...base.conditions, { field: 'occupation', op: 'eq', value: 'farmer' }] },
    { ...base, conditions: [...base.conditions, { field: 'season', op: 'eq', value: 'unknown' }] },
    { ...base, conditions: [...base.conditions, { field: 'season', op: 'in', values: ['spring', 'bogus'] }] },
    { ...base, conditions: [...base.conditions, { field: 'season', op: 'eq', value: 'spring' }] },
    { ...base, priority: 1 }, { ...base, variants: [{ assetId: 'a', weight: 2 }] },
  ]) assert.throws(() => createArtRegistry([{ ...bundle(), rules: [changed] }]));
  assert.throws(() => createArtRegistry([{ ...bundle(), rules: [] }]));
  assert.throws(() => createArtRegistry([{ ...bundle(), entries: [{ ...a, archetypes: ['core:fen_drainage'] }] }]));
  assert.throws(() => createArtRegistry([{ ...bundle(), entries: [a, { ...a, id: 'wrong', baseId: 'props/gorse_a' }], rules: [base, { ...base, id: 'variant', slot: 'land-decal-variant', variants: [{ assetId: 'a', weight: 100 }, { assetId: 'wrong', weight: 1 }] }] }]));
});

function imageBoundary(width: number, height: number) {
  const image: HTMLImageElement = Object.create(null);
  let finish: () => void = () => { throw new Error('uninitialized'); };
  const decode = new Promise<void>(resolve => { finish = resolve; });
  Object.assign(image, { naturalWidth: width, naturalHeight: height, onload: null, onerror: null, src: '', decode: () => decode });
  return { image, ready: async () => { image.onload?.call(image, new Event('load')); finish(); await Promise.resolve(); }, fail: () => image.onerror?.call(image, new Event('error')) };
}
test('Given a selected pending variant When readiness advances Then fallback warms once and selection/geometry remain stable', async () => {
  const b = { ...a, id: 'b', image: { ...a.image, url: 'assets/b.png', width: 96, height: 64 }, geometry: { ...a.geometry, pivot: { x: 48, y: 56 } } };
  const registry = createArtRegistry([{ ...bundle(), entries: [a, b], rules: [base, { ...base, id: 'variants', slot: 'land-decal-variant', variants: [{ assetId: 'a', weight: 1 }, { assetId: 'b', weight: 1 }] }] }]);
  const first = imageBoundary(64, 48), second = imageBoundary(96, 64); let allocations = 0;
  const facade = createLandDecalArt(registry, { baseUrl: '/', createImage: () => { allocations++; return allocations === 1 ? first.image : second.image; } });
  const ids = facade.ids('core:chalk_downs', a.baseId, 1); assert.deepEqual(ids, ['a', 'b']);
  const token = () => ids.map(id => facade.image(id) === null ? 0 : 1).join('');
  const context: CanvasRenderingContext2D = Object.create(null); const calls: unknown[][] = [];
  Object.assign(context, { save() {}, restore() {}, drawImage(...args: unknown[]) { calls.push(args); } });
  const paint = () => facade.draw(context, 'core:chalk_downs', a.baseId, 1, 1, 100, 100);
  assert.equal(token(), '00'); assert.equal(paint(), false);
  await first.ready(); assert.equal(token(), '10'); assert.equal(paint(), true); assert.equal(calls.at(-1)?.[0], first.image); assert.deepEqual(calls.at(-1)?.slice(1), [0, 0, 64, 48, 84, 80, 32, 24]);
  const deferredKey = token();
  const cache = createGroundChunkCache((width, height) => {
    const canvas: HTMLCanvasElement = Object.create(null); Object.assign(canvas, { width, height });
    Object.assign(context, { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {} });
    return { canvas, context };
  }, () => 0, createCanvasBudget(1024 * 1024));
  const request = (key: string) => ({ id: 'ground:0,0', contentKey: key, scale: 1, diamond: [{ x: 0, y: 0 }, { x: 16, y: 8 }, { x: 0, y: 16 }, { x: -16, y: 8 }] as const });
  await second.ready(); assert.equal(cache.prefetch(request(deferredKey), () => { assert.equal(paint(), true); }), true); assert.equal(calls.at(-1)?.[0], second.image);
  assert.deepEqual(calls.at(-1)?.slice(1), [0, 0, 96, 64, 76, 72, 48, 32]);
  assert.notEqual(token(), deferredKey); const nextKey = token();
  assert.equal(cache.entry('ground:0,0')?.contentKey, deferredKey);
  assert.equal(cache.prefetch(request(nextKey), () => { paint(); }), true);
  assert.equal(cache.prefetch(request(nextKey), () => { assert.fail('Stable readiness must not bake again'); }), false);
  assert.equal(cache.stats().prefetched, 2); assert.equal(token(), nextKey); cache.clear();
  for (const season of [0, 1, 2, 3] as const) { assert.deepEqual(facade.selection('core:chalk_downs', a.baseId, season, 1), { baseId: 'a', selectedId: 'b' }); for (const id of facade.ids('core:chalk_downs', a.baseId, season)) facade.image(id); }
  assert.equal(allocations, 2); assert.deepEqual(facade.ids('core:fen_drainage', a.baseId, 1), []);
});
test('Given missing variant or wrong decoded size When frames repeat Then base fallback never reallocates', async () => {
  for (const fail of ['network', 'dimensions'] as const) {
    const b = { ...a, id: 'b' }; const registry = createArtRegistry([{ ...bundle(), entries: [a, b], rules: [base, { ...base, id: 'variant', slot: 'land-decal-variant', variants: [{ assetId: 'b', weight: 1 }] }] }]);
    const first = imageBoundary(64, 48), second = imageBoundary(1, 1); let allocations = 0;
    const facade = createLandDecalArt(registry, { baseUrl: '/', createImage: () => ++allocations === 1 ? first.image : second.image });
    facade.image('a'); facade.image('b'); await first.ready(); if (fail === 'network') second.fail(); else await second.ready();
    const canvas: CanvasRenderingContext2D = Object.create(null); const drawn: unknown[] = []; Object.assign(canvas, { save() {}, restore() {}, drawImage(image: unknown) { drawn.push(image); } });
    for (let frame = 0; frame < 4; frame++) assert.equal(facade.draw(canvas, 'core:chalk_downs', a.baseId, 1, 0, 0, 0), true);
    assert.equal(allocations, 2); assert.ok(drawn.every(image => image === first.image)); assert.equal(facade.image('b'), null);
  }
});
