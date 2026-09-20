import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../src/content/buildingConfig';
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasConnectedConstructionRoute } from '../src/engine/autoplayConstructionRoute';
import { preserveRoadExpansion } from '../src/engine/autoplayExpansion';
import { waterAction } from '../src/engine/autoplayWater';
import type { GameState } from '../src/engine/engine.types';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import type { TerrainType } from '../src/content/terrainConfig';
import { canPlaceBuilding } from '../src/world/placement';

function testBuilding(id: string, kind: BuildingKind, tx: number, ty: number, inventory: Building['inventory'] = {}): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory,
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}


function openingHouseFixture(): GameState['houses'][number] {
  const openingHouse = DEFAULT_GAME_STATE.houses[0];
  assert.ok(openingHouse);
  return openingHouse;
}

function compactState(params: {
  readonly width: number;
  readonly height: number;
  readonly terrain?: (tx: number, ty: number) => TerrainType;
  readonly roads?: readonly string[];
  readonly buildings: readonly Building[];
  readonly houses?: GameState['houses'];
  readonly treasuryTimber?: number;
}): GameState {
  const roads = new Set(params.roads ?? []);
  const buildingAt = new Map<string, string>();
  for (const building of params.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    for (let dy = 0; dy < definition.height; dy += 1) {
      for (let dx = 0; dx < definition.width; dx += 1) {
        buildingAt.set(`${building.tx + dx},${building.ty + dy}`, building.id);
      }
    }
  }
  return {
    ...structuredClone(DEFAULT_GAME_STATE),
    width: params.width,
    height: params.height,
    buildings: [...params.buildings],
    houses: params.houses ?? [],
    constructionSites: [],
    walkers: [],
    population: params.houses?.reduce((total, house) => total + house.residents, 0) ?? 0,
    idleWorkers: 0,
    treasuryTimber: params.treasuryTimber ?? 0,
    palisade: null,
    pathCache: {},
    tiles: Array.from({ length: params.width * params.height }, (_unused, index) => {
      const tx = index % params.width;
      const ty = Math.floor(index / params.width);
      const key = `${tx},${ty}`;
      return {
        tx,
        ty,
        terrain: params.terrain?.(tx, ty) ?? 'grass',
        hasRoad: roads.has(key),
        buildingId: buildingAt.get(key) ?? null,
      };
    }),
  };
}

test('Given another road component still has open land When a building seals this component Then the advisor preserves the local exit', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.width = 8;
  state.height = 5;
  state.buildings = [];
  state.constructionSites = [];
  state.palisade = null;
  state.tiles = Array.from({ length: 40 }, (_unused, index) => {
    const tx = index % 8;
    const ty = Math.floor(index / 8);
    const blocksLocalExit = (tx === 4 && ty === 2) || (tx === 6 && ty === 2) || (tx === 5 && ty === 3);
    return {
      tx,
      ty,
      terrain: 'grass' as const,
      hasRoad: (tx === 1 && ty === 1) || (tx === 5 && ty === 2),
      buildingId: blocksLocalExit ? 'occupied' : null,
    };
  });
  const action = preserveRoadExpansion(state, { kind: 'house', tx: 5, ty: 1 });
  assert.deepEqual(action, { kind: 'place_road', from: { tx: 5, ty: 1 }, to: { tx: 5, ty: 0 } });
});


test('Given a legal connected forest well site When water autoplay decides Then it follows reducer legality instead of requiring grass', () => {
  const house = testBuilding('home', 'house', 7, 4);
  const store = testBuilding('store', 'storehouse', 1, 1, { timber: 20 });
  const state = compactState({
    width: 10,
    height: 8,
    terrain: () => 'forest',
    roads: ['3,1', '4,1', '5,1', '5,2', '5,3'],
    buildings: [store, house],
    houses: [{ ...openingHouseFixture(), buildingId: house.id, residents: 4, unmetRequirementTicks: 100 }],
  });
  const action = waterAction(state);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  const tile = state.tiles.find(candidate => candidate.tx === action.tx && candidate.ty === action.ty);
  assert.ok(tile);
  assert.equal(tile.terrain, 'forest');
  assert.equal(canPlaceBuilding(state, 'well', action.tx, action.ty).ok, true);
});

test('Given a covering well site needs one material road When water autoplay decides Then it plans access before abandoning water', () => {
  const house = testBuilding('home', 'house', 12, 4);
  const store = testBuilding('store', 'storehouse', 1, 1, { timber: 20 });
  const state = compactState({
    width: 16,
    height: 8,
    roads: ['3,1'],
    buildings: [store, house],
    houses: [{ ...openingHouseFixture(), buildingId: house.id, residents: 4, unmetRequirementTicks: 100 }],
  });
  const targetWell = testBuilding('target-well', 'well', 12, 2);
  assert.equal(hasConnectedConstructionRoute(state, targetWell), false);
  const repair = waterAction(state);
  assert.deepEqual(repair, { kind: 'place_road', from: { tx: 4, ty: 1 }, to: { tx: 12, ty: 1 } });
  const command = autoplayActionToGameAction(repair, state);
  assert.ok(command);
  const repaired = gameReducer(state, command);
  assert.notEqual(repaired, state);
  assert.equal(hasConnectedConstructionRoute(repaired, targetWell), true);
  const build = waterAction(repaired);
  assert.deepEqual(build, { kind: 'place_building', building: 'well', tx: 12, ty: 2 });
});

test('Given a well would seal the storage road component When water autoplay decides Then it preserves an expansion exit first', () => {
  const store = testBuilding('store', 'storehouse', 3, 2, { timber: 20 });
  const house = testBuilding('home', 'house', 6, 1);
  const southBlocker = testBuilding('south-blocker', 'house', 5, 3);
  const eastBlocker = testBuilding('east-blocker', 'house', 6, 2);
  const state = compactState({
    width: 8,
    height: 5,
    terrain: (tx, ty) => (tx >= 4 && tx <= 6 && ty <= 2) || (tx === 5 && ty === 3) || (tx >= 3 && tx <= 4 && ty >= 2) ? 'grass' : 'water',
    roads: ['5,2'],
    buildings: [store, house, southBlocker, eastBlocker],
    houses: [{ ...openingHouseFixture(), buildingId: house.id, residents: 4, unmetRequirementTicks: 100 }],
  });
  const action = waterAction(state);
  assert.deepEqual(action, { kind: 'place_road', from: { tx: 5, ty: 1 }, to: { tx: 5, ty: 0 } });
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
});
