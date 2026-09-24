import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { createConstructionSite } from '../src/economy/construction';
import { allocateBuildingAndConstructionLabour, allocateBuildingLabour } from '../src/population/labour';
import { stepProduction } from '../src/economy/production';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { assertGameStateSnapshot, decodeSave, encodeSave } from '../src/save/saveCodec';

const building = (id: string, kind: Building['kind']): Building => ({ id, kind, tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });

test('R-T5 duplicate farms cannot starve ready construction or the core timber chain', () => {
  const buildings = [building('f1', 'wheat_farm'), building('m1', 'mill'), building('g1', 'granary'), building('log', 'logging_camp'), building('saw', 'sawmill'), building('f2', 'wheat_farm'), building('f3', 'wheat_farm')];
  const site = createConstructionSite({ ordinal: 1, kind: 'house', tx: 0, ty: 0, startedTick: 0 });
  const result = allocateBuildingAndConstructionLabour(buildings, [{ ...site, delivered: site.required }], 32);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 3);
  assert.deepEqual(result.buildings.map(b => b.workers), [4, 2, 2, 3, 2, 0, 0]);
});

test('R-T6 pause releases workers and freezes production, persists through save, and resume restores work', () => {
  const first = building('farm-a', 'wheat_farm');
  const second = building('farm-b', 'wheat_farm');
  const initial = { ...DEFAULT_GAME_STATE, buildings: [first, second], population: 8 };
  const paused = gameReducer(initial, { type: 'set_building_operation', buildingId: first.id, paused: true });
  const assigned = allocateBuildingLabour(paused.buildings, paused.population);
  assert.deepEqual(assigned.buildings.map(b => b.workers), [0, 4]);
  assert.equal(paused.buildings[0]?.operationPaused, true);
  const stopped = assigned.buildings[0];
  assert.ok(stopped);
  assert.equal(stepProduction({ ...stopped, workers: 4 }, BUILDING_CONFIG_BY_KIND.wheat_farm).produced, null);
  assert.equal(stepProduction({ ...stopped, workers: 4 }, BUILDING_CONFIG_BY_KIND.wheat_farm).building.productionProgress, 0);
  const loaded = decodeSave(encodeSave({ state: paused, createdAt: '2026-09-24T00:00:00.000Z', savedAt: '2026-09-24T00:00:00.000Z', gameVersion: 'test' }).bytes).envelope.state;
  assert.equal(loaded.buildings[0]?.operationPaused, true);
  const resumed = gameReducer(loaded, { type: 'set_building_operation', buildingId: first.id, paused: false });
  assert.deepEqual(allocateBuildingLabour(resumed.buildings, resumed.population).buildings.map(b => b.workers), [4, 0]);
});


test('save boundary rejects a nonboolean building pause value', () => {
  for (const operationPaused of ['true', 1, null, {}]) {
    assert.throws(() => assertGameStateSnapshot({ ...DEFAULT_GAME_STATE, buildings: [{ ...building('farm', 'wheat_farm'), operationPaused }] }), /operationPaused must be a boolean/);
  }
});
