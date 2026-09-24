import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import type { House } from '../src/population/population.types';
import { allocateHouseServices } from '../src/population/serviceAllocation';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { serviceDiagnosis } from '../src/ui/serviceDiagnosisModel';

function building(id: string, kind: Building['kind'] = 'house', tx = 10): Building {
  return { id, kind, tx, ty: 10, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function house(buildingId: string): House {
  return { buildingId, level: 1, residents: 8, hasWater: true, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 };
}

for (const [service, kind, capacity] of [['water', 'well', 12], ['market', 'market', 24], ['church', 'church', 32]] as const) {
  test(`R-T1: opening homes retain ${service} when a construction home completes`, () => {
    const homes = Array.from({ length: capacity }, (_, i) => building(`house-${i}-0-0`));
    const newcomer = building('construction-site-000042');
    const result = allocateHouseServices({ houses: [...homes, newcomer].map(b => house(b.id)), buildings: [...homes, newcomer, building('provider', kind)], roadService: () => true });
    assert.equal(result.houses.get(newcomer.id)?.[service].kind, 'capacity');
    assert.ok(homes.every(home => result.houses.get(home.id)?.[service].kind === 'served'));
  });
}

test('R-T2: construction ordinal wins regardless of entry into radius or input order', () => {
  const initial = Array.from({ length: 11 }, (_, i) => building(`house-${i}-0-0`));
  const earlier = building('construction-site-9', 'house', 30);
  const later = building('construction-site-10');
  const well = building('well', 'well');
  const before = allocateHouseServices({ houses: [...initial, earlier, later].map(b => house(b.id)), buildings: [...initial, earlier, later, well] });
  assert.equal(before.houses.get(later.id)?.water.kind, 'served');
  const buildings = [...initial, { ...earlier, tx: 10 }, later, well];
  const houses = buildings.filter(b => b.kind === 'house').map(b => house(b.id));
  const after = allocateHouseServices({ houses, buildings });
  assert.equal(after.houses.get(earlier.id)?.water.kind, 'served');
  assert.equal(after.houses.get(later.id)?.water.kind, 'capacity');
  assert.deepEqual(after, allocateHouseServices({ houses: [...houses].reverse(), buildings: [...buildings].reverse() }));
});

test('capacity explanation counts older occupied homes and keeps the water cause', () => {
  const homes = Array.from({ length: 12 }, (_, i) => building(`house-${i}-0-0`));
  const newcomer = building('construction-site-000042');
  const state = { ...DEFAULT_GAME_STATE, buildings: [...homes, newcomer, building('well', 'well')], houses: [...homes, newcomer].map(b => house(b.id)) };
  assert.equal(serviceDiagnosis(state, newcomer, 'water').label, '우물 수용량 부족 · 먼저 지어진 집 12채가 사용 중');
});

test('older flexible home moves to a spare well without losing service to the later exclusive home', () => {
  const older = Array.from({ length: 12 }, (_, i) => building(`house-${String(i).padStart(2, '0')}-0-0`, 'house', 6));
  const newer = building('construction-site-000100', 'house', 0);
  const buildings = [...older, newer, building('a', 'well', 5), building('b', 'well', 10)];
  const result = allocateHouseServices({ houses: [...older, newer].map(b => house(b.id)), buildings });
  assert.equal(result.houses.get(newer.id)?.water.providerId, 'a');
  assert.ok(older.every(home => result.houses.get(home.id)?.water.kind === 'served'));
  assert.equal(result.providers.get('a')?.used, 12);
  assert.equal(result.providers.get('b')?.used, 1);
});
