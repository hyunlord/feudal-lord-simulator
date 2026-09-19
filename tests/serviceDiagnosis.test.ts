import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import type { House } from '../src/population/population.types';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { houseDiagnosisModel } from '../src/ui/houseDiagnosisModel';
import { buildingInspectorModel } from '../src/render/buildingInspectorModel';

function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function fixture() {
  const homes = Array.from({ length: 13 }, (_, index) => building(`home-${String(index).padStart(2, '0')}`, 'house', 2 + index % 4, 2 + Math.floor(index / 4)));
  const houses: House[] = homes.map(home => ({ buildingId: home.id, level: 2, residents: 8, hasWater: true, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0 }));
  return { ...DEFAULT_GAME_STATE, palisade: null, buildings: [...homes, building('well', 'well', 6, 4)], houses };
}

test('house diagnostics do not claim water from distance or stale hasWater when the well is full', () => {
  const state = fixture();
  const diagnoses = state.houses.map(house => houseDiagnosisModel(state, house.buildingId));
  assert.equal(diagnoses.filter(model => model?.water.kind === 'supplied').length, 12);
  assert.equal(diagnoses.filter(model => model?.water.kind === 'capacity').length, 1);
  assert.match(diagnoses.at(-1)?.water.label ?? '', /수용량/);
});

test('facility inspector exposes actual used capacity and merged-lot units', () => {
  const model = buildingInspectorModel(fixture(), 'well');
  assert.ok(model);
  assert.match(model.rows.join(' '), /12\/12.*필지/);
  assert.match(model.rows.join(' '), /합필.*2/);
});

test('adding another well resolves the same household capacity diagnosis', () => {
  const state = fixture();
  state.buildings.push(building('well-2', 'well', 7, 4));
  assert.equal(state.houses.every(house => houseDiagnosisModel(state, house.buildingId)?.water.kind === 'supplied'), true);
});
