import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { BALANCE } from '../src/content/balanceConfig';
import { stateCalendar } from '../src/engine/scenarioState';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { createWorldFireArt, type WorldFireSelector } from '../src/render/worldFireArt';
import { worldFireProps, withWorldFireProps, worldFireBrigadeIds } from '../src/render/worldFireProps';
import { worldFireBrigadeAnchor, worldFireReserved, worldFireSupport } from '../src/render/worldFirePlacement';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { tileToScreen } from '../src/render/iso';
import { buildingFootprint } from '../src/geometry/buildingFootprint';

const home = DEFAULT_GAME_STATE.buildings.find(building => building.kind === 'house');
assert.ok(home);
const house = { ...home, tx: 12, ty: 12 };
const brigade = ART_REGISTRY.entry('world-events/bucket-brigade-summer');
assert.ok(brigade?.kind === 'event-scene');
const ready: WorldFireSelector = (_state, _eventId, role) => {
  const entry = ART_REGISTRY.entry(role === 'bucket-brigade' ? 'world-events/bucket-brigade-summer' : 'world-events/fire-flicker');
  return entry?.kind === 'event-scene' ? entry : null;
};
function fixture(): GameState {
  const width = 32, height = 32;
  return { ...DEFAULT_GAME_STATE, width, height, tick: 20, buildings: [house, { ...house, id: 'well', kind: 'well', tx: 20, ty: 12 }],
    tiles: Array.from({ length: width * height }, (_, index) => ({ tx: index % width, ty: Math.floor(index / width), terrain: 'grass', buildingId: null, hasRoad: false })),
    houses: [], constructionSites: [], walkers: [], palisade: null, zones: [],
    events: { records: [], burning: [{ buildingId: house.id, eventId: 'custom-fire', ignitedTick: 10, outTick: 50, doused: true }] },
  };
}
test('actual burning record deterministically anchors flame on house and reserves the whole brigade span', () => {
  const state = fixture(), before = JSON.stringify(state);
  const props = worldFireProps(state, ready);
  assert.deepEqual(props, worldFireProps(state, ready));
  assert.equal(props.length, 2);
  assert.equal(props[0]?.eventId, 'custom-fire');
  const group = props.find(prop => prop.role === 'bucket-brigade'); assert.ok(group);
  const support = worldFireSupport(brigade, group);
  assert.ok(support.length > 5);
  assert.ok(support.every(cell => !worldFireReserved(state).has(`${cell.tx},${cell.ty}`)));
  const left = Math.min(...support.map(cell => tileToScreen(cell.tx, cell.ty).sx));
  const right = Math.max(...support.map(cell => tileToScreen(cell.tx + 1, cell.ty).sx));
  assert.ok(right - left >= 112);
  assert.equal(JSON.stringify(state), before);
});
for (const tick of [0, 9, 50, 51]) test(`no invented fire before ignition or after expiry at tick ${tick}`, () => {
  assert.deepEqual(worldFireProps({ ...fixture(), tick }, ready), []);
});
test('non-doused and no-well records retain flames but never invent a brigade', () => {
  const state = fixture();
  assert.equal(worldFireProps({ ...state, events: { records: [], burning: state.events!.burning.map(entry => ({ ...entry, doused: false })) } }, ready).length, 1);
  assert.equal(worldFireProps({ ...state, buildings: [house] }, ready).length, 1);
});
test('no safe space retains fallback eligibility and refuses water, trees, occupied cells', () => {
  for (const terrain of ['water', 'forest', 'rock'] as const) {
    const state = fixture(); state.tiles = state.tiles.map(tile => ({ ...tile, terrain }));
    assert.equal(worldFireProps(state, ready).filter(prop => prop.role === 'bucket-brigade').length, 0);
  }
  const state = fixture(); state.tiles = state.tiles.map(tile => ({ ...tile, buildingId: 'occupied' }));
  assert.equal(worldFireProps(state, ready).length, 1);
  assert.equal(worldFireBrigadeAnchor(fixture(), house, brigade, new Set(fixture().tiles.map(tile => `${tile.tx},${tile.ty}`))), null);
});
test('unavailable image leaves original queue untouched, including ordinary no-fire frames', () => {
  const art = createWorldFireArt(ART_REGISTRY, { createImage: null, baseUrl: '/' });
  assert.deepEqual(worldFireProps(fixture(), art.select), []);
  const queue = [{ kind: 'building' as const, id: house.id, building: house, depth: 24, anchorTx: 12 }];
  assert.equal(withWorldFireProps(queue, { ...fixture(), events: { records: [], burning: [] } }, { minTx: 0, minTy: 0, maxTx: 31, maxTy: 31 }), queue);
});
test('all brigade support rejects a wall between well-side placement and household', () => {
  const state = fixture();
  state.palisade = { ...DEFAULT_GAME_STATE.palisade!, gate: { x: 0, y: 0 }, segments: [{ id: 'wall', order: 0, tileCount: 32, constructionSiteId: null, completed: true, edgePath: [{ x: 13, y: 0 }, { x: 13, y: 32 }] }] };
  assert.equal(worldFireBrigadeAnchor(state, house, brigade, worldFireReserved(state)), null);
});
test('seven-person groups are capped at five without changing residents', () => {
  const state = fixture();
  state.buildings = Array.from({ length: 8 }, (_, index) => ({ ...house, id: `fire-${index}`, tx: 3 + index % 4 * 8, ty: 3 + Math.floor(index / 4) * 16 }));
  state.buildings.push({ ...house, id: 'well', kind: 'well', tx: 16, ty: 15 });
  const burning = state.buildings.filter(building => building.kind === 'house').map(building => ({ buildingId: building.id, eventId: 'fire', ignitedTick: 0, outTick: 50, doused: true }));
  const groups = worldFireProps({ ...state, events: { records: [], burning } }, ready).filter(prop => prop.role === 'bucket-brigade');
  assert.equal(groups.length, 5);
});
test('decoded images choose seasonal whole groups and draw one unmirrored authored rectangle', async () => {
  const images: HTMLImageElement[] = [];
  const art = createWorldFireArt(ART_REGISTRY, { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { naturalWidth: 320, naturalHeight: 240, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
    images.push(image); return image;
  } });
  const state = fixture();
  for (const season of [0, 1, 2, 3]) {
    state.tick = Math.floor(season * BALANCE.TICKS_PER_YEAR / 4);
    assert.equal(stateCalendar(state).season, season);
    art.select(state, 'custom-fire', 'bucket-brigade');
    for (const image of images) image.onload?.call(image, new Event('load'));
    await Promise.resolve(); await Promise.resolve();
    const selected = art.select(state, 'custom-fire', 'bucket-brigade');
    assert.equal(selected?.id, `world-events/bucket-brigade-${season === 3 ? 'winter' : 'summer'}`);
  }
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), save() {}, restore() {}, drawImage: (...args: unknown[]) => { calls.push(args); } };
  const prop = { id: 'group', buildingId: house.id, eventId: 'fire', role: 'bucket-brigade' as const, assetId: brigade.id, tx: 10, ty: 10 };
  assert.equal(art.draw(context, prop, 100), true);
  const call = calls[0]; assert.ok(call);
  assert.deepEqual(call.slice(1, 5), [0, 0, 320, 240]);
  assert.deepEqual(call.slice(5).map(value => Math.round(Number(value) * 100)), [-5632, 24960, 11264, 8448]);
});

test('load failure and wrong decoded size never remove the bucket fallback', async () => {
  for (const failure of ['network', 'dimensions'] as const) {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { naturalWidth: 1, naturalHeight: 1, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
    const art = createWorldFireArt(ART_REGISTRY, { baseUrl: '/', createImage: () => image });
    const state = fixture();
    assert.equal(art.select(state, 'fire', 'bucket-brigade'), null);
    if (failure === 'network') image.onerror?.call(image, new Event('error'));
    else image.onload?.call(image, new Event('load'));
    await Promise.resolve(); await Promise.resolve();
    assert.equal(art.select(state, 'fire', 'bucket-brigade'), null);
  }
});

test('fire objects join world depth ordering and offscreen objects are culled', () => {
  const state = fixture();
  const queue = [{ kind: 'building' as const, id: house.id, building: house, depth: 24, anchorTx: 12 },
    { kind: 'building' as const, id: 'foreground', building: { ...house, id: 'foreground', tx: 25, ty: 25 }, depth: 50, anchorTx: 25 }];
  const items = withWorldFireProps(queue, state, { minTx: 0, minTy: 0, maxTx: 31, maxTy: 31 }, ready);
  assert.equal(items.length, 4);
  assert.ok(items.every((item, index) => index === 0 || item.depth >= items[index - 1]!.depth));
  assert.equal(items.at(-1)?.id, 'foreground');
  assert.equal(withWorldFireProps(queue, state, { minTx: 0, minTy: 0, maxTx: 1, maxTy: 1 }, ready), queue);
});


test('only actual visible brigade queue receipts suppress legacy buckets; crops stay clear', () => {
  const state = fixture();
  const queue = withWorldFireProps([], state, { minTx: 0, minTy: 0, maxTx: 31, maxTy: 31 }, ready);
  assert.deepEqual([...(worldFireBrigadeIds(queue) ?? [])], [house.id]);
  assert.equal(worldFireBrigadeIds(queue.filter(item => item.kind !== 'world_fire' || item.prop.role !== 'bucket-brigade')), undefined);
  const zones = [{ id: 'field', kind: 'arable' as const, strokes: [], createdOrdinal: 0, membership: state.tiles.map((_, index) => index) }];
  assert.equal(worldFireProps({ ...state, zones }, ready).filter(prop => prop.role === 'bucket-brigade').length, 0);
});

test('a well behind the burning house cannot hide the brigade behind its roof', () => {
  const state = fixture();
  state.buildings[1] = { ...state.buildings[1]!, tx: house.tx - 4, ty: house.ty };
  const group = worldFireProps(state, ready).find(prop => prop.role === 'bucket-brigade');
  assert.ok(group);
  const size = buildingFootprint(house);
  const front = tileToScreen(house.tx + size.width, house.ty + size.height);
  assert.ok(tileToScreen(group.tx, group.ty).sy >= front.sy, 'whole brigade anchor must be in front of the burning building');
});
