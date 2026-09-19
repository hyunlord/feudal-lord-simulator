import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { stepProduction } from '../src/economy/production';

test('full output freezes work before cycle completion', () => {
  const quarry: Building = { id: 'q', kind: 'quarry', tx: 1, ty: 1, workers: 4, inventory: { stone_raw: 20 }, reserved: {}, stockReserved: {}, productionProgress: 7 };
  const result = stepProduction(quarry, BUILDING_CONFIG_BY_KIND.quarry);
  assert.equal(result.building.productionProgress, 7);
  assert.deepEqual(result.building.inventory, quarry.inventory);
});

import { productionOperation } from '../src/economy/production';
import { runProduction } from '../src/engine/tick';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { historicalFacilityAssetId } from '../src/render/historicalFacilityAssets';
import { millSailAngle } from '../src/render/animatedMill';
import { buildingProblemCause } from '../src/ui/problemCauseModel';

const mill: Building = { id: 'mill', kind: 'mill', tx: 1, ty: 1, workers: 2, inventory: { wheat: 4 }, reserved: {}, stockReserved: {}, productionProgress: 7 };
function grid(building: Building, road = true) {
  return { ...DEFAULT_GAME_STATE, width: 8, height: 8, buildings: [building], tiles: Array.from({ length: 64 }, (_, index) => ({ tx: index % 8, ty: Math.floor(index / 8), terrain: 'grass' as const, buildingId: null, hasRoad: road && Math.floor(index / 8) === 0 })) };
}

test('mill no-input, no-road and understaffed states freeze phase and inventory then resume', () => {
  for (const input of [grid({ ...mill, inventory: {} }), grid(mill, false), grid({ ...mill, workers: 1 })]) {
    const stopped = runProduction(input);
    assert.equal(stopped.buildings[0]?.productionProgress, 7);
    assert.deepEqual(stopped.buildings[0]?.inventory, input.buildings[0]?.inventory);
    assert.ok(buildingProblemCause(input, 'mill'));
  }
  const running = runProduction(grid(mill));
  const updated = running.buildings[0];
  assert.ok(updated);
  assert.notEqual(millSailAngle(updated), millSailAngle(mill));
  assert.equal(buildingProblemCause(grid(mill), 'mill'), null);
});

test('mill cycle wraps continuously while consuming two wheat and producing one bread', () => {
  const before = { ...mill, productionProgress: 29 };
  const result = stepProduction(before, BUILDING_CONFIG_BY_KIND.mill);
  assert.equal(result.building.productionProgress, 0);
  assert.deepEqual(result.building.inventory, { wheat: 2, bread: 1 });
  assert.equal(millSailAngle({ ...mill, productionProgress: 30 }), millSailAngle(result.building));
});

test('quarry art, production and diagnosis agree on road, staffing and full storage', () => {
  const quarry: Building = { ...mill, kind: 'quarry', workers: 4, inventory: {} };
  for (const input of [grid(quarry, false), grid({ ...quarry, workers: 0 }), grid({ ...quarry, inventory: { stone_raw: 20 } })]) {
    const building = input.buildings[0];
    assert.ok(building);
    assert.equal(historicalFacilityAssetId(building, input), 'quarry_idle');
    assert.equal(runProduction(input).buildings[0]?.productionProgress, 7);
    assert.ok(buildingProblemCause(input, 'mill'));
  }
  const working = grid(quarry);
  assert.equal(historicalFacilityAssetId(quarry, working), 'quarry_active');
  assert.equal(productionOperation(quarry, BUILDING_CONFIG_BY_KIND.quarry), 'working');
  assert.equal(runProduction(working).buildings[0]?.productionProgress, 8);
});
