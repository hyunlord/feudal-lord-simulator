import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSaveFile } from '../scripts/loadSaveFile';
import { buildGroundBoundaryScene } from '../src/render/groundBoundaryScene';
import { collapsedFenceBindings } from '../src/render/collapsedFenceBinding';

const state = loadSaveFile('tests/fixtures/distributor-entry-seed5.json.gz');
const scene = buildGroundBoundaryScene(state);
const prepared = { ...state, houses: state.houses.map(house => house.residents === 0
  ? { ...house, abandonedTick: state.tick } : house) };

test('only a recorded abandoned house replaces one owned +x straight panel', () => {
  assert.deepEqual(collapsedFenceBindings(state, scene), []);
  const bindings = collapsedFenceBindings(prepared, scene);
  assert.equal(bindings.length, 2);
  assert.deepEqual(bindings.map(binding => [binding.tx, binding.ty]), [[44.5, 11.75], [45.5, 11.75]]);
  assert.equal(new Set(bindings.map(binding => binding.buildingId)).size, bindings.length);
  for (const binding of bindings) {
    const source = scene.yardProps.hurdles.find(piece => piece.id === binding.panelId);
    assert.equal(source?.kind, 'straight');
    assert.equal(source?.mirror, true);
    assert.equal(source?.buildingId, binding.buildingId);
  }
});

test('occupied, new empty, future abandoned and burnt houses keep their original panels', () => {
  for (const overrides of [{ residents: 1 }, { abandonedTick: state.tick + 1 }, { burntTick: 0 }]) {
    assert.deepEqual(collapsedFenceBindings({ ...prepared,
      houses: prepared.houses.map(house => ({ ...house, ...overrides })) }, scene), []);
  }
});

test('gates, corners, partial panels and the other axis are never substituted', () => {
  for (const kind of ['gate', 'short_gate', 'corner', 'half', 'quarter', 'three_quarter'] as const) {
    assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, yardProps: { ...scene.yardProps,
      hurdles: scene.yardProps.hurdles.map(piece => ({ ...piece, kind })) } }), []);
  }
  assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, yardProps: { ...scene.yardProps,
    hurdles: scene.yardProps.hurdles.map(piece => ({ ...piece, mirror: false })) } }), []);
});

test('ownership, frontage and any apron exclusion are mandatory', () => {
  assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, grounds: { ...scene.grounds,
    yards: scene.grounds.yards.map(yard => ({ ...yard, subcells: [] })) } }), []);
  const apron = scene.grounds.aprons[0];
  assert.ok(apron);
  const polygon = [{ x: 43, y: 11 }, { x: 47, y: 11 }, { x: 47, y: 13 }, { x: 43, y: 13 }];
  assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, grounds: { ...scene.grounds,
    aprons: [...scene.grounds.aprons, { ...apron, buildingId: 'other-owner', polygon }] } }), []);
});

test('selection is independent of hurdle order and rejects frontage or missing ownership', () => {
  const reversed = { ...scene, yardProps: { ...scene.yardProps, hurdles: [...scene.yardProps.hurdles].reverse() } };
  assert.deepEqual(collapsedFenceBindings(prepared, reversed), collapsedFenceBindings(prepared, scene));
  const apron = scene.grounds.aprons[0];
  assert.ok(apron);
  const aprons = prepared.houses.filter(house => house.residents === 0).map(house => ({ ...apron,
    buildingId: house.buildingId, normal: { x: 0, y: 1 } }));
  assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, grounds: { ...scene.grounds, aprons } }), []);
  assert.deepEqual(collapsedFenceBindings(prepared, { ...scene, grounds: { ...scene.grounds, yards: [] } }), []);
});
