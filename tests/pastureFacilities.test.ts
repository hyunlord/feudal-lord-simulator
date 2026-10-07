import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import type { FacilityGroundPropEntry } from '../src/render/art/artContract';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { facilityGroundProps, washPoolProps, washPoolBox } from '../src/render/washPoolPlacement';
import { washPoolReservations } from '../src/render/washPoolReservations';
import { boxesOverlap } from '../src/render/tradeWorldPlacement';
const state = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/pasture-wash/seed5.json.gz', import.meta.url))).toString()) as GameState;
const pool = ART_REGISTRY.entry('pasture_wash_pool') as FacilityGroundPropEntry;
const fold: FacilityGroundPropEntry = { ...pool, id: 'test-fold', pastureYard: { group: 'yard', priority: 0 } };
const pen: FacilityGroundPropEntry = { ...fold, id: 'test-pen', pastureYard: { group: 'yard', priority: 1, positiveStock: 'fleece' } };
const entries = [pool, fold, pen];
test('pool positions stay exact when pasture yards share the allocation pass', () => {
  const before = JSON.stringify(state);
  const props = facilityGroundProps(state, entries);
  assert.deepEqual(props.filter(p => p.assetId === pool.id), washPoolProps(state, pool));
  assert.deepEqual(facilityGroundProps(structuredClone(state), entries), props);
  assert.equal(JSON.stringify(state), before);
});
test('positive stock selects the pen; no stock selects one empty fold per farm', () => {
  for (const fleece of [0, 1]) {
    const changed = { ...state, buildings: state.buildings.map(b => ({ ...b, inventory: { ...b.inventory, fleece } })) };
    const props = facilityGroundProps(changed, [fold, pen]);
    assert.ok(props.length > 0);
    assert.ok(props.every(p => p.assetId === (fleece ? pen.id : fold.id)));
    assert.equal(new Set(props.map(p => p.farmId)).size, props.length);
  }
});
test('yard remains in winter while water pools retain their winter exclusion', () => {
  const winter = { ...state, tick: Math.floor(state.tick / 4000) * 4000 + 3500 };
  assert.ok(facilityGroundProps(winter, [fold]).length > 0);
  assert.deepEqual(facilityGroundProps(winter, [pool]), []);
});
test('facility pictures reserve one another and all existing farm pictures', () => {
  const props = facilityGroundProps(state, entries), boxes = [...washPoolReservations(state)];
  for (const prop of props) {
    const entry = entries.find(e => e.id === prop.assetId); assert.ok(entry);
    const box = washPoolBox(entry, prop.tx, prop.ty);
    assert.equal(boxes.some(other => boxesOverlap(box, other)), false);
    boxes.push(box);
  }
});
test('missing descriptors, absent pasture and incompatible farms stay empty', () => {
  assert.deepEqual(facilityGroundProps(state, []), []);
  assert.deepEqual(facilityGroundProps({ ...state, zones: [] }, [fold]), []);
  assert.deepEqual(facilityGroundProps(state, [{ ...fold, buildingKinds: ['church'] }]), []);
});
test('dry pasture supports the yard without inventing a wash pool', () => {
  const dry = { ...state, tiles: state.tiles.map(tile => tile.terrain === 'water' ? { ...tile, terrain: 'grass' as const } : tile) };
  assert.deepEqual(facilityGroundProps(dry, [pool]), []);
  assert.ok(facilityGroundProps(dry, [fold]).length > 0);
});
test('legacy pool keeps its published anchor and identity', () => {
  assert.deepEqual(washPoolProps(state, pool), [{ id: 'wash-pool:construction-site-000108', assetId: 'pasture_wash_pool', farmId: 'construction-site-000108', tx: 8, ty: 38 }]);
});
