import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtBundle, BuildingBodyEntry } from '../src/render/art/artContract';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createContractHouseArt } from '../src/render/art/contractHouseArt';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { stateCalendar } from '../src/engine/scenarioState';
import { BREW_ALE_CRAFT_ID } from '../src/engine/ale';
import { BALANCE } from '../src/content/balanceConfig';
import { tileToScreen, TILE_H } from '../src/render/iso';
import { resetSeasonBlendForTest } from '../src/render/seasonTransition';

const home = DEFAULT_GAME_STATE.buildings.find(building => building.kind === 'house');
const resident = DEFAULT_GAME_STATE.houses.find(house => house.buildingId === home?.id);
assert.ok(home && resident);
const building = home;
const house = { ...resident, builtLevel: 2, level: 2, residents: 4 };
const originYear = stateCalendar({ ...DEFAULT_GAME_STATE, tick: 0 }).year;
const state = { ...DEFAULT_GAME_STATE, houses: [house], tick: (1350 - originYear) * BALANCE.TICKS_PER_YEAR };
const input = { state, building, level: 2 };
const geometry = { pivot: { x: 32, y: 60 }, scale: 0.5, allowMirror: false } as const;
const body: BuildingBodyEntry = { id: 'body-a', kind: 'building-body', image: { url: 'assets/test/a.png', width: 64, height: 64 },
  provenance: { inboxFile: 'assets-inbox/test/a.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) },
  geometry, buildingKinds: ['house'], levels: [2], variantId: 'a' };
const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'test-house', entries: [body, { ...body, id: 'body-b', variantId: 'b' }], rules: [
  { id: 'body-rule', kind: 'building-body', slot: 'house-body', priority: 1,
    conditions: [{ op: 'eq', field: 'eligible', value: true }, { op: 'eq', field: 'lot', value: 'single' }, { op: 'range', field: 'calendarYear', min: 1350, max: 1400 }],
    variants: [{ assetId: 'body-a', weight: 1 }, { assetId: 'body-b', weight: 1 }], fallback: 'none' },
] };

test('empty catalog and partial state never take over the existing house path', () => {
  const art = createContractHouseArt(createArtRegistry([]));
  assert.equal(art.select(input), null);
  assert.equal(art.ready({ ...input, state: { seed: 1, houses: [house] } }), false);
});

test('authored calendar boundaries select stable variants without changing engine state', () => {
  resetSeasonBlendForTest();
  const art = createContractHouseArt(createArtRegistry([bundle]));
  const before = JSON.stringify(input.state);
  assert.ok(art.select(input));
  assert.equal(art.select(input)?.id, art.select(input)?.id);
  assert.equal(art.select({ ...input, state: { ...state, tick: state.tick - 1 } }), null);
  assert.equal(art.select({ ...input, state: { ...state, tick: (1400 - originYear) * BALANCE.TICKS_PER_YEAR } }), null);
  assert.equal(JSON.stringify(input.state), before);
  const ids = new Set(Array.from({ length: 30 }, (_, seed) => art.select({ ...input, state: { ...state, seed } })?.id));
  assert.deepEqual([...ids].sort(), ['body-a', 'body-b']);
});

test('paired lots and burnt houses keep their existing painting', () => {
  const art = createContractHouseArt(createArtRegistry([bundle]));
  assert.equal(art.select({ ...input, building: { ...building, houseLot: 'horizontal' } }), null);
  assert.equal(art.select({ ...input, state: { ...state, houses: [{ ...house, burntTick: 1 }] } }), null);
});

test('active fire cannot select a contract painting', () => {
  const art = createContractHouseArt(createArtRegistry([bundle]));
  const events = { records: [], burning: [{ buildingId: building.id, eventId: 'fire', ignitedTick: 0, outTick: state.tick + 100, doused: false }] };
  assert.equal(art.select({ ...input, state: { ...state, events } }), null);
});

test('body and required overlay load atomically and share exact source and destination rectangles', async () => {
  resetSeasonBlendForTest();
  const snowBundle: ArtBundle = { ...bundle, entries: [...bundle.entries, {
    id: 'snow', kind: 'state-overlay', image: body.image, provenance: body.provenance, geometry,
    targetBodyIds: ['body-a', 'body-b'], layer: 'snow', transform: 'inherit-body', order: 1,
  }], rules: [...bundle.rules, { id: 'snow-rule', kind: 'state-overlay', slot: 'house-snow', priority: 0,
    conditions: [{ op: 'eq', field: 'season', value: 'winter' }], variants: [{ assetId: 'snow', weight: 1 }], fallback: 'none' }] };
  const images: HTMLImageElement[] = [];
  const art = createContractHouseArt(createArtRegistry([snowBundle]), { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { naturalWidth: 64, naturalHeight: 64, onload: null, onerror: null, decode: () => Promise.resolve() });
    images.push(image); return image;
  } });
  const winter = { ...input, state: { ...state, tick: state.tick + BALANCE.TICKS_PER_YEAR * 0.75 + 400 } };
  const calls: unknown[][] = [];
  const alphas: number[] = [];
  const context = { globalAlpha: 0.8, imageSmoothingEnabled: false, save: () => undefined, restore: () => undefined,
    drawImage: (...args: unknown[]) => { calls.push(args); alphas.push(context.globalAlpha); }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  assert.equal(art.drawBody(context, winter), null);
  assert.equal(images.length, 2);
  const first = images[0]; const second = images[1];
  assert.ok(first && second);
  first.onload?.call(first, new Event('load')); await Promise.resolve();
  assert.equal(art.drawBody(context, winter), null);
  assert.equal(art.drawLayers(context, null), false);
  assert.equal(calls.length, 0);
  second.onload?.call(second, new Event('load')); await Promise.resolve();
  const drawn = art.drawBody(context, winter);
  assert.ok(drawn);
  // A calendar jump cannot change the body registration or layer list already drawn in this pass.
  art.select({ ...input, state: { ...state, tick: (1400 - originYear) * BALANCE.TICKS_PER_YEAR } });
  assert.equal(art.drawLayers(context, drawn), true);
  assert.equal(calls.length, 2);
  assert.equal(alphas[0], 0.8);
  assert.ok(alphas[1] !== undefined && alphas[1] > 0 && alphas[1] < 0.8);
  assert.equal(context.globalAlpha, 0.8);
  assert.deepEqual(calls[0]?.slice(1), calls[1]?.slice(1));
  const center = tileToScreen(building.tx, building.ty);
  assert.deepEqual(calls[0]?.slice(1), [0, 0, 64, 64, center.sx - 16, center.sy + TILE_H / 2 - 30, 32, 32]);
  assert.equal(Object.isFrozen(drawn), true);
  assert.equal(Object.isFrozen(drawn.body.targetRect), true);
});


test('partial state and ale-stake houses never acquire a fabricated contract context', () => {
  const art = createContractHouseArt(createArtRegistry([bundle]));
  assert.equal(art.select({ ...input, state: { seed: 1, houses: [house] } }), null);
  const crafts = [{ craftId: BREW_ALE_CRAFT_ID, workers: 1, input: { malt: 1 }, output: { ale: 2 }, stock: { ale: 3 } }];
  assert.equal(art.select({ ...input, state: { ...state, houses: [{ ...house, crafts }] } }), null);
});

test('a missing required seasonal layer keeps the complete legacy painting', () => {
  resetSeasonBlendForTest();
  const art = createContractHouseArt(createArtRegistry([bundle]));
  const winter = { ...input, state: { ...state, tick: state.tick + BALANCE.TICKS_PER_YEAR * 0.75 } };
  assert.equal(art.select(winter), null);
  assert.equal(art.ready(winter), false);
});

for (const scale of [geometry.scale, 0.75]) {
  test(`an overlay for another body rejects takeover before loading or painting (selected scale ${scale})`, () => {
    resetSeasonBlendForTest();
    const incompatible: ArtBundle = { ...bundle, entries: [body,
      { ...body, id: 'body-b', variantId: 'b', geometry: { ...geometry, scale } },
      { id: 'snow-a', kind: 'state-overlay', image: body.image, provenance: body.provenance, geometry,
        targetBodyIds: ['body-a'], layer: 'snow', transform: 'inherit-body', order: 1 },
    ], rules: [...bundle.rules.map(rule => ({ ...rule, variants: [{ assetId: 'body-b', weight: 1 }] })),
      { id: 'broad-snow', kind: 'state-overlay', slot: 'house-snow', priority: 0,
        conditions: [{ op: 'eq', field: 'season', value: 'winter' }], variants: [{ assetId: 'snow-a', weight: 1 }], fallback: 'none' },
    ] };
    let requests = 0;
    const art = createContractHouseArt(createArtRegistry([incompatible]), { baseUrl: '/', createImage: () => {
      requests += 1;
      const image: HTMLImageElement = Object.create(null);
      Object.assign(image, { naturalWidth: 64, naturalHeight: 64, decode: () => Promise.resolve() });
      return image;
    } });
    const winter = { ...input, state: { ...state, tick: state.tick + BALANCE.TICKS_PER_YEAR * 0.75 } };
    const calls: unknown[][] = [];
    const context = { imageSmoothingEnabled: false, save: () => undefined, restore: () => undefined,
      drawImage: (...args: unknown[]) => { calls.push(args); }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
    assert.equal(art.select(winter), null);
    assert.equal(art.ready(winter), false);
    assert.equal(art.drawBody(context, winter), null);
    assert.equal(art.drawLayers(context, null), false);
    assert.equal(requests, 0);
    assert.deepEqual(calls, []);
  });
}

for (const mismatch of ['building-kind', 'level', 'overlay-layer'] as const) {
  test(`authored ${mismatch} metadata cannot contradict the selected house facts`, () => {
    resetSeasonBlendForTest();
    const bodyEntry = { ...body, buildingKinds: mismatch === 'building-kind' ? ['church'] : ['house'], levels: mismatch === 'level' ? [3] : [2] };
    const contradictory: ArtBundle = { ...bundle, entries: [bodyEntry, {
      id: 'layer', kind: 'state-overlay', image: body.image, provenance: body.provenance, geometry,
      targetBodyIds: ['body-a'], layer: 'boarded', transform: 'inherit-body', order: 1,
    }], rules: [...bundle.rules.map(rule => ({ ...rule, variants: [{ assetId: 'body-a', weight: 1 }] })), {
      id: 'wrong-layer', kind: 'state-overlay', slot: 'house-snow', priority: 0,
      conditions: [{ op: 'eq', field: 'season', value: 'winter' }], variants: [{ assetId: 'layer', weight: 1 }], fallback: 'none',
    }] };
    let requests = 0;
    const art = createContractHouseArt(createArtRegistry([contradictory]), { baseUrl: '/', createImage: () => {
      requests += 1;
      const image: HTMLImageElement = Object.create(null);
      return image;
    } });
    const actual = mismatch === 'overlay-layer' ? { ...input, state: { ...state, tick: state.tick + BALANCE.TICKS_PER_YEAR * 0.75 } } : input;
    const calls: unknown[][] = [];
    const context = { imageSmoothingEnabled: false, save: () => undefined, restore: () => undefined,
      drawImage: (...args: unknown[]) => { calls.push(args); }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
    assert.equal(art.select(actual), null);
    assert.equal(art.ready(actual), false);
    assert.equal(art.drawBody(context, actual), null);
    assert.equal(requests, 0);
    assert.deepEqual(calls, []);
  });
}
