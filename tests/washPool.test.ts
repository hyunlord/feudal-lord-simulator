import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import { washPoolProps, washPoolSupport } from '../src/render/washPoolPlacement';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import type { FacilityGroundPropEntry } from '../src/render/art/artContract';
const state = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/pasture-wash/seed5.json.gz', import.meta.url))).toString()) as GameState;
const entry = ART_REGISTRY.entry('pasture_wash_pool') as FacilityGroundPropEntry;
test('full-canvas support keeps all sixteen inverse-projected cells', () => {
  const cells = washPoolSupport(entry, 10, 10);
  assert.equal(cells.length, 16);
  assert.deepEqual(cells[0], { tx: 8, ty: 8 });
  assert.deepEqual(cells.at(-1), { tx: 11, ty: 11 });
});
test('completed normal-command farm has a safe deterministic non-economic pool', () => {
  const before = JSON.stringify(state);
  const props = washPoolProps(state, entry);
  assert.equal(props.length, 1);
  assert.deepEqual(washPoolProps(structuredClone(state), entry), props);
  assert.equal(JSON.stringify(state), before);
  assert.equal(new Set(props.map(p => p.farmId)).size, props.length);
});
test('missing image and removed farms never leave a stale pool', () => {
  assert.deepEqual(washPoolProps(state, null), []);
  assert.deepEqual(washPoolProps({ ...state, buildings: state.buildings.filter(b => b.kind !== 'pastoral_farm') }, entry), []);
  assert.deepEqual(washPoolProps({ ...state, zones: [] }, entry), []);
});

test('winter has no invented seasonal image and spring restores stable placement', () => {
  const year = Math.floor(state.tick / 4000) * 4000;
  assert.deepEqual(washPoolProps({ ...state, tick: year + 3500 }, entry), []);
  assert.equal(washPoolProps({ ...state, tick: year + 100 }, entry).length, 1);
  assert.deepEqual(washPoolProps(state, { ...entry, buildingKinds: ['church'] }), []);
});
test('all roads or water across pasture eliminate every candidate without changing other props', () => {
  for (const patch of [{ hasRoad: true }, { terrain: 'water' as const }]) {
    const changed = { ...state, tiles: state.tiles.map(t => ({ ...t, ...patch })) };
    assert.deepEqual(washPoolProps(changed, entry), []);
  }
});

test('selected pool canvas overlaps none of the existing reserved pictures', async () => {
  const { washPoolReservations } = await import('../src/render/washPoolReservations');
  const { washPoolBox } = await import('../src/render/washPoolPlacement');
  const { boxesOverlap } = await import('../src/render/tradeWorldPlacement');
  for (const prop of washPoolProps(state, entry)) {
    assert.equal(washPoolReservations(state).some(r => boxesOverlap(washPoolBox(entry, prop.tx, prop.ty), r)), false);
    for (const p of washPoolSupport(entry, prop.tx, prop.ty)) {
      const tile = state.tiles[p.ty * state.width + p.tx];
      assert.equal(tile?.terrain, 'grass'); assert.equal(tile.hasRoad, false); assert.equal(tile.buildingId, null);
    }
  }
});
test('a new occupied support cell invalidates the old anchor', () => {
  const pool = washPoolProps(state, entry)[0]; assert.ok(pool);
  const cell = washPoolSupport(entry, pool.tx, pool.ty)[0]; assert.ok(cell);
  const index = cell.ty * state.width + cell.tx;
  const changed = { ...state, tiles: state.tiles.map((tile, i) => i === index ? { ...tile, buildingId: 'new-site' } : tile) };
  assert.equal(washPoolProps(changed, entry).some(p => p.tx === pool.tx && p.ty === pool.ty), false);
  assert.deepEqual(washPoolProps(state, entry), [pool]);
});
test('no tended pasture means no farm decoration', () => {
  const changed = { ...state, buildings: state.buildings.map(b => b.kind === 'pastoral_farm' ? { ...b, tx: 63, ty: 63 } : b) };
  assert.deepEqual(washPoolProps(changed, entry), []);
});
