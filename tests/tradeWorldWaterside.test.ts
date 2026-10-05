import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
import { tradeWorldGroundProps } from '../src/render/tradeWorldGround';

// Sparse synthetic selection fixture, never evidence of natural household evolution.
function waterside(tradeId: 'dyer' | 'fuller', winter = false): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v47/chapter-four-town.save.json'))).envelope.state as GameState;
  const house = state.houses[0];
  const building = state.buildings.find(item => item.id === house?.buildingId);
  assert.ok(house && building);
  const owner = { ...building, tx: 10, ty: 10 };
  const { abandonedTick: _abandoned, burntTick: _burnt, ...occupied } = house;
  const { persons: _persons, ...withoutPersons } = state;
  return { ...withoutPersons, agency: initialAgency(), tick: winter ? 3500 : 1500,
    buildings: [owner], houses: [{ ...occupied, residents: 4 }], walkers: [], palisade: null,
    constructionSites: [], forestHarvests: [], zones: [],
    tiles: state.tiles.map(tile => ({ ...tile, terrain: tile.ty === 7 ? 'water' : 'grass',
      buildingId: tile.tx === 10 && tile.ty === 10 ? owner.id : null, hasRoad: tile.tx === 10 && tile.ty === 11 })),
    trades: { households: [{ houseId: owner.id, tradeId, workshop: tradeId === 'dyer' ? 'waterside' : 'water_mill',
      sinceTick: 0, productivityPermille: 1000, idleSeasons: 0, receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
      streets: [], stock: {}, chains: {}, haulage: { season: 0, last: 0 }, quits: [] },
  };
}
const selected = (state: GameState) => tradeWorldGroundProps(state).filter(prop => prop.assetId.startsWith('yard_waterside_'));
for (const trade of ['dyer', 'fuller'] as const) for (const winter of [false, true]) {
  test(`waterside ${trade} ${winter ? 'winter' : 'summer'} selects its authored hand-work yard with real water`, () => {
    const state = waterside(trade, winter), props = selected(state);
    assert.equal(props.length, 1);
    assert.equal(props[0]?.assetId, `yard_waterside_workshop_${trade === 'dyer' ? 'a' : 'b'}_${winter ? 'winter' : 'summer'}`);
    assert.equal(tradeWorldGroundProps(state).some(prop => prop.assetId.includes('water_power') || prop.assetId.startsWith('front_fuller')), false);
  });
}
test('dry ground and a solid building strip do not provide waterside access', () => {
  const state = waterside('dyer');
  assert.equal(selected({ ...state, tiles: state.tiles.map(tile => ({ ...tile, terrain: 'grass' })) }).length, 0);
  assert.equal(selected({ ...state, tiles: state.tiles.map(tile => tile.ty === 8 ? { ...tile, buildingId: 'blocking-building' } : tile) }).length, 0);
});
test('a completed wall between the work ground and water blocks access', () => {
  const state = waterside('dyer');
  const fixture = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v47/chapter-four-town.save.json'))).envelope.state as GameState;
  assert.ok(fixture.palisade);
  const wall = { ...fixture.palisade, gate: { x: 40, y: 8 }, additionalGates: [], segments: [{
    id: 'blocked-bank', order: 0, tileCount: 30, completed: true, constructionSiteId: null,
    edgePath: [{ x: 0, y: 8 }, { x: 30, y: 8 }],
  }] };
  assert.equal(selected({ ...state, palisade: wall }).length, 0);
});
test('well footprints and conservative one-cell service margins remain clear', () => {
  const state = waterside('dyer'), owner = state.buildings[0];
  assert.ok(owner);
  const wells = [7, 9, 11, 13].map(tx => ({ ...owner, id: `well-${tx}`, kind: 'well' as const, tx, ty: 8 }));
  assert.equal(selected({ ...state, buildings: [...state.buildings, ...wells] }).length, 0);
});
test('building construction strips also block water access before a building is finished', () => {
  const state = waterside('dyer');
  const sites = Array.from({ length: 7 }, (_, index) => ({
    id: `site-${index}`, kind: 'house' as const, tx: 7 + index, ty: 8,
    required: {}, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 240,
    assignedBuilders: 0, stall: 'no_builders' as const, startedTick: 0,
  }));
  assert.equal(selected({ ...state, constructionSites: sites }).length, 0);
});
