import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeSave } from '../src/save/saveCodec';
import type { GameState } from '../src/engine/engine.types';
import { activeMusterPetition, musterFieldAnchor, musterFieldProps, musterFieldSupport } from '../src/render/musterFieldPlacement';
import { MUSTER_FIELD_ART } from '../src/render/musterFieldArt';
const original = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v51/chapter-two-town.save.json'))).envelope.state as GameState;
function state(): GameState {
  const house = original.buildings.find(b => b.kind === 'house')!;
  return { ...original, tick: 152001, width: 64, height: 64, palisade: null, zones: [], constructionSites: [],
    tiles: Array.from({ length: 4096 }, (_, i) => ({ tx: i % 64, ty: Math.floor(i / 64), terrain: 'grass', hasRoad: false, buildingId: null })),
    buildings: [{ ...house, tx: 35, ty: 35 }], houses: original.houses.filter(h => h.buildingId === house.id),
    war: { messengerTick: 148000, answers: {}, instalments: [], favour: true, taxSeasonsLeft: 0, licenceSeasonsLeft: 0,
      conscripts: { men: 2, houseIds: [house.id, house.id], lostHouseIds: [], returnTick: 154000, returned: false } },
    politics: { ...original.politics!, petitions: [{ id: 'levy_response@152000', defId: 'levy_response', petitioner: 'crown', arrivedTick: 152000, response: 'accept', respondedTick: 152001 }] } };
}
test('only actual accepted levy with live nonzero conscripts has an active saved-tick window', () => {
  const s = state(); assert.ok(activeMusterPetition(s));
  for (const response of ['refuse', 'accept_with_price', 'expired'] as const) assert.equal(activeMusterPetition({ ...s, politics: { ...s.politics!, petitions: s.politics!.petitions.map(p => ({ ...p, response })) } }), null);
  for (const tick of [152000, 152251, 154000]) assert.equal(activeMusterPetition({ ...s, tick }), null);
  assert.ok(activeMusterPetition({ ...s, tick: 152250 }));
  assert.equal(activeMusterPetition({ ...s, war: { ...s.war!, conscripts: { ...s.war!.conscripts!, men: 0 } } }), null);
  assert.equal(activeMusterPetition({ ...s, war: { ...s.war!, conscripts: { ...s.war!.conscripts!, returned: true } } }), null);
  assert.equal(activeMusterPetition({ ...s, politics: { ...s.politics!, petitions: s.politics!.petitions.map(p => { const { respondedTick: _tick, ...rest } = p; return rest; }) } }), null);
});
test('anchor does not depend on occupancy or query history; missing saved source hides', () => {
  const s = state(), at = musterFieldAnchor(s, MUSTER_FIELD_ART.entry!)!; assert.ok(at);
  assert.deepEqual(musterFieldAnchor(structuredClone(s), MUSTER_FIELD_ART.entry!), at);
  assert.deepEqual(musterFieldAnchor({ ...s, buildings: [...s.buildings, { ...s.buildings[0]!, id: 'blocked', tx: at.tx, ty: at.ty }] }, MUSTER_FIELD_ART.entry!), at);
  assert.equal(musterFieldAnchor({ ...s, buildings: [] }, MUSTER_FIELD_ART.entry!), null);
});
test('full paint support includes nominal footprint; road/water/zones/forest invalidate instead of teleporting', () => {
  const s = state(), entry = MUSTER_FIELD_ART.entry!; const at = musterFieldAnchor(s, MUSTER_FIELD_ART.entry!)!;
  const cells = musterFieldSupport(entry, at.tx, at.ty); assert.ok(cells.length > 4);
  const index = cells[0]!.ty * s.width + cells[0]!.tx;
  for (const patch of [{ hasRoad: true }, { terrain: 'water' as const }, { terrain: 'forest' as const }, { buildingId: 'obstacle' }]) {
    const blocked = { ...s, tiles: s.tiles.map((t, i) => i === index ? { ...t, ...patch } : t) };
    assert.deepEqual(musterFieldProps(blocked, entry), []); if (!('terrain' in patch)) assert.deepEqual(musterFieldAnchor(blocked, entry), at);
  }
  const zone = { id: 'occupied-zone', kind: 'burgage' as const, strokes: [], membership: [index], createdOrdinal: 1 };
  assert.deepEqual(musterFieldAnchor({ ...s, zones: [zone] }, entry), at);
  assert.deepEqual(musterFieldProps({ ...s, zones: [zone] }, entry), []);
  assert.deepEqual(musterFieldProps(s, null), []);
  assert.deepEqual(musterFieldProps({ ...s, buildings: [] }, entry), []);
});
test('one source PNG remains byte identical; no derived winter or actor sheet', () => {
  const source = readFileSync('assets-inbox/wave17/candidates-20260926/assets/bld/muster_field-v1.png');
  const runtime = readFileSync('public/assets/wave17/bld/muster_field-v1.png');
  assert.deepEqual(runtime, source); assert.equal(createHash('sha256').update(runtime).digest('hex'), MUSTER_FIELD_ART.entry!.provenance.runtimeSha256);
});
test('drainage completion restores original water for anchor selection; reload and rewind agree', () => {
  const s = state(), entry = MUSTER_FIELD_ART.entry!;
  const originalWater = s.tiles.map((t, i) => i % s.width > 43 && Math.floor(i / s.width) > 43 ? { ...t, terrain: 'water' as const } : t);
  const wet = { ...s, tiles: originalWater, drainage: { works: [], drained: [] } };
  const drained = originalWater.flatMap((t, i) => t.terrain === 'water' ? [i] : []);
  const dry = { ...wet, tiles: originalWater.map(t => t.terrain === 'water' ? { ...t, terrain: 'grass' as const } : t), drainage: { works: [], drained } };
  const anchor = musterFieldAnchor(wet, entry);
  assert.deepEqual(musterFieldAnchor(dry, entry), anchor);
  assert.deepEqual(musterFieldAnchor(structuredClone(dry), entry), anchor);
  assert.deepEqual(musterFieldAnchor(wet, entry), anchor);
});
test('zero grass cannot create a placement; one removed source hides all', () => {
  const s = state(), entry = MUSTER_FIELD_ART.entry!, first = s.buildings[0]!;
  assert.deepEqual(musterFieldProps({ ...s, tiles: s.tiles.map(t => ({ ...t, terrain: 'water' })) }, entry), []);
  const two = { ...s, buildings: [...s.buildings, { ...first, id: 'second', tx: 36 }], war: { ...s.war!, conscripts: { ...s.war!.conscripts!, houseIds: [first.id, 'second'] } } };
  assert.ok(musterFieldAnchor(two, entry));
  assert.equal(musterFieldAnchor({ ...two, buildings: [first] }, entry), null);
});

test('winter never borrows this single warm-season ground painting', () => {
  const s = state();
  const winter = { ...s, tick: 155000, war: { ...s.war!, conscripts: { ...s.war!.conscripts!, returnTick: 160000 } }, politics: { ...s.politics!, petitions: s.politics!.petitions.map(p => ({ ...p, respondedTick: 155000 })) } };
  assert.equal(activeMusterPetition(winter), null);
  assert.deepEqual(musterFieldProps(winter, MUSTER_FIELD_ART.entry), []);
});
