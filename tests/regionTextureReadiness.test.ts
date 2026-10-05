import assert from 'node:assert/strict';
import test from 'node:test';
import { newGameState } from '../src/state/newGame';
import { DEFAULT_SCENARIO_ID } from '../src/content/scenario/coreScenarios';
import { landArtKeys, landGroundOf } from '../src/render/archetypeGroundModel';
import { landArtReadiness } from '../src/render/archetypeGroundDraw';
import { REGION_TEXTURE_ART } from '../src/render/art/regionTextureArt';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { isRegionTexture } from '../src/render/art/artContract';

// Exercise the real polling/memo caller with controlled region readiness. No GameState facts or production catalog are changed.
test('all-four-season warm keeps legacy URL order, and optional IDs prevent an early allReady memo', async () => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: 'core:chalk_downs', seed: 73 }); assert.ok(state);
  const land = landGroundOf(state); assert.ok(land);
  const original = { selection: REGION_TEXTURE_ART.selection, image: REGION_TEXTURE_ART.image, Image: globalThis.Image };
  const ready = new Set<string>(); const requested: string[] = [];
  const realImage: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 256, naturalHeight: 128 });
  const optionalIds = ['optional-a', 'optional-b'];
  try {
    REGION_TEXTURE_ART.selection = request => {
      const selected = original.selection(request);
      if (request.season !== 'spring' || request.baseId !== 'chalk_down' || selected.base === null) return selected;
      return { ...selected, seasonal: [{ ...selected.base[0], id: optionalIds[0]! }, { ...selected.base[1], id: optionalIds[1]! }] };
    };
    REGION_TEXTURE_ART.image = id => { if (!requested.includes(id)) requested.push(id); return ready.has(id) ? realImage : null; };
    (globalThis as unknown as { Image: unknown }).Image = class {
      naturalWidth = 512; naturalHeight = 64; onload: (() => void) | null = null; onerror: unknown = null;
      decode() { return Promise.resolve(); }
      set src(url: string) { const entry = ART_REGISTRY.entries().find(e => url.endsWith(e.image.url)); if (entry) { this.naturalWidth = entry.image.width; this.naturalHeight = entry.image.height; } queueMicrotask(() => this.onload?.()); }
    };
    const first = landArtReadiness(land, 0); assert.ok(first.includes('0'));
    const bases = [...new Set(land.fillBase.filter((base): base is string => base !== null))].sort();
    const expected: string[] = [];
    for (const season of ['summer', 'autumn', 'winter']) for (const base of bases) for (const role of ['a', 'b']) {
      const entry = ART_REGISTRY.entries().find(e => isRegionTexture(e) && e.image.url === `assets/wave22/terrain/${base}_${season}_${role}.png`); assert.ok(entry); expected.push(entry.id);
    }
    assert.deepEqual(requested.filter(id => !optionalIds.includes(id)), expected);
    assert.ok(optionalIds.every(id => landArtKeys(land, 0).some(r => r.owner === 'region' && r.key === id)));
    assert.ok([1, 2, 3].every(season => !landArtKeys(land, season as 1 | 2 | 3).some(r => optionalIds.includes(r.key))));
    for (const id of requested) if (id !== 'optional-b') ready.add(id);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const half = landArtReadiness(land, 0); assert.notEqual(half, first); assert.ok(half.includes('0')); assert.equal(land.cache.allReady.has(0), false);
    ready.add('optional-b'); const complete = landArtReadiness(land, 0);
    assert.ok(!complete.includes('0')); assert.equal(land.cache.allReady.get(0), complete);
    assert.equal(landArtReadiness(land, 0), complete);
  } finally {
    REGION_TEXTURE_ART.selection = original.selection; REGION_TEXTURE_ART.image = original.image;
    if (original.Image === undefined) Reflect.deleteProperty(globalThis, 'Image'); else globalThis.Image = original.Image;
  }
});
