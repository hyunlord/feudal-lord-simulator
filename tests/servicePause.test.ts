import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import type { House } from '../src/population/population.types';
import { allocateHouseServices } from '../src/population/serviceAllocation';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { houseDiagnosisModel } from '../src/ui/houseDiagnosisModel';
import { serviceDiagnosis } from '../src/ui/serviceDiagnosisModel';

const home: Building = { id: 'house', kind: 'house', tx: 4, ty: 4, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
const house: House = { buildingId: home.id, level: 1, residents: 8, hasWater: true, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 };
for (const [service, kind] of [['water', 'well'], ['market', 'market'], ['church', 'church']] as const) {
  test(`R-T7: paused ${kind} stops ${service} with a visible pause cause`, () => {
    const provider = { ...home, id: 'provider', kind, workers: 3, operationPaused: true };
    const state = { ...DEFAULT_GAME_STATE, houses: [house], buildings: [home, provider] };
    const allocation = allocateHouseServices({ ...state, roadService: () => true });
    assert.equal(allocation.houses.get(home.id)?.[service].kind, 'paused');
    assert.equal(allocation.providers.get(provider.id)?.used, 0);
    assert.equal(serviceDiagnosis(state, home, service).label, '시설 가동 중지');
    assert.equal(houseDiagnosisModel(state, home.id)?.[service].kind, 'paused');
  });
  test(`an active ${kind} can replace paused provider without a false pause diagnosis`, () => {
    const paused = { ...home, id: 'a', kind, workers: 3, operationPaused: true };
    const active = { ...paused, id: 'b', operationPaused: false };
    const allocation = allocateHouseServices({ houses: [house], buildings: [home, paused, active], roadService: () => true });
    assert.equal(allocation.houses.get(home.id)?.[service].providerId, 'b');
  });
}

test('legacy market access also rejects a staffed but paused market', async () => {
  const { marketAccessDiagnosis } = await import('../src/population/marketAccess');
  const market = { ...home, id: 'market', kind: 'market' as const, workers: 3, operationPaused: true };
  assert.equal(marketAccessDiagnosis(home, [home, market], () => true).kind, 'paused');
});
