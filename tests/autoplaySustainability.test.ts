import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateBuildingLabour } from '../src/population/labour';
import { stepProduction } from '../src/economy/production';
import { buildingHasRequiredRoadAccess } from '../src/engine/roadAccess';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { foodAction } from '../src/engine/autoplayFood';
import { decideNextAction } from '../src/engine/autoplay';
import { roadActionToTargets, plannedBuildingRoadAction } from '../src/engine/autoplayConstructionRoads';
import { preserveRoadExpansion } from '../src/engine/autoplayExpansion';
import { createPalisadeConstructionSite } from '../src/economy/construction';
import { gameReducer } from '../src/state/gameStore';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { buildingRoadAccessTiles, resolveBuildingRoute, resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';

test('Given starting timber and an existing logging camp When autoplay chooses development Then it secures renewable timber before expansion', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.houses = state.houses.map(house => ({ ...house, hasWater: true }));
  const action = decideNextAction(state);
  assert.equal(action.kind === 'place_building' && action.building, 'sawmill');
});


test('Given the last open road frontage When a building would seal it Then the advisor extends the road first', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.width = 7;
  state.height = 7;
  state.buildings = [];
  state.constructionSites = [];
  state.palisade = null;
  state.tiles = Array.from({ length: 49 }, (_, index) => {
    const tx = index % 7;
    const ty = Math.floor(index / 7);
    return { tx, ty, terrain: 'grass' as const, hasRoad: tx === 3 && ty === 3, buildingId: (tx === 2 && ty === 3) || (tx === 4 && ty === 3) || (tx === 3 && ty === 4) ? 'occupied' : null };
  });
  const action = preserveRoadExpansion(state, { kind: 'house', tx: 3, ty: 2 });
  assert.deepEqual(action, { kind: 'place_road', from: { tx: 3, ty: 2 }, to: { tx: 3, ty: 0 } });
});

test('Given multiple unmet era requirements When population is ready Then a missing civic building is not postponed until timber is full', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.houses = [];
  state.population = 60;
  state.treasuryTimber = 200;
  const action = decideNextAction(state);
  assert.equal(action.kind === 'place_building' && action.building, 'chapel');
});

test('Given nearly full building-material storage When the era needs more than its capacity Then the advisor builds another store', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.houses = [];
  state.population = 60;
  state.treasuryTimber = 0;
  state.buildings = state.buildings.map(building => building.kind === 'storehouse' ? { ...building, inventory: { timber: 150 } } : building);
  const action = decideNextAction(state);
  assert.equal(action.kind === 'place_building' && action.building, 'storehouse');
});

test('Given a newly completed empty home without water When autoplay decides Then it provides a well so immigration can begin', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.buildings = state.buildings.filter(building => building.kind !== 'well');
  state.tiles = state.tiles.map(tile => tile.buildingId?.startsWith('well-') ? { ...tile, buildingId: null } : tile);
  state.houses = state.houses.map(house => ({ ...house, residents: 0 }));
  state.population = 0;
  const action = decideNextAction(state);
  assert.equal(action.kind === 'place_building' && action.building, 'well');
});


for (const era of ['hamlet', 'stone_town'] as const) for (const stall of ['no_route', 'no_material_source'] as const) test(`Given a ${era} wall workfront with ${stall} When the advisor connects it Then timber has a real source-to-site route`, () => {
  let state = structuredClone(DEFAULT_GAME_STATE);
  const site = { ...createPalisadeConstructionSite({ id: 'test-wall', wallId: 'test', segmentIndex: 0, gateDistance: 0, order: 0, path: [{ x: 47, y: 34 }, { x: 48, y: 34 }], startedTick: 0 }), stall };
  state.constructionSites = [site];
  state.era = era;
  for (let step = 0; step < 20; step += 1) {
    const action = autoplayActionToGameAction(decideNextAction(state), state);
    if (action === null) break;
    state = gameReducer(state, action);
  }
  const source = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(source);
  assert.notEqual(resolveBuildingToConstructionSiteRoute(state, source, site).path, null);
});

for (const scenario of ['no_port', 'unrepairable_first', 'disconnected_port']) test(`Given a completed wall causes ${scenario} When another frontage needs a turning road Then the advisor reconnects it to storage`, () => {
  const blockedFirst = scenario === 'unrepairable_first';
  let state = structuredClone(DEFAULT_GAME_STATE);
  const store = { ...state.buildings[0]!, id: 'source', kind: 'storehouse' as const, tx: 1, ty: 1, workers: 0, inventory: { timber: 100 } };
  const farm = { ...store, id: 'farm', kind: 'wheat_farm' as const, tx: 5, ty: 1, inventory: {} };
  state = { ...state, width: 10, height: 8, era: 'stone_town', buildings: [store, farm], houses: [], walkers: [], constructionSites: [],
    tiles: Array.from({ length: 80 }, (_, i) => {
      const tx = i % 10, ty = Math.floor(i / 10);
      const building = [store, farm].find(b => tx >= b.tx && tx < b.tx + 2 && ty >= b.ty && ty < b.ty + 2);
      return { tx, ty, terrain: 'grass' as const, hasRoad: ty === 1 && (tx === 3 || tx === 4), buildingId: building?.id ?? null };
    }),
    palisade: { id: 'wall', gate: { x: 5, y: 5 }, polygon: [], segments: [{ id: 'wall-0', order: 0, edgePath: [{ x: 5, y: 0 }, { x: 5, y: 7 }], tileCount: 7, completed: true, constructionSiteId: null, material: 'timber' }] },
  };
  if (blockedFirst) {
    const isolated = { ...farm, id: 'isolated', tx: 8, ty: 0 };
    state.buildings.push(isolated);
    state.tiles = state.tiles.map(tile => {
      if (tile.tx >= 8 && tile.ty < 2) return { ...tile, buildingId: isolated.id, hasRoad: false };
      if ((tile.tx === 7 && tile.ty < 2) || (tile.tx >= 8 && tile.ty === 2)) return { ...tile, terrain: 'water', hasRoad: false };
      return tile;
    });
  }
  if (scenario === 'disconnected_port') state.tiles = state.tiles.map(tile => tile.tx === 7 && tile.ty === 2 ? { ...tile, hasRoad: true } : tile);
  assert.equal(buildingRoadAccessTiles(state, farm).length, scenario === 'disconnected_port' ? 1 : 0);
  assert.equal(resolveBuildingRoute(state, store, farm).path, null);
  for (let step = 0; step < 12; step += 1) {
    if (resolveBuildingRoute(state, store, farm).path !== null) break;
    const recommendation = decideNextAction(state);
    assert.equal(recommendation.kind, 'place_road');
    const action = autoplayActionToGameAction(recommendation, state);
    assert.ok(action);
    state = gameReducer(state, action);
  }
  assert.notEqual(resolveBuildingRoute(state, store, farm).path, null);
  const labour = allocateBuildingLabour(state.buildings, 40, building => buildingHasRequiredRoadAccess(state, building));
  const staffedFarm = labour.buildings.find(building => building.id === farm.id);
  assert.equal(staffedFarm?.workers, 4);
  assert.ok(staffedFarm);
  assert.ok(stepProduction(staffedFarm, BUILDING_CONFIG_BY_KIND.wheat_farm).building.productionProgress > 0);
});

test('Given a new road joins an existing disconnected stretch When BFS returns its first segment Then it excludes occupied road tiles and actually places', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.width = 5; state.height = 5; state.buildings = []; state.constructionSites = []; state.palisade = null;
  state.tiles = Array.from({ length: 25 }, (_, i) => {
    const tx = i % 5, ty = Math.floor(i / 5);
    return { tx, ty, terrain: 'grass' as const, buildingId: null, hasRoad: (ty === 0 && [0, 2, 3].includes(tx)) || (tx === 3 && ty === 1) };
  });
  const recommendation = roadActionToTargets(state, [{ tx: 3, ty: 1 }], [{ tx: 0, ty: 0 }]);
  assert.deepEqual(recommendation, { kind: 'place_road', from: { tx: 1, ty: 0 }, to: { tx: 1, ty: 0 } });
  const action = autoplayActionToGameAction(recommendation, state);
  assert.ok(action);
  const after = gameReducer(state, action);
  assert.notEqual(after, state);
  assert.equal(after.tiles.find(tile => tile.tx === 1 && tile.ty === 0)?.hasRoad, true);
});


test('Given eight well stocked L3 homes When two mills have no hauling headroom Then the advisor adds one mill without multiplying farms and granaries', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.idleWorkers = 0;
  state.houses = Array.from({ length: 8 }, (_, index) => ({ ...state.houses[0]!, buildingId: `home-${index}`, level: 3, residents: 22, breadStock: 9 }));
  const template = state.buildings[0]!;
  state.buildings = [
    ...state.houses.map(house => ({ ...template, id: house.buildingId, kind: 'house' as const })),
    ...Array.from({ length: 6 }, (_, index) => ({ ...template, id: `farm-${index}`, kind: 'wheat_farm' as const })),
    ...Array.from({ length: 2 }, (_, index) => ({ ...template, id: `mill-${index}`, kind: 'mill' as const })),
    ...Array.from({ length: 2 }, (_, index) => ({ ...template, id: `granary-${index}`, kind: 'granary' as const })),
  ];
  const build = (_state: typeof state, kind: typeof template.kind) => ({ kind: 'place_building' as const, building: kind, tx: 0, ty: 0 });
  const action = foodAction(state, build);
  assert.equal(action.kind === 'place_building' && action.building, 'mill');
  state.buildings.push({ ...template, id: 'third-mill', kind: 'mill' });
  assert.deepEqual(foodAction(state, build), { kind: 'none' });
});

test('Given a quarry beside an isolated road When the advisor expands Then it connects real material sources without paving the future footprint', () => {
  let state = structuredClone(DEFAULT_GAME_STATE);
  const store = { ...state.buildings[0]!, id: 'source', kind: 'storehouse' as const, tx: 1, ty: 1, inventory: { timber: 100 } };
  const quarry = { ...store, id: 'planned-quarry', kind: 'quarry' as const, tx: 9, ty: 4, inventory: {} };
  state = { ...state, width: 12, height: 8, era: 'palisade', buildings: [store], houses: [], constructionSites: [], walkers: [], palisade: null,
    tiles: Array.from({ length: 96 }, (_, i) => {
      const tx = i % 12, ty = Math.floor(i / 12);
      return { tx, ty, terrain: tx === 11 && ty === 4 ? 'rock' as const : 'grass' as const,
        buildingId: tx >= 1 && tx < 3 && ty >= 1 && ty < 3 ? store.id : null,
        hasRoad: (tx === 3 && ty === 1) || (tx === 9 && ty === 3) };
    }),
  };
  assert.equal(resolveBuildingRoute(state, store, quarry).path, null);
  for (let step = 0; step < 12 && resolveBuildingRoute(state, store, quarry).path === null; step += 1) {
    const recommendation = plannedBuildingRoadAction(state, quarry);
    assert.equal(recommendation.kind, 'place_road');
    const action = autoplayActionToGameAction(recommendation, state);
    assert.ok(action);
    const after = gameReducer(state, action);
    assert.notEqual(after, state);
    state = after;
  }
  assert.notEqual(resolveBuildingRoute(state, store, quarry).path, null);
  assert.equal(state.tiles.some(tile => tile.tx >= 9 && tile.tx < 11 && tile.ty >= 4 && tile.ty < 6 && tile.hasRoad), false);
  state = gameReducer(state, { type: 'place_building', kind: 'quarry', tx: 9, ty: 4 });
  const site = state.constructionSites[0];
  assert.ok(site);
  assert.notEqual(resolveBuildingToConstructionSiteRoute(state, store, site).path, null);
});
