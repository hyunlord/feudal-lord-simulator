import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { plannedBuildingRoadAction } from '../src/engine/autoplayConstructionRoads';
import { hasConnectedConstructionRoute } from '../src/engine/autoplayConstructionRoute';
import { allocateHouseServices } from '../src/population/serviceAllocation';
import { marketRoadService } from '../src/engine/marketService';
import { serviceSpaceHouses } from '../src/engine/autoplayServiceSpaceRoutes';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import type { GameState } from '../src/engine/engine.types';
import { gameReducer } from '../src/state/gameStore';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { buildingFootprintDistance } from '../src/geometry/buildingDistance';
import { canPlaceBuilding, canPlaceBuildingBeforeRoad } from '../src/world/placement';
import { hasAutoplayBuildingClearance } from '../src/engine/autoplaySetback';
import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
import { findAutoplayServiceWitness } from '../src/engine/autoplayServiceSpaceWitness';
import { projectServiceAction, serviceCandidate, serviceSpaceBuildings } from '../src/engine/autoplayServiceSpaceRoutes';
import { createConstructionSite } from '../src/economy/construction';
import { potentialServiceRoads, serviceWitnessRoads } from '../src/engine/autoplayServiceSpaceRoutes';
import { migrateStateV9ToV10 } from '../src/save/migrations/v9ToV10';
function naturalBeforeLoss(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-normal-97560.json.gz', import.meta.url))).toString('utf8'));
}
function futureMarkets(state: GameState, home: Building): number {
  return state.tiles.filter(tile => {
    const candidate: Building = { id: 'hypothetical-market', kind: 'market', tx: tile.tx, ty: tile.ty,
      workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    if (buildingFootprintDistance(home, candidate) > BUILDING_CONFIG_BY_KIND.market.serviceRadius
      || !hasAutoplayBuildingClearance(state, 'market', tile)) return false;
    const placement = canPlaceBuildingBeforeRoad({ ...state, era: 'stone_town' }, 'market', tile.tx, tile.ty);
    return placement.ok || placement.reason === 'insufficient_materials';
  }).length;
}

test('Given the normal97560 legacy hamlet without a measured window When autoplay decides Then it observes before another food expansion', () => {
  // AF-13/v10: migrated first, like a real load, so its 13 pre-v10 wheat farms count as farmsteads instead of
  // reading as zero and sending the advisor after a fresh grain expansion.
  const state = migrateStateV9ToV10(naturalBeforeLoss());
  const diagnostic: FoodDiagnosticCollector = {};
  assert.deepEqual(decideNextAction(state, { maxHousingLots: 24 }, diagnostic), { kind: 'none' });
  assert.equal(diagnostic.food?.reason, 'observation_warmup');
});

test('Given the normal97560 hamlet When a safe alternative granary is connected Then its real road and construction preserve the last future market pad', () => {
  const state = naturalBeforeLoss();
  const home = state.buildings.find(building => building.id === 'construction-site-000042');
  assert.ok(home);
  assert.equal(futureMarkets(state, home), 1);
  const alternative = { kind: 'place_building', building: 'granary', tx: 61, ty: 41 } as const;
  const candidate = serviceCandidate('granary', alternative, 'safe-granary');
  assert.equal(preservesAutoplayServiceSpace(state, { ...alternative, ty: 40 }), false);
  assert.equal(preservesAutoplayServiceSpace(state, alternative), true);
  const action = plannedBuildingRoadAction(state, candidate);
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command, 'the candidate search must produce a safe alternative, not a permanent veto');
  const next = gameReducer(state, command);
  assert.notEqual(next, state);
  assert.ok(futureMarkets(next, home) > 0, `last future market pad lost to ${JSON.stringify(action)}`);
  assert.equal(hasConnectedConstructionRoute(next, candidate), true, 'the safe road must lead to an actual alternative building');
  assert.equal(canPlaceBuilding(next, alternative.building, alternative.tx, alternative.ty).ok, true);
  const build = autoplayActionToGameAction(alternative, next);
  assert.ok(build);
  const built = gameReducer(next, build);
  assert.notEqual(built, next);
  assert.ok(findAutoplayServiceWitness(built, home), 'the paired service route remains feasible after reserving construction');
});


const destructiveGranary = { kind: 'place_building', building: 'granary', tx: 61, ty: 40 } as const;
test('Given a feasible saved layout When buildings or roads consume its last paired service footprint Then both are rejected independent of stock, tick and order', () => {
  const state = naturalBeforeLoss();
  assert.equal(preservesAutoplayServiceSpace(state, destructiveGranary), false);
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_road', from: { tx: 60, ty: 39 }, to: { tx: 60, ty: 39 } }), false);
  const reordered = { ...state, tick: state.tick + 120, treasuryTimber: 0,
    buildings: [...state.buildings].reverse().map(building => ({ ...building, workers: 0, inventory: {} })), houses: [...state.houses].reverse() };
  assert.equal(preservesAutoplayServiceSpace(reordered, destructiveGranary), false);
  const home = state.buildings.find(building => building.id === 'construction-site-000042');
  assert.ok(home);
  assert.ok(findAutoplayServiceWitness(state, home));
  assert.equal(findAutoplayServiceWitness(projectServiceAction(state, destructiveGranary), home), null);
});

test('Given a legacy impossible home When unrelated recovery is proposed Then it is allowed while a new impossible house is rejected', () => {
  const state = naturalBeforeLoss();
  const impossible = projectServiceAction(state, destructiveGranary);
  assert.equal(preservesAutoplayServiceSpace(impossible, { kind: 'place_building', building: 'well', tx: 2, ty: 2 }), true);
  const covered = { ...impossible, tiles: impossible.tiles.map(tile => ({ ...tile, hasRoad: tile.buildingId === null })) };
  assert.equal(preservesAutoplayServiceSpace(covered, { kind: 'place_building', building: 'house', tx: 2, ty: 2 }), false);
});

test('Given pending occupancy When it completes or is cancelled Then the structural witness cache follows the layout', () => {
  const state = naturalBeforeLoss();
  const pending = { ...state, constructionSites: [...state.constructionSites,
    createConstructionSite({ ordinal: 999, kind: 'granary', tx: 61, ty: 40, startedTick: state.tick })] };
  const home = state.buildings.find(building => building.id === 'construction-site-000042');
  assert.ok(home);
  assert.equal(findAutoplayServiceWitness(pending, home), null);
  assert.ok(serviceSpaceBuildings(pending).some(building => building.id === 'construction-site-000999'));
  assert.equal(preservesAutoplayServiceSpace(pending, { kind: 'place_building', building: 'well', tx: 2, ty: 2 }), true);
  assert.equal(preservesAutoplayServiceSpace({ ...pending, constructionSites: state.constructionSites }, destructiveGranary), false);
  const completed = projectServiceAction(state, destructiveGranary);
  assert.equal(findAutoplayServiceWitness(completed, home), null);
});


test('Given known unfinished walls When future service routes are checked Then completed traversal retains the real gate and rejects a sealed crossing', () => {
  const base = naturalBeforeLoss();
  const home = serviceCandidate('house', { tx: 4, ty: 5 }, 'home');
  const store = serviceCandidate('storehouse', { tx: 2, ty: 5 }, 'source');
  const market = serviceCandidate('market', { tx: 12, ty: 5 }, 'market');
  const buildings = [home, store, market];
  const path = [{ x: 9, y: 0 }, { x: 9, y: 16 }];
  const state: GameState = { ...base, width: 18, height: 16, buildings, houses: [], constructionSites: [],
    tiles: Array.from({ length: 18 * 16 }, (_, index) => ({ tx: index % 18, ty: Math.floor(index / 18), terrain: 'grass', buildingId: null, hasRoad: true })),
    palisade: { id: 'known', polygon: path, gate: { x: 9, y: 5 },
      segments: [{ id: 'segment', order: 0, edgePath: path, tileCount: 16, completed: false, constructionSiteId: 'site' }] } };
  assert.ok(serviceWitnessRoads(state, potentialServiceRoads(state, buildings), home, [market]));
  assert.ok(state.palisade);
  const closed = { ...state, palisade: { ...state.palisade, gate: { x: 99, y: 99 } } };
  assert.equal(serviceWitnessRoads(closed, potentialServiceRoads(closed, buildings), home, [market]), null);
});

test('Given a merged residential lot When occupancy is gathered Then its full service demand and footprint remain present', () => {
  const state = naturalBeforeLoss();
  const original = state.buildings.find(building => building.kind === 'house');
  assert.ok(original);
  const merged: Building = { ...original, houseLot: 'horizontal' };
  const projected = { ...state, buildings: state.buildings.map(building => building.id === original.id ? merged : building) };
  assert.deepEqual(serviceSpaceBuildings(projected).find(building => building.id === original.id)?.houseLot, 'horizontal');
  assert.equal(preservesAutoplayServiceSpace(projected, destructiveGranary), false);
  assert.equal(preservesAutoplayServiceSpace(state, destructiveGranary), false);
});

test('Given all market lots reserved When another home is proposed Then allocator capacity rejects it and removal releases space', () => {
  const base = naturalBeforeLoss();
  const market = serviceCandidate('market', { tx: 8, ty: 8 }, 'market');
  const church = serviceCandidate('church', { tx: 11, ty: 8 }, 'church');
  const positions = Array.from({ length: 81 }, (_, index) => serviceCandidate('house',
    { tx: 1 + index % 9 * 2, ty: 1 + Math.floor(index / 9) * 2 }, `home-${index}`))
    .filter(home => buildingFootprintDistance(home, market) > 0 && buildingFootprintDistance(home, church) > 0
      && buildingFootprintDistance(home, market) <= 8 && buildingFootprintDistance(home, church) <= 12);
  const homes = positions.slice(0, 24);
  assert.equal(homes.length, 24);
  const buildings = [...homes, market, church, serviceCandidate('storehouse', { tx: 1, ty: 14 }, 'source')];
  const state: GameState = { ...base, width: 20, height: 20, buildings, houses: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 400 }, (_, index) => ({ tx: index % 20, ty: Math.floor(index / 20), terrain: 'grass', buildingId: null, hasRoad: true })) };
  const action = { kind: 'place_building', building: 'house', tx: 7, ty: 14 } as const;
  assert.equal(preservesAutoplayServiceSpace(state, action), false);
  const removed = { ...state, buildings: buildings.filter(building => building.id !== homes[23]?.id) };
  assert.equal(preservesAutoplayServiceSpace(removed, action), true);
  assert.equal(preservesAutoplayServiceSpace(state, action), false);
});

test('Given disconnected access sides of one home When only one side has supply Then the other future provider cannot borrow that supply connection', () => {
  const base = naturalBeforeLoss();
  const home = serviceCandidate('house', { tx: 4, ty: 3 }, 'home');
  const source = serviceCandidate('storehouse', { tx: 1, ty: 3 }, 'source');
  const market = serviceCandidate('market', { tx: 1, ty: 0 }, 'market');
  const church = serviceCandidate('church', { tx: 6, ty: 2 }, 'church');
  const state: GameState = { ...base, width: 9, height: 7, buildings: [home, source], houses: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 63 }, (_, index) => ({ tx: index % 9, ty: Math.floor(index / 9),
      terrain: index % 9 === 4 && Math.floor(index / 9) !== 3 ? 'water' : 'grass', buildingId: null,
      hasRoad: index % 9 !== 4 })) };
  const potential = potentialServiceRoads(state, [home, source, market, church]);
  assert.equal(serviceWitnessRoads(state, potential, home, [market, church]), null);
});

test('Given below, exact and above-capacity layouts When local reachability is optimized Then witness decisions match the full allocator', () => {
  const base = naturalBeforeLoss();
  const market = serviceCandidate('market', { tx: 10, ty: 10 }, 'market');
  const church = serviceCandidate('church', { tx: 13, ty: 10 }, 'church');
  const positions = Array.from({ length: 144 }, (_, index) => serviceCandidate('house',
    { tx: 1 + index % 12 * 2, ty: 1 + Math.floor(index / 12) * 2 }, `home-${index}`))
    .filter(home => buildingFootprintDistance(home, market) > 0 && buildingFootprintDistance(home, church) > 0
      && buildingFootprintDistance(home, market) <= 8 && buildingFootprintDistance(home, church) <= 12);
  for (const [count, merged] of [[4, false], [23, true], [24, false], [24, true], [25, false], [33, false]] as const) {
    const homes = positions.slice(0, count).map((home, index): Building => index === 0 && merged ? { ...home, houseLot: 'horizontal' } : home);
    assert.equal(homes.length, count);
    const buildings = [...homes, market, church, serviceCandidate('storehouse', { tx: 1, ty: 20 }, 'source')];
    const state: GameState = { ...base, width: 26, height: 26, buildings, houses: [], constructionSites: [], palisade: null,
      tiles: Array.from({ length: 676 }, (_, index) => ({ tx: index % 26, ty: Math.floor(index / 26), terrain: 'grass', buildingId: null, hasRoad: true })) };
    const potential = potentialServiceRoads(state, buildings);
    const full = allocateHouseServices({ houses: serviceSpaceHouses(state, buildings), buildings, roadService: marketRoadService(potential) });
    for (const home of homes) {
      const allocation = full.houses.get(home.id);
      const expected = allocation?.market.kind === 'served' && allocation.church.kind === 'served'
        && serviceWitnessRoads(state, potential, home, [market, church]) !== null;
      assert.equal(findAutoplayServiceWitness(state, home) !== null, expected, `${count}/${merged}/${home.id}`);
    }
  }
});
