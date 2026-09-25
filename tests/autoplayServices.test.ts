import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { buildingFootprintDistance } from '../src/geometry/buildingDistance';
import { createConstructionSite } from '../src/economy/construction';
import { urbanServiceAction } from '../src/engine/autoplayServices';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { lateFoodBuildSites } from '../src/engine/autoplayFoodPlacement';
import { civicConstructionReserve } from '../src/engine/autoplayCivicReserve';
import { marketHasSaleCandidate, settleMarkets } from '../src/engine/marketSettlement';
import { decideNextAction } from '../src/engine/autoplay';
import { plannedBuildingRoadAction } from '../src/engine/autoplayConstructionRoads';
import { serviceCandidate } from '../src/engine/autoplayServiceSpaceRoutes';
import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import type { GameState } from '../src/engine/engine.types';

function fixture() {
  const building = (id: string, kind: Building['kind'], tx: number, ty: number): Building => ({ id, kind, tx, ty, workers: kind === 'market' ? 3 : 0, inventory: kind === 'storehouse' ? { timber: 500, stone: 200 } : {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
  const buildings = [building('store', 'storehouse', 2, 13), building('home', 'house', 16, 11), building('old-market', 'market', 1, 10)];
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 30, height: 26, era: 'stone_town' as const, palisade: null, buildings, constructionSites: [], walkers: [], population: 22, idleWorkers: 12,
    houses: [{ buildingId: 'home', level: 3, residents: 22, hasWater: true, breadStock: 9, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 780 }, (_, i) => { const tx = i % 30, ty = Math.floor(i / 30); return { tx, ty, terrain: 'grass' as const, hasRoad: ty === 12 && tx >= 1 && tx <= 22,
      buildingId: buildings.find(b => tx >= b.tx && tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width && ty >= b.ty && ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height)?.id ?? null }; }),
  };
}

test('Given a distant era market When town service planning runs Then it builds a legal market covering homes instead of accepting mere existence', () => {
  const state = fixture();
  const action = urbanServiceAction(state);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  assert.equal(action.building, 'market');
  const home = state.buildings.find(b => b.id === 'home');
  assert.ok(home);
  assert.ok(buildingFootprintDistance(home, { ...home, kind: 'market', tx: action.tx, ty: action.ty }) <= 8);
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
});

test('Given market construction pending When the advisor runs again Then it does not duplicate the same facility', () => {
  const state = fixture();
  state.constructionSites = [];
  const planned = { ...state, constructionSites: [createConstructionSite({ ordinal: 99, kind: 'market', tx: 15, ty: 13, startedTick: 0 })] };
  const action = urbanServiceAction(planned);
  assert.notEqual(action.kind === 'place_building' && action.building, 'market');
});

test('Given a nearby understaffed market When services are missing Then the advisor does not build duplicate markets to solve missing workers', () => {
  const state = fixture();
  state.buildings = state.buildings.map(b => b.kind === 'market' ? { ...b, tx: 16, ty: 13, workers: 0 } : b);
  state.idleWorkers = 0;
  const action = urbanServiceAction(state);
  assert.notEqual(action.kind === 'place_building' && action.building, 'market');
});

test('Given the stone town era When a home still lacks civic services Then reaching victory does not stop the advisor', () => {
  const action = decideNextAction(fixture());
  assert.notEqual(action.kind, 'none');
});

test('Given higher town-house rations after stone-town proclamation When food capacity is insufficient Then the advisor still maintains the food chain', () => {
  const state = fixture();
  state.buildings = state.buildings.filter(b => b.kind !== 'market');
  // AF-13: with no field painted yet the grain step may first road toward a viable field block before it
  // can paint one and build the farmstead; any of those is "the advisor takes a grain action".
  const diagnostic: FoodDiagnosticCollector = {};
  const action = decideNextAction(state, undefined, diagnostic);
  assert.notEqual(action.kind, 'none');
  assert.equal(diagnostic.food?.reached, true);
  assert.equal(action.kind, diagnostic.food?.action?.kind);
});

test('Given all homes served by a staffed market When urban planning runs Then the next investment is a nearby church', () => {
  const state = fixture();
  state.buildings = state.buildings.map(b => b.kind === 'market' ? { ...b, tx: 16, ty: 13 } : b);
  state.tiles = state.tiles.map(tile => ({ ...tile, buildingId: state.buildings.find(b => tile.tx >= b.tx && tile.tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width && tile.ty >= b.ty && tile.ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height)?.id ?? null }));
  const action = urbanServiceAction(state);
  assert.equal(action.kind === 'place_building' && action.building, 'church');
});

test('Given the seed 3 church gap When planning a safe church road Then a real road action is available without sacrificing another home', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay/church-gap-seed3.json.gz', import.meta.url))).toString('utf8'));
  const candidate = serviceCandidate('church', { tx: 6, ty: 9 }, 'candidate');

  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'church', tx: 4, ty: 11 }), false);
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'church', tx: 6, ty: 9 }), true);
  assert.deepEqual(plannedBuildingRoadAction(state, candidate), {
    kind: 'place_road', from: { tx: 5, ty: 12 }, to: { tx: 5, ty: 11 },
  });
  const action = urbanServiceAction(state);
  assert.equal(action.kind, 'place_road');
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  const connected = gameReducer(state, command);
  assert.notEqual(connected, state);
  assert.deepEqual(urbanServiceAction(connected), { kind: 'place_building', building: 'church', tx: 6, ty: 10 });
});

test('Given insufficient real building materials When civic planning runs Then it waits instead of issuing an unaffordable construction', () => {
  const state = fixture();
  state.treasuryTimber = 0;
  state.buildings = state.buildings.map(b => ({ ...b, inventory: {} }));
  assert.deepEqual(urbanServiceAction(state), { kind: 'none' });
});

test('Given identical town buildings in reversed storage order When civic planning runs Then the recommendation is deterministic', () => {
  const state = fixture();
  assert.deepEqual(urbanServiceAction({ ...state, buildings: [...state.buildings].reverse() }), urbanServiceAction(state));
});

for (const [resource, reserve] of [['timber', 100], ['stone', 60]] as const) {
  test(`Given missing church and ${resource} at its build budget When markets export Then the next civic construction remains affordable`, () => {
    const state = fixture();
    state.buildings = state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { [resource]: reserve } } : b);
    const market = state.buildings.find(b => b.kind === 'market');
    assert.ok(market);
    assert.equal(marketHasSaleCandidate(state, market), false);
    const surplus = { ...state, tick: 80, buildings: state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { [resource]: reserve + 1 } } : b) };
    assert.equal(marketHasSaleCandidate(surplus, market), true);
    assert.equal(settleMarkets(surplus).buildings.find(b => b.kind === 'storehouse')?.inventory[resource], reserve);
    const reserved = { ...surplus, buildings: surplus.buildings.map(b => b.kind === 'storehouse' ? { ...b, stockReserved: { [resource]: 1 } } : b) };
    assert.equal(marketHasSaleCandidate(reserved, market), false);
    const planned = { ...state, constructionSites: [createConstructionSite({ ordinal: 99, kind: 'church', tx: 15, ty: 13, startedTick: 0 })] };
    assert.equal(marketHasSaleCandidate(planned, market), false);
    assert.equal(marketHasSaleCandidate({ ...state, houses: [] }, market), true);
  });
}

test('Given a completed connected church serving the home When exports resume Then the temporary church budget is released', () => {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'market');
  assert.ok(template);
  state.buildings = [...state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { timber: 61 } } : b),
    { ...template, id: 'church', kind: 'church', tx: 16, ty: 13, workers: 0 }];
  assert.equal(marketHasSaleCandidate(state, template), true);
});

test('Given two exporting markets and one unit above the church budget When both settle Then only that surplus unit is sold', () => {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'market');
  assert.ok(template);
  state.tick = 80;
  state.buildings = [...state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { timber: 101 } } : b),
    { ...template, id: 'second-market', tx: 16, ty: 13 }];
  const next = settleMarkets(state);
  assert.equal(next.buildings.find(b => b.kind === 'storehouse')?.inventory.timber, 100);
  assert.equal(next.treasuryCoin, state.treasuryCoin, 'C2 (M-1): the one surplus unit is traded without treasury income');
});


test('Given a partly delivered church When export reserves are calculated Then delivered and in-transit materials are deducted once', () => {
  const state = fixture();
  const site = createConstructionSite({ ordinal: 99, kind: 'church', tx: 15, ty: 13, startedTick: 0 });
  const planned = { ...state, constructionSites: [{ ...site, delivered: { timber: 20, stone: 10 }, reserved: { timber: 10, stone: 15 } }] };
  assert.deepEqual(civicConstructionReserve(planned), { timber: 70, stone: 35 });
  const market = state.buildings.find(b => b.kind === 'market');
  assert.ok(market);
  const committed = { ...planned, buildings: state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { timber: 80 }, stockReserved: { timber: 10 } } : b) };
  assert.equal(marketHasSaleCandidate(committed, market), false);
  const extra = { ...committed, buildings: committed.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { timber: 81 } } : b) };
  assert.equal(marketHasSaleCandidate(extra, market), true);
  assert.deepEqual(civicConstructionReserve({ ...state, constructionSites: [] }), { timber: 100, stone: 60 });
});

test('Given late-town food expansion When a granary serves the housing quarter Then new production stays near that quarter instead of first free map row', () => {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'market');
  assert.ok(template);
  const granary = { ...template, id: 'granary', kind: 'granary' as const, tx: 18, ty: 13, inventory: { wheat: 70 } };
  state.buildings.push(granary);
  state.tiles = state.tiles.map(tile => tile.tx >= 18 && tile.tx < 20 && tile.ty >= 13 && tile.ty < 15 ? { ...tile, buildingId: granary.id } : tile);
  const action = decideNextAction(state);
  // AF-13: with no field painted yet, the grain step paints a 2x2 field block (the old farm's footprint)
  // near the granary, rather than placing a farmstead directly.
  assert.equal(action.kind, 'paint_zone');
  if (action.kind !== 'paint_zone') return;
  assert.equal(action.zone, 'arable');
  const anchor = { tx: Math.min(...action.stroke.points.map(point => point.x)), ty: Math.min(...action.stroke.points.map(point => point.y)) };
  assert.ok(buildingFootprintDistance(granary, { ...template, kind: 'wheat_farm', tx: anchor.tx, ty: anchor.ty }) <= 4);
});


test('Given a winding granary road When late mills are ranked Then the shorter hauling route wins over the nearer geometric plot', () => {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'market');
  assert.ok(template);
  const granary = { ...template, id: 'granary', kind: 'granary' as const, tx: 18, ty: 13, inventory: { wheat: 70 } };
  state.buildings.push(granary);
  state.tiles = state.tiles.map(tile => ({ ...tile,
    hasRoad: (tile.ty === 12 && tile.tx >= 3 && tile.tx <= 18) || (tile.tx === 3 && tile.ty >= 12 && tile.ty <= 20)
      || (tile.ty === 20 && tile.tx >= 3 && tile.tx <= 20) || (tile.tx === 20 && tile.ty >= 16 && tile.ty <= 20),
    buildingId: tile.tx >= 18 && tile.tx < 20 && tile.ty >= 13 && tile.ty < 15 ? granary.id : tile.buildingId,
  }));
  const plots = lateFoodBuildSites(state, 'mill');
  assert.ok(plots);
  const nearButLong = plots.findIndex(tile => tile.tx === 20 && tile.ty === 15);
  const fartherButShort = plots.findIndex(tile => tile.tx === 15 && tile.ty === 13);
  assert.ok(nearButLong >= 0 && fartherButShort >= 0);
  assert.ok(fartherButShort < nearButLong);
});

test('Given a usable granary and an unrelated isolated granary When planning local food Then the isolated facility does not veto the working supply network', () => {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'market');
  assert.ok(template);
  state.buildings.push({ ...template, id: 'connected-granary', kind: 'granary', tx: 18, ty: 13 },
    { ...template, id: 'isolated-granary', kind: 'granary', tx: 25, ty: 2 });
  state.tiles = state.tiles.map(tile => ({ ...tile, buildingId: state.buildings.find(b => tile.tx >= b.tx && tile.tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width && tile.ty >= b.ty && tile.ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height)?.id ?? null }));
  // AF-13: lateFoodBuildSites only searches for 'mill' or 'farmstead' now; the wheat farm is retired.
  const plots = lateFoodBuildSites(state, 'mill');
  assert.ok(plots && plots.length > 0);
});
