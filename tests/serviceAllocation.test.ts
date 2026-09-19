import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building, BuildingKind } from '../src/content/buildingConfig';
import type { House } from '../src/population/population.types';
import { allocateHouseServices } from '../src/population/serviceAllocation';
function building(id: string, kind: BuildingKind, tx = 1): Building {
  return { id, kind, tx, ty: 1, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function house(buildingId: string): House {
  return { buildingId, level: 0, residents: 0, hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 };
}
test('community well serves empty startup home without workers or roads', () => {
  const result = allocateHouseServices({ houses: [house('home')], buildings: [building('home', 'house'), { ...building('well', 'well'), workers: 0 }] });
  assert.equal(result.houses.get('home')?.water.kind, 'served');
});
test('urban services require reachable roads and market workers', () => {
  const buildings = [building('home', 'house'), building('market', 'market'), building('church', 'church')];
  const disconnected = allocateHouseServices({ houses: [house('home')], buildings, roadService: () => false });
  assert.equal(disconnected.houses.get('home')?.church.kind, 'unreachable');
  assert.equal(disconnected.houses.get('home')?.market.kind, 'unreachable');
  const understaffed = allocateHouseServices({ houses: [house('home')], buildings: buildings.map(b => b.kind === 'market' ? {...b, workers: 2} : b), roadService: () => true });
  assert.equal(understaffed.houses.get('home')?.market.kind, 'understaffed');
  assert.equal(understaffed.houses.get('home')?.church.kind, 'served');
});
test('finite capacity reserves empty and merged lots with stable allocation and recovery', () => {
  const houses = Array.from({length: 12}, (_, i) => house(`home${String(i).padStart(2, '0')}`));
  const homes = houses.map(h => building(h.buildingId, 'house'));
  const merged = homes.map((b, i): Building => i === 0 ? {...b, houseLot: 'horizontal'} : b);
  const buildings = [...merged, building('well', 'well')];
  const result = allocateHouseServices({houses, buildings});
  assert.equal(result.providers.get('well')?.used, 12);
  assert.equal(result.houses.get('home11')?.water.kind, 'capacity');
  const reversed = allocateHouseServices({houses: [...houses].reverse().map(h => ({...h, residents: 20})), buildings: [...buildings].reverse()});
  assert.deepEqual([...result.houses], [...reversed.houses]);
  const recovered = allocateHouseServices({houses, buildings: [...buildings, building('well2', 'well')]});
  assert.equal(recovered.houses.get('home11')?.water.kind, 'served');
});

for (const merged of [false, true]) test(`exclusive ${merged ? 'merged' : 'single'} homes retain coverage when earlier neighbours have two wells`, () => {
  const flexible = Array.from({length: 12}, (_, i) => ({...building(`h${String(i).padStart(2, '0')}`, 'house', i < 10 ? 6 + i % 2 : 5), ty: i < 10 ? 3 + Math.floor(i / 2) : i === 10 ? 4 : 6}));
  const exclusive: Building = {...building('h12', 'house', 0), ty: 5, ...(merged ? {houseLot: 'vertical' as const} : {})};
  const buildings = [...flexible, exclusive, {...building('a', 'well', 5), ty: 5}, {...building('b', 'well', 10), ty: 5}];
  const houses = [...flexible, exclusive].map(b => house(b.id));
  const result = allocateHouseServices({houses, buildings});
  assert.ok([...result.houses.values()].every(h => h.water.kind === 'served'));
  assert.equal(result.houses.get('h12')?.water.providerId, 'a');
  assert.equal(result.houses.get('h12')?.water.demand, merged ? 2 : 1);
  assert.deepEqual([...result.houses], [...allocateHouseServices({houses: [...houses].reverse().map(h => ({...h, residents: 16})), buildings: [...buildings].reverse()}).houses]);
});
