import assert from 'node:assert/strict';
import test from 'node:test';
import baseline from './fixtures/region-texture-migration.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createRegionTextureArt, REGION_TEXTURE_ART } from '../src/render/art/regionTextureArt';
import { newGameState } from '../src/state/newGame';
import { DEFAULT_SCENARIO_ID } from '../src/content/scenario/coreScenarios';
import { landGroundOf } from '../src/render/archetypeGroundModel';
import { chunkRegions } from '../src/render/archetypeGroundRegions';
import { groundBoundaryScene } from '../src/render/groundBoundaryScene';
import { regionPatternOf, drawLandFills } from '../src/render/archetypeGroundDraw';

const spring = { baseId: 'chalk_down', season: 'spring' } as const;
function harness(sameSource = false) {
  const baseRules = baseline.rules.filter(r => r.conditions.some(c => c.field === 'baseId' && c.value === spring.baseId) && r.conditions.some(c => c.field === 'season' && c.value === spring.season));
  const baseIds = baseRules.map(r => r.variants[0]!.assetId);
  const source = baseline.entries.find(e => e.id === baseIds[0]); assert.ok(source);
  const extras = ['optional-a', 'optional-b'].map(id => ({ ...source, id }));
  const rules = baseRules.map((r, i) => ({ ...r, id: `optional-rule-${i}`, slot: r.slot.replace('base', 'season'), variants: [{ assetId: sameSource ? 'optional-a' : extras[i]!.id, weight: 1 }] }));
  const registry = createArtRegistry([{ ...baseline, entries: [...baseline.entries, ...extras], rules: [...baseline.rules, ...rules] }]);
  const images: HTMLImageElement[] = [];
  const resolves = new Map<HTMLImageElement, () => void>();
  const art = createRegionTextureArt(registry, { baseUrl: '/', createImage: () => {
    let complete: () => void = () => {};
    const decoded = new Promise<void>(resolve => { complete = resolve; });
    const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 256, naturalHeight: 128, src: '', alt: '', onload: null, onerror: null, decode: () => decoded });
    images.push(image); resolves.set(image, complete); return image;
  } });
  const byId = new Map<string, HTMLImageElement>();
  for (const id of art.ids(spring)) { art.image(id); const image = images.at(-1); assert.ok(image); image.alt = id; byId.set(id, image); }
  return { art, images, baseIds, byId, async ready(id: string) {
    const image = byId.get(id); assert.ok(image); image.onload?.call(image, new Event('load')); resolves.get(image)!(); await Promise.resolve();
  } };
}
function context(fail?: 'null' | 'create' | 'transform') {
  const events: string[] = [];
  const value = { createPattern(image: HTMLImageElement) {
    events.push(`create:${image.alt}`);
    if (fail === 'null') return null;
    if (fail === 'create') throw new Error('context pattern failed');
    return { label: image.alt, setTransform(matrix: DOMMatrix2DInit) {
      events.push(`transform:${image.alt}`);
      assert.deepEqual(matrix, { a: 0.25, b: 0.125, c: -0.5, d: 0.25, e: 0, f: -16 });
      if (fail === 'transform') throw new Error('context transform failed');
    } };
  } };
  return { value: value as unknown as CanvasRenderingContext2D, events };
}
const labels = (pair: readonly (CanvasPattern | null)[]) => pair.map(p => p === null ? null : (p as CanvasPattern & { label: string }).label);

test('base sides retain independent decode readiness; missing optional pair falls back without duplicate requests', async () => {
  const h = harness(); const c = context(); const get = () => h.art.patterns(spring, image => regionPatternOf(c.value, image));
  assert.deepEqual(get(), [null, null]);
  const first = h.byId.get(h.baseIds[0]!); assert.ok(first); first.onload?.call(first, new Event('load'));
  assert.deepEqual(get(), [null, null], 'onload alone does not mean decoded');
  await h.ready(h.baseIds[0]!); assert.deepEqual(labels(get()), [h.baseIds[0], null]);
  await h.ready(h.baseIds[1]!); await h.ready('optional-a');
  assert.deepEqual(labels(get()), h.baseIds, 'one optional side cannot paint');
  const missing = h.byId.get('optional-b'); assert.ok(missing); missing.onerror?.call(missing, new Event('error'));
  await h.ready('optional-b');
  for (let frame = 0; frame < 3; frame++) assert.deepEqual(labels(get()), h.baseIds);
  assert.equal(h.art.status('optional-b').status, 'missing'); assert.equal(h.images.length, 4);
});
test('optional pair prepares both patterns and transforms before any fill; context failures fall back atomically', async () => {
  for (const fail of ['null', 'create', 'transform'] as const) {
    const h = harness(); for (const id of h.art.ids(spring)) await h.ready(id);
    const good = context(); const bad = context(fail);
    const prepare = (image: HTMLImageElement) => regionPatternOf(image.alt === 'optional-b' ? bad.value : good.value, image);
    assert.deepEqual(labels(h.art.patterns(spring, prepare)), h.baseIds);
    const count = bad.events.length;
    assert.deepEqual(labels(h.art.patterns(spring, prepare)), h.baseIds); assert.equal(bad.events.length, count, 'failed context does not retry');
    const recovered = context(); const pair = h.art.patterns(spring, image => regionPatternOf(recovered.value, image));
    assert.deepEqual(labels(pair), ['optional-a', 'optional-b']);
    assert.deepEqual(recovered.events, ['create:optional-a', 'transform:optional-a', 'create:optional-b', 'transform:optional-b']);
    const winter = h.art.selection({ ...spring, season: 'winter' }); assert.equal(winter.seasonal, null);
  }
});
test('A/A optional references share one image and pattern while preserving two draw roles', async () => {
  const h = harness(true); await h.ready('optional-a'); const c = context();
  const pair = h.art.patterns(spring, image => regionPatternOf(c.value, image));
  assert.equal(pair[0], pair[1]); assert.deepEqual(labels(pair), ['optional-a', 'optional-a']);
  assert.equal(c.events.filter(e => e.startsWith('create')).length, 1); assert.equal(h.images.length, 3);
});
test('unknown bases and absent browser API remain unavailable without synthetic textures', () => {
  const art = createRegionTextureArt(createArtRegistry([baseline]), { baseUrl: '/', createImage: null });
  assert.deepEqual(art.patterns(spring, () => { throw new Error('must not prepare'); }), [null, null]);
  assert.deepEqual(art.ids({ baseId: 'unknown', season: 'spring' }), []);
});

test('decode rejection and native-size mismatch are terminal and leave the other base side usable', async () => {
  for (const failure of ['decode', 'dimensions'] as const) {
    const h = harness(); const image = h.byId.get(h.baseIds[0]!); assert.ok(image);
    if (failure === 'decode') image.decode = () => Promise.reject(new Error('bad encoded source'));
    else Object.defineProperty(image, 'naturalWidth', { value: 255 });
    await h.ready(h.baseIds[0]!); await h.ready(h.baseIds[1]!);
    const c = context();
    for (let frame = 0; frame < 3; frame++) assert.deepEqual(labels(h.art.patterns(spring, source => regionPatternOf(c.value, source))), [null, h.baseIds[1]]);
    assert.equal(h.art.status(h.baseIds[0]!).status, 'missing'); assert.equal(h.images.length, 4);
  }
});


test('the actual land painter emits zero optional fills when the second pattern or transform fails', async () => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: 'core:chalk_downs', seed: 74 }); assert.ok(state);
  const land = landGroundOf(state); assert.ok(land);
  const plan = groundBoundaryScene(state).chunks.find(chunk => chunkRegions(land, chunk).some(part => part.region.base === 'chalk_down')); assert.ok(plan);
  const original = REGION_TEXTURE_ART.patterns;
  try {
    for (const failure of ['null', 'create', 'transform'] as const) {
      const h = harness(); for (const id of h.art.ids(spring)) await h.ready(id);
      REGION_TEXTURE_ART.patterns = h.art.patterns;
      const painted: string[] = []; const events: string[] = [];
      const value = {
        fillStyle: null as null | { label: string },
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {},
        createPattern(image: HTMLImageElement) {
          events.push(`create:${image.alt}`);
          if (image.alt === 'optional-b' && failure === 'null') return null;
          if (image.alt === 'optional-b' && failure === 'create') throw new Error('allocation');
          return { label: image.alt, setTransform() { events.push(`transform:${image.alt}`); if (image.alt === 'optional-b' && failure === 'transform') throw new Error('transform'); } };
        },
        fill() { assert.ok(this.fillStyle); painted.push(this.fillStyle.label); events.push(`fill:${this.fillStyle.label}`); },
      };
      drawLandFills(value as unknown as CanvasRenderingContext2D, land, plan, { left: -1e4, top: -1e4, right: 1e4, bottom: 1e4 }, 0);
      assert.deepEqual(painted, h.baseIds); assert.ok(!painted.some(id => id.startsWith('optional')));
      assert.ok(events.indexOf('create:optional-b') < events.findIndex(event => event.startsWith('fill:')));
    }
  } finally { REGION_TEXTURE_ART.patterns = original; }
});
