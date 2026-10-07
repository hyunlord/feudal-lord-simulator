import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtBundle, ArtRule, BuildingBodyEntry, StateOverlayEntry } from '../src/render/art/artContract';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createContractHouseArt } from '../src/render/art/contractHouseArt';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { House } from '../src/population/population.types';
import { BALANCE } from '../src/content/balanceConfig';
import { resetSeasonBlendForTest } from '../src/render/seasonTransition';

const building = DEFAULT_GAME_STATE.buildings.find(entry => entry.kind === 'house');
const resident = DEFAULT_GAME_STATE.houses.find(entry => entry.buildingId === building?.id);
assert.ok(building && resident);
const home = building;
const house: House = { ...resident, residents: 4, level: 1, builtLevel: 1, unmetRequirementTicks: 0 };
const body: BuildingBodyEntry = { id: 'historic', kind: 'building-body', image: { url: 'assets/test/body.png', width: 64, height: 64 },
  provenance: { inboxFile: 'assets-inbox/test/body.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) },
  geometry: { pivot: { x: 32, y: 60 }, scale: 0.5, allowMirror: false }, buildingKinds: ['house'], levels: [1], variantId: 'historic' };
const overlay = (id: string, layer: StateOverlayEntry['layer'], order: number): StateOverlayEntry => ({
  id, kind: 'state-overlay', image: { ...body.image, url: `assets/test/${id}.png` }, provenance: body.provenance,
  geometry: body.geometry, targetBodyIds: [body.id], layer, order, transform: 'inherit-body',
});
const rule = (id: string, layer: StateOverlayEntry['layer'], field: string, value: string | boolean): ArtRule => ({
  id: `${id}-rule`, kind: 'state-overlay', slot: layer === 'worn' ? 'house-condition' : `house-${layer}`, priority: 0,
  conditions: [{ op: 'eq', field: 'bodyId', value: body.id }, { op: 'eq', field, value }],
  variants: [{ assetId: id, weight: 1 }], fallback: 'none',
});
const conditions = ['strained', 'neglected', 'vacant'] as const;
const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'historic-test', entries: [body,
  ...conditions.map(id => overlay(id, 'worn', 0)), overlay('boards', 'boarded', 10), overlay('plague', 'boarded', 10), overlay('snow', 'snow', 20)],
  rules: [{ id: 'body-rule', kind: 'building-body', slot: 'house-body', priority: 0, conditions: [], variants: [{ assetId: body.id, weight: 1 }], fallback: 'none' },
    ...conditions.map(id => rule(id, 'worn', 'houseCondition', id)), rule('boards', 'boarded', 'plagueVacant', false),
    rule('plague', 'boarded', 'plagueVacant', true), rule('snow', 'snow', 'season', 'winter')] };
const plague = { eraTick: 0, answers: {}, vacantHouseIds: [home.id], resettled: 0, recovered: 0, fled: 0 };
function harness(catalog = bundle) {
  resetSeasonBlendForTest();
  const images: HTMLImageElement[] = [];
  const art = createContractHouseArt(createArtRegistry([catalog]), { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { naturalWidth: 64, naturalHeight: 64, decode: () => Promise.resolve() }); images.push(image); return image;
  } });
  const context = { globalAlpha: 1, imageSmoothingEnabled: false, save: () => undefined, restore: () => undefined,
    drawImage: () => undefined, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  const input = (patch: Partial<House> = {}, infected = false, tick = BALANCE.TICKS_PER_YEAR / 4) => ({
    state: { ...DEFAULT_GAME_STATE, tick, houses: [{ ...house, ...patch }], ...(infected ? { plague } : {}) }, building: home, level: 1,
  });
  const load = async () => { for (const image of images) image.onload?.call(image, new Event('load')); await Promise.resolve(); };
  return { art, images, context, input, load };
}

for (const [label, patch, expected] of [
  ['maintained', {}, []], ['strained', { builtLevel: 2 }, ['strained']],
  ['neglected-level', { builtLevel: 3 }, ['neglected']], ['before-neglect', { unmetRequirementTicks: 1199 }, []],
  ['neglected-time', { unmetRequirementTicks: 1200 }, ['neglected']], ['vacant', { residents: 0 }, ['vacant']],
  ['abandoned', { residents: 0, abandonedTick: 1 }, ['vacant', 'boards']],
] satisfies [string, Partial<House>, string[]][]) test(`real condition facts select ${label} without changing the state`, async () => {
  const h = harness(); const input = h.input(patch); const before = JSON.stringify(input.state);
  assert.equal(h.art.ready(input), false); await h.load();
  assert.deepEqual(h.art.drawBody(h.context, input)?.layers, expected);
  assert.equal(JSON.stringify(input.state), before);
});

test('plague boarding requires abandoned status and a currently empty recorded house', async () => {
  const h = harness();
  for (const [patch, expected] of [
    [{ residents: 0 }, ['vacant']], [{ residents: 0, abandonedTick: 1 }, ['vacant', 'plague']],
    [{ residents: 4, abandonedTick: 1 }, ['boards']],
  ] satisfies [Partial<House>, string[]][]) {
    const input = h.input(patch, true); h.art.ready(input); await h.load();
    assert.deepEqual(h.art.drawBody(h.context, input)?.layers, expected);
  }
});

test('condition, plague boards and snow are atomic and keep order zero/ten/twenty', async () => {
  const h = harness(); const input = h.input({ residents: 0, abandonedTick: 1 }, true, BALANCE.TICKS_PER_YEAR * 0.75 + 400);
  assert.equal(h.art.ready(input), false); assert.equal(h.images.length, 4);
  for (const image of h.images.slice(0, 3)) image.onload?.call(image, new Event('load'));
  await Promise.resolve(); assert.equal(h.art.drawBody(h.context, input), null);
  await h.load(); assert.deepEqual(h.art.drawBody(h.context, input)?.layers, ['vacant', 'plague', 'snow']);
});

test('authored condition family with a missing matching rule retains the whole legacy painting', () => {
  const h = harness({ ...bundle, rules: bundle.rules.filter(rule => rule.id !== 'neglected-rule') });
  assert.equal(h.art.select(h.input({ unmetRequirementTicks: 1200 })), null);
  assert.equal(h.art.ready(h.input({ unmetRequirementTicks: 1200 })), false);
  assert.equal(h.images.length, 0);
});

test('bodies without authored condition layers keep their existing selection', async () => {
  const h = harness({ ...bundle, entries: bundle.entries.filter(entry => entry.kind !== 'state-overlay' || entry.layer !== 'worn'),
    rules: bundle.rules.filter(rule => rule.slot !== 'house-condition') });
  const input = h.input({ unmetRequirementTicks: 1200 }); h.art.ready(input); await h.load();
  assert.deepEqual(h.art.drawBody(h.context, input)?.layers, []);
});

test('plague-specific missing rule cannot silently reuse ordinary boards', () => {
  const h = harness({ ...bundle, rules: bundle.rules.filter(rule => rule.id !== 'plague-rule') });
  assert.equal(h.art.select(h.input({ residents: 0, abandonedTick: 1 }, true)), null);
  assert.equal(h.images.length, 0);
});

test('spring melt retains its snow alpha beside the condition then removes only snow', async () => {
  const h = harness();
  const early = h.input({ builtLevel: 2 }, false, BALANCE.TICKS_PER_YEAR + 80);
  h.art.ready(early); await h.load();
  const drawn = h.art.drawBody(h.context, early); assert.ok(drawn);
  assert.deepEqual(drawn.layers, ['strained', 'snow']);
  assert.ok(drawn.layerAlpha.snow !== undefined && drawn.layerAlpha.snow > 0 && drawn.layerAlpha.snow < 1);
  const late = h.input({ builtLevel: 2 }, false, BALANCE.TICKS_PER_YEAR + 900);
  assert.deepEqual(h.art.drawBody(h.context, late)?.layers, ['strained']);
});

test('condition extensions do not take over burning or burnt houses', () => {
  const h = harness(); const input = h.input({ unmetRequirementTicks: 1200 });
  assert.equal(h.art.select(h.input({ burntTick: 1 })), null);
  assert.equal(h.art.select({ ...input, state: { ...input.state, events: { records: [], burning: [
    { buildingId: home.id, eventId: 'fire', ignitedTick: 0, outTick: input.state.tick + 1, doused: false },
  ] } } }), null);
});

test('new selectors validate scalar types instead of accepting arbitrary engine fields', () => {
  assert.throws(() => createArtRegistry([{ ...bundle, rules: [...bundle.rules, {
    ...rule('plague', 'boarded', 'plagueVacant', 'true'), id: 'wrong-type', priority: 10,
  }] }]), /Wrong selector scalar type for plagueVacant/);
  assert.throws(() => createArtRegistry([{ ...bundle, rules: [...bundle.rules, {
    ...rule('strained', 'worn', 'houseCondition', false), id: 'wrong-condition', priority: 10,
  }] }]), /Wrong selector scalar type for houseCondition/);
});
