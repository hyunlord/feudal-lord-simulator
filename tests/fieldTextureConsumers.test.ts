import assert from 'node:assert/strict';
import test from 'node:test';
import baseline from './fixtures/field-texture-migration.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createArtImageLoader } from '../src/render/art/artImageLoader';
import { createFieldTextureArt } from '../src/render/art/fieldTextureArt';
import { fieldTextures, setFieldTexturesForTest } from '../src/render/art/fieldTextures';
import { setZoneAssetsForTest, zoneAsset, zoneAssetReadiness } from '../src/render/zoneAssets';
import { drawTerrainBoundaryV2, setGroundChunkCacheFactoryForTest } from '../src/render/drawTerrainBoundaryV2';
import { createGroundChunkCache, type ChunkRasterRequest, type ChunkCanvasFactory } from '../src/render/groundChunkCache';
import { groundBoundaryScene } from '../src/render/groundBoundaryScene';
import { arableStripStateLookup, drawArableFields, prepareArableFieldTextures } from '../src/render/drawArableFields';
import { reconcileArableFields } from '../src/zones/arableFields';
import { c25ZonedState } from '../scripts/c25Board';
import { recordingCanvas } from '../scripts/recordingCanvas';
import type { GameState } from '../src/engine/engine.types';

function harness() {
  const source = baseline.entries[0]; assert.ok(source);
  const registry = createArtRegistry([{ ...baseline, entries: [...baseline.entries, { ...source, id: 'spring', composition: { ...source.composition, wash: 'none' } }], rules: [...baseline.rules,
    ...['a', 'b'].map(side => ({ id: `spring-${side}`, kind: 'ground-texture', slot: `field-ridge-season-${side}`, priority: 0,
      conditions: [{ op: 'eq', field: 'fieldState', value: 'ploughed' }, { op: 'eq', field: 'season', value: 'spring' }], variants: [{ assetId: 'spring', weight: 1 }], fallback: 'none' }))] }]);
  const images = new Map(registry.entries().map(entry => [entry.id, Object.assign(Object.create(null), { label: entry.id, naturalWidth: 512, naturalHeight: 64 }) as HTMLImageElement]));
  const idle = createArtImageLoader(registry, { createImage: null, baseUrl: '/' });
  const loader = { ...idle, image: (id: string) => images.get(id) ?? null, status: () => ({ status: 'ready', reason: null } as const) };
  let fail = false; let attempts = 0;
  const art = createFieldTextureArt(registry, undefined, (_pair, entry, report) => {
    attempts++; if (fail) { report('scratch unavailable'); return null; }
    return Object.assign(Object.create(null), { width: 1024, height: 64, label: `${entry.id}-joined` });
  }, loader);
  return { art, attempts: () => attempts, fail(value: boolean) { fail = value; } };
}
function stateAt(tick: number): GameState {
  const state = c25ZonedState();
  return { ...state, tick, arableFields: reconcileArableFields(state).map(field => ({ ...field, strips: field.strips.map(strip => ({ ...strip, stage: 'ploughed', stageTick: 0 })) })) };
}
const factory: ChunkCanvasFactory = (w, h) => recordingCanvas(w, h) as unknown as ReturnType<ChunkCanvasFactory>;
const parts = { drawGroundDiamond: () => {}, drawGrounding: () => {} };
const range = { minTx: 24, maxTx: 47, minTy: 24, maxTy: 47 };

test('legacy test image hook and field factory read the same stand-ins, then restore production', () => {
  const production = fieldTextures();
  const a = Object.assign(Object.create(null), { label: 'a' }); const b = Object.assign(Object.create(null), { label: 'b' });
  try {
    setZoneAssetsForTest({ ridge_ploughed_a: a, ridge_ploughed_b: b });
    assert.equal(zoneAsset('ridge_ploughed_a'), fieldTextures().image('ridge_ploughed_a'));
    assert.equal(zoneAssetReadiness(['ridge_ploughed_a', 'ridge_ploughed_b']), '11');
    assert.equal(fieldTextures().prepare([{ fieldState: 'ploughed', season: 'summer' }]).get({ fieldState: 'ploughed', season: 'summer' })?.image, a);
  } finally { setFieldTexturesForTest(null); }
  assert.equal(fieldTextures(), production);
});

test('actual terrain consumer prepares before cache hits and retries failed composition without changing roads or nonbands', () => {
  const h = harness(); h.fail(true); setFieldTexturesForTest(h.art);
  const cache = createGroundChunkCache(factory, () => 0); setGroundChunkCacheFactoryForTest(() => cache);
  const context = recordingCanvas(1280, 800).context; const state = stateAt(0); const scene = groundBoundaryScene(state);
  const requests: ChunkRasterRequest[] = []; const original = cache.draw;
  cache.draw = (target, request, paint, transform) => { requests.push(request); original(target, request, paint, transform); };
  const draw = () => drawTerrainBoundaryV2(context, { state, tiles: [], range, zoom: 1 }, parts);
  try {
    draw(); const before = new Map(requests.map(row => [row.id, row.contentKey])); const attempted = h.attempts(); requests.length = 0;
    draw(); assert.ok(h.attempts() > attempted); assert.ok(cache.stats().hits > 0); requests.length = 0;
    h.fail(false); draw();
    let changedBands = 0; let unchangedOthers = 0;
    for (const row of requests) {
      const plan = scene.chunks.find(plan => row.id === `ground:${plan.cx},${plan.cy}`);
      if (plan !== undefined && plan.arableBands.length > 0) { assert.notEqual(row.contentKey, before.get(row.id)); changedBands++; }
      else { assert.equal(row.contentKey, before.get(row.id)); unchangedOthers++; assert.equal(row.contentKey.includes(':ft'), false); }
    }
    assert.ok(changedBands > 0); assert.ok(unchangedOthers > 0);
  } finally { setFieldTexturesForTest(null); setGroundChunkCacheFactoryForTest(null); }
});

test('deferred next-season paint holds its exact crop and texture snapshot; actual turn uses matching key', () => {
  const h = harness(); setFieldTexturesForTest(h.art);
  const idleOriginal = Object.getOwnPropertyDescriptor(globalThis, 'requestIdleCallback');
  const idle: IdleRequestCallback[] = []; Object.defineProperty(globalThis, 'requestIdleCallback', { configurable: true, value: (callback: IdleRequestCallback) => { idle.push(callback); return idle.length; } });
  const cache = createGroundChunkCache(factory, () => 0); setGroundChunkCacheFactoryForTest(() => cache);
  const staged: { request: ChunkRasterRequest; paint: (context: CanvasRenderingContext2D) => void }[] = [];
  cache.needsStage = () => true; cache.stage = (request, paint) => { staged.push({ request, paint }); return true; }; cache.needs = () => false;
  const context = recordingCanvas(1280, 800).context; const state = stateAt(3800);
  try {
    drawTerrainBoundaryV2(context, { state, tiles: [], range, zoom: 1 }, parts);
    for (const callback of idle.splice(0)) callback({ didTimeout: false, timeRemaining: () => 50 });
    const stagedField = staged.find(row => row.request.contentKey.includes(':ft')); assert.ok(stagedField);
    assert.ok(stagedField.request.contentKey.includes('spring'));
    const expected = new Map(staged.map(row => [row.request.id, row.request.contentKey]));
    const actual: ChunkRasterRequest[] = []; cache.draw = (_target, request) => { actual.push(request); };
    drawTerrainBoundaryV2(context, { state: { ...state, tick: 4000 }, tiles: [], range, zoom: 1 }, parts);
    for (const request of actual) assert.equal(request.contentKey, expected.get(request.id));
    // A later crop update must not be recomputed inside an already queued callback.
    Object.assign(state, { arableFields: state.arableFields?.map(field => ({ ...field, strips: field.strips.map(strip => ({ ...strip, stage: 'sown' })) })) });
    const painted = recordingCanvas(1280, 800); stagedField.paint(painted.context);
    assert.ok(painted.canvas.ops.some(op => op.includes('spring-joined')));
    assert.ok(painted.canvas.ops.every(op => !op.includes('ridge_seedling_a-joined')));
  } finally {
    setFieldTexturesForTest(null); setGroundChunkCacheFactoryForTest(null);
    if (idleOriginal === undefined) Reflect.deleteProperty(globalThis, 'requestIdleCallback'); else Object.defineProperty(globalThis, 'requestIdleCallback', idleOriginal);
  }
});

test('both field axes retain affine/clip geometry while wash follows the actual selected pair', () => {
  const h = harness(); setFieldTexturesForTest(h.art);
  try {
    const state = stateAt(0); const scene = groundBoundaryScene(state); const states = arableStripStateLookup(state);
    const textures = prepareArableFieldTextures(states, [0, 1]); const indexes = scene.zones.fields.flatMap((field, index) => field === null ? [] : [index]);
    for (const axis of ['x', 'y'] as const) {
      const layer = { ...scene.zones, fields: scene.zones.fields.map(field => field === null ? null : { ...field, axis }) };
      const spring = recordingCanvas(1280, 800); const summer = recordingCanvas(1280, 800);
      drawArableFields(spring.context, layer, indexes, states, 0, textures); drawArableFields(summer.context, layer, indexes, states, 1, textures);
      const geometry = (ops: string[]) => ops.filter(op => /^(pattern.setTransform|moveTo|lineTo|clip|closePath)/.test(op));
      assert.deepEqual(geometry(spring.canvas.ops), geometry(summer.canvas.ops));
      const basis = axis === 'x' ? 'pattern.setTransform(0.25,0.125,-0.25,0.125,' : 'pattern.setTransform(-0.25,0.125,0.25,0.125,';
      assert.ok(spring.canvas.ops.some(op => op.startsWith(basis))); assert.ok(spring.canvas.ops.includes('clip()'));
      assert.ok(spring.canvas.ops.some(op => op.includes('spring-joined')));
      assert.ok(summer.canvas.ops.filter(op => op === 'fill()').length > spring.canvas.ops.filter(op => op === 'fill()').length);
    }
  } finally { setFieldTexturesForTest(null); }
});

test('pattern allocation failure skips that context without invalidating a successfully composed pair', () => {
  const h = harness(); setFieldTexturesForTest(h.art);
  try {
    const state = stateAt(0); const scene = groundBoundaryScene(state); const states = arableStripStateLookup(state);
    const snapshot = prepareArableFieldTextures(states, [0]); const request = { fieldState: 'ploughed', season: 'spring' } as const;
    const prepared = snapshot.get(request); assert.ok(prepared);
    const indexes = scene.zones.fields.flatMap((field, index) => field === null ? [] : [index]);
    const unavailable = recordingCanvas(1280, 800);
    const blocked = new Proxy(unavailable.context, { get: (target, key) => key === 'createPattern' ? () => null : Reflect.get(target, key) });
    drawArableFields(blocked, scene.zones, indexes, states, 0, snapshot);
    assert.equal(unavailable.canvas.ops.includes('fill()'), false); assert.equal(h.art.compositionFailures().length, 0);
    const ready = recordingCanvas(1280, 800); drawArableFields(ready.context, scene.zones, indexes, states, 0, snapshot);
    assert.ok(ready.canvas.ops.some(op => op.includes('spring-joined'))); assert.equal(snapshot.get(request), prepared);
  } finally { setFieldTexturesForTest(null); }
});
