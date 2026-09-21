import assert from 'node:assert/strict';
import test from 'node:test';
import { constructionLogisticsAction } from '../src/engine/autoplayConstructionLogistics';
import { constructionRoadAction } from '../src/engine/autoplayConstructionRoads';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import { stoneSite, building, state as makeState, palisade, palisadeSegment } from './stoneWallConversionFixtures';
import type { GameState } from '../src/engine/engine.types';
function fixture(rotation = 0, offset = 0): GameState {
  const tile = (x: number, y: number) => { for (let i = 0; i < rotation; i++) [x, y] = [11 - y, x]; return { tx: x + offset, ty: y + offset }; };
  const point = (x: number, y: number) => { for (let i = 0; i < rotation; i++) [x, y] = [12 - y, x]; return { x: x + offset, y: y + offset }; };
  const occupied = [tile(1, 1), tile(2, 1), tile(1, 2), tile(2, 2)];
  const roads = new Set<string>();
  for (let y = 3; y <= 7; y++) for (const x of [2, 8]) { const t = tile(x, y); roads.add(`${t.tx},${t.ty}`); }
  for (let x = 2; x <= 8; x++) { const t = tile(x, 7); roads.add(`${t.tx},${t.ty}`); }
  const corridor = new Set(Array.from({ length: 7 }, (_, i) => { const t = tile(i + 2, 3); return `${t.tx},${t.ty}`; }));
  const width = 12 + offset * 2;
  return makeState({ width, height: width, era: 'stone_town', houses: [], walkers: [], population: 0, palisade: null,
    buildings: [building('source', 'storehouse', Math.min(...occupied.map(t => t.tx)), Math.min(...occupied.map(t => t.ty)), { inventory: { stone: 8 } })],
    constructionSites: [stoneSite(0, { path: [point(8, 3), point(9, 3)], required: { stone: 4 } })],
    tiles: Array.from({ length: width * width }, (_, i) => { const tx = i % width, ty = Math.floor(i / width); const key = `${tx},${ty}`;
      return { tx, ty, terrain: roads.has(key) || corridor.has(key) || occupied.some(t => t.tx === tx && t.ty === ty) ? 'grass' : 'water', hasRoad: roads.has(key), buildingId: occupied.some(t => t.tx === tx && t.ty === ty) ? 'source' : null }; }) });
}
function edges(state: GameState): number { const source = state.buildings[0], target = state.constructionSites[0]; assert.ok(source && target); return (resolveBuildingToConstructionSiteRoute(state, source, target).path?.length ?? 0) - 1; }
for (const rotation of [0, 1, 2, 3]) for (const offset of [0, 3]) test(`legal corridor terminates after reducer-approved progress, rotation${rotation} offset${offset}`, () => {
  let state = fixture(rotation, offset); const before = edges(state); assert.ok(before > 0);
  for (let n = 0; n < 10; n++) {
    const action = constructionLogisticsAction(state); assert.deepEqual(constructionLogisticsAction({ ...state, tick: state.tick + 1 }), action);
    if (action.kind === 'none') break;
    assert.equal(action.kind, 'place_road'); const command = autoplayActionToGameAction(action, state); assert.ok(command);
    const next = gameReducer(state, command); assert.ok(next.tiles.filter(t => t.hasRoad).length > state.tiles.filter(t => t.hasRoad).length); state = next;
  }
  assert.ok(edges(state) < before); assert.equal(constructionLogisticsAction(state).kind, 'none');
});

test('claimed stock, fully reserved active need, source removal and treasury-only stock invalidate eligibility on same geometry', () => {
  const state = fixture(); assert.equal(constructionLogisticsAction(state).kind, 'place_road');
  assert.equal(constructionLogisticsAction({ ...state, buildings: state.buildings.map(b => ({ ...b, stockReserved: { stone: 8 } })) }).kind, 'none');
  assert.equal(constructionLogisticsAction({ ...state, constructionSites: state.constructionSites.map(s => ({ ...s, reserved: { stone: 4 } })) }).kind, 'none');
  assert.equal(constructionLogisticsAction({ ...state, buildings: [] }).kind, 'none');
  assert.equal(constructionLogisticsAction({ ...state, treasuryTimber: 999, buildings: state.buildings.map(b => ({ ...b, inventory: {} })) }).kind, 'none');
  assert.equal(constructionLogisticsAction(state).kind, 'place_road');
});

test('water and pending building footprint close shortcut without crossing occupancy or mutating input', () => {
  const state = fixture(); const blocked = { ...state, tiles: state.tiles.map(t => t.hasRoad ? t : { ...t, terrain: 'water' as const }) };
  assert.equal(constructionLogisticsAction(blocked).kind, 'none');
  const plan = { id: 'well-plan', kind: 'well' as const, tx: 5, ty: 3, required: { timber: 4 }, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 200, assignedBuilders: 0, stall: 'awaiting_materials' as const, startedTick: 0 };
  assert.equal(constructionLogisticsAction({ ...state, constructionSites: [...state.constructionSites, plan] }).kind, 'none');
  assert.equal(constructionLogisticsAction(state).kind, 'place_road');
});

test('completed wall blocks corridor while actual gate permits it; cache follows wall identity', () => {
  const state = fixture(); const wall = palisade([{ ...palisadeSegment(0), edgePath: [{ x: 5, y: 0 }, { x: 5, y: 6 }] }]);
  const closed = { ...state, palisade: { ...wall, gate: { x: 5, y: 0 } } };
  assert.equal(constructionLogisticsAction(closed).kind, 'none');
  assert.equal(constructionLogisticsAction({ ...closed, palisade: { ...wall, gate: { x: 5, y: 3.5 } } }).kind, 'place_road');
});

test('no-route stays owned by the original repair and queued-only future needs never request shortcuts', () => {
  const state = fixture(); const disconnected = { ...state, tiles: state.tiles.map(t => t.tx === 5 && t.ty === 7 ? { ...t, hasRoad: false, terrain: 'grass' as const } : t) };
  assert.equal(edges(disconnected), -1); assert.equal(constructionLogisticsAction(disconnected).kind, 'none');
  assert.equal(constructionRoadAction({ ...disconnected, constructionSites: disconnected.constructionSites.map(s => ({ ...s, stall: 'no_route' })) }).kind, 'place_road');
  const active = state.constructionSites[0]; assert.ok(active);
  assert.equal(constructionLogisticsAction({ ...state, constructionSites: [{ ...active, reserved: { stone: 4 } }, stoneSite(1, { required: { stone: 4 } })] }).kind, 'none');
});

test('an already-short first source does not hide a later source detour for the same active need', () => {
  const original = fixture();
  const near = building('a-near', 'storehouse', 8, 1, { inventory: { stone: 8 } });
  const state = { ...original, buildings: [near, ...original.buildings], tiles: original.tiles.map(t => t.tx >= 8 && t.tx <= 9 && t.ty >= 1 && t.ty <= 2 ? { ...t, buildingId: near.id, terrain: 'grass' as const } : t) };
  const site = state.constructionSites[0]; assert.ok(site);
  assert.equal(resolveBuildingToConstructionSiteRoute(state, near, site).path?.length, 1);
  assert.equal(constructionLogisticsAction(state).kind, 'place_road');
  assert.equal(constructionLogisticsAction({ ...state, buildings: state.buildings.map(b => b.id === 'source' ? { ...b, inventory: {} } : b) }).kind, 'none');
});

test('active target stays fixed across site/source permutations and never optimizes nonwall construction', () => {
  const state = fixture(); const active = state.constructionSites[0]; assert.ok(active);
  const later = { ...active, id: 'z-second-wall', wallId: 'other-wall', order: 0 };
  const first = { ...active, id: 'a-first-wall', path: [{ x: 2, y: 3 }, { x: 3, y: 3 }] };
  for (const sites of [[first, later], [later, first]]) assert.equal(constructionLogisticsAction({ ...state, constructionSites: sites }).kind, 'none');
  const plan = { id: 'nonwall', kind: 'well' as const, tx: 8, ty: 2, required: { stone: 4 }, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 200, assignedBuilders: 0, stall: 'awaiting_materials' as const, startedTick: 0 };
  assert.equal(constructionLogisticsAction({ ...state, constructionSites: [plan] }).kind, 'none');
});

test('source ordering is deterministic and planning leaves walkers unchanged', () => {
  const state = fixture(); const source = state.buildings[0]; assert.ok(source);
  const other = { ...source, id: 'z-other', inventory: {} };
  assert.deepEqual(constructionLogisticsAction({ ...state, buildings: [other, source] }), constructionLogisticsAction({ ...state, buildings: [source, other] }));
  assert.deepEqual(state.walkers, []);
});
