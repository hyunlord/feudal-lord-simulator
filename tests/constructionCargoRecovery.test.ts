import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { advanceTick } from '../src/engine/tick';
import { createConstructionSite } from '../src/economy/construction';
import { buildingInspectorModel } from '../src/render/buildingInspectorModel';
import type { GameState } from '../src/engine/engine.types';

function cancelledFullStore(): GameState {
  const opening = structuredClone(DEFAULT_GAME_STATE);
  const site = { ...createConstructionSite({ ordinal: 1, kind: 'sawmill', tx: 48, ty: 40, startedTick: 0 }), delivered: { timber: 16 } };
  let state: GameState = { ...opening, treasuryTimber: 0,
    buildings: opening.buildings.map(building => building.kind === 'storehouse' ? { ...building, inventory: { timber: 200 } } : building),
    tiles: opening.tiles.map(tile => tile.tx === 48 && tile.ty === 40 ? { ...tile, buildingId: site.id } : tile),
    constructionSites: [site], nextConstructionOrdinal: 2 };
  for (let tick = 0; tick < 21; tick += 1) state = advanceTick(state);
  state = gameReducer(state, { type: 'cancel_construction', siteId: site.id });
  assert.ok(state.walkers.some(walker => walker.kind === 'carter' && walker.cancellation !== null && walker.cargo?.amount === 8));
  return state;
}

test('R-T10: cancelled construction cargo unloads above the full store limit and frees its source', () => {
  let state = cancelledFullStore();
  const returner = state.walkers.find(walker => walker.kind === 'carter' && walker.cancellation !== null);
  assert.ok(returner?.kind === 'carter');
  for (let tick = 0; tick < 500; tick += 1) state = advanceTick(state);
  assert.equal(state.walkers.some(walker => walker.id === returner.id), false);
  const store = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(store);
  assert.equal(store.inventory.timber, 208);
  assert.ok(buildingInspectorModel(state, store.id)?.rows.some(row => row.includes('넘침 8')));
  const next = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: 'wheat_farm', tx: 48, ty: 42, startedTick: state.wallTick });
  state = { ...state, constructionSites: [next],
    tiles: state.tiles.map(tile => (tile.tx === 48 || tile.tx === 49) && (tile.ty === 42 || tile.ty === 43)
      ? { ...tile, buildingId: next.id } : tile) };
  for (let tick = 0; tick < 1500; tick += 1) state = advanceTick(state);
  assert.ok(state.buildings.some(building => building.id === next.id)
    || (state.constructionSites.find(site => site.id === next.id)?.delivered.timber ?? 0) > 1);
});

test('R-T11: storage overflow cause disappears after inventory is consumed below capacity', () => {
  const state = cancelledFullStore();
  const store = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(store);
  const overflowing = { ...state, buildings: state.buildings.map(building => building.id === store.id
    ? { ...building, inventory: { timber: 208 } } : building) };
  assert.ok(buildingInspectorModel(overflowing, store.id)?.rows.some(row => row.includes('넘침 8')));
  const consumed = { ...overflowing, buildings: overflowing.buildings.map(building => building.id === store.id
    ? { ...building, inventory: { timber: 192 } } : building) };
  assert.equal(buildingInspectorModel(consumed, store.id)?.rows.some(row => row.includes('넘침')), false);
});

test('cancelled construction cargo chooses the nearest reachable store even if that store is full', async () => {
  const { cancelCarter, completeReturn } = await import('../src/agents/deliveryReturn');
  const { spawnCarter } = await import('../src/agents/deliveryCommon');
  const { building, line, routePort, DELIVERY_INVENTORY } = await import('./deliveryFixtures');
  const far = building('far', 'storehouse', { tx: 0, ty: 0, inventory: { timber: 192 } });
  const near = building('near', 'storehouse', { tx: 2, ty: 0, inventory: { stone: 200 } });
  const destination = { kind: 'construction_site' as const, siteId: 'cancelled' };
  const cart = spawnCarter({ tick: 0, home: far, destination, mission: 'deliver', cargo: { resource: 'timber', amount: 8 },
    path: line([0, 0], [1, 0], [2, 0], [3, 0]),
    reservation: { destination, resource: 'timber', amount: 8, homeCapacityClaim: null,
      sourceStockClaim: { kind: 'building', buildingId: far.id, resource: 'timber', amount: 8 } } });
  const moving = { ...cart, pathIndex: 3, position: { tx: 3, ty: 0 } };
  const routes = routePort({ '3,0->far': line([3, 0], [2, 0], [1, 0], [0, 0]), '3,0->near': line([3, 0], [2, 0]) });
  const cancelled = cancelCarter(1, { buildings: [far, near], constructionSites: [], treasuryTimber: 0 }, moving,
    DELIVERY_INVENTORY, routes, 'manual');
  assert.ok(cancelled.walker);
  assert.equal(cancelled.walker.homeBuildingId, near.id);
  const settled = completeReturn(cancelled, cancelled.walker, DELIVERY_INVENTORY);
  assert.equal(settled.buildings.find(building => building.id === near.id)?.inventory.timber, 8);
  assert.equal(settled.buildings.find(building => building.id === near.id)?.inventory.stone, 200);
  assert.equal(settled.buildings.find(building => building.id === far.id)?.inventory.timber, 192);
  assert.equal(DELIVERY_INVENTORY.availableSpace(settled.buildings.find(building => building.id === near.id) ?? near), 0);
});

test('overflow is a registered map cause and is not just a hover label', async () => {
  const { buildingCauseSnapshot } = await import('../src/ui/houseProgressModel');
  const initial = cancelledFullStore();
  const store = initial.buildings.find(building => building.kind === 'storehouse');
  assert.ok(store);
  const state = { ...initial, buildings: initial.buildings.map(building => building.id === store.id
    ? { ...building, inventory: { timber: 208 } } : building) };
  assert.equal(buildingCauseSnapshot(state).get(store.id)?.blocker?.causeId, 'storage_overflow');
});

test('an unreachable nearby warehouse does not divert a cancelled return off its reachable home route', async () => {
  const { cancelCarter, canCompleteReturn } = await import('../src/agents/deliveryReturn');
  const { spawnCarter } = await import('../src/agents/deliveryCommon');
  const { building, line, routePort, DELIVERY_INVENTORY } = await import('./deliveryFixtures');
  const far = building('far', 'storehouse', { tx: 0, ty: 0, inventory: { timber: 200 } });
  const isolated = building('isolated', 'storehouse', { tx: 2, ty: 0, inventory: { timber: 200 } });
  const destination = { kind: 'construction_site' as const, siteId: 'cancelled' };
  const cart = spawnCarter({ tick: 0, home: far, destination, mission: 'deliver', cargo: { resource: 'timber', amount: 8 },
    path: line([0, 0], [1, 0], [2, 0], [3, 0]),
    reservation: { destination, resource: 'timber', amount: 8, homeCapacityClaim: null,
      sourceStockClaim: { kind: 'building', buildingId: far.id, resource: 'timber', amount: 8 } } });
  const routes = routePort({ '3,0->far': line([3, 0], [2, 0], [1, 0], [0, 0]) });
  const cancelled = cancelCarter(1, { buildings: [far, isolated], constructionSites: [], treasuryTimber: 0 },
    { ...cart, pathIndex: 3, position: { tx: 3, ty: 0 } }, DELIVERY_INVENTORY, routes, 'manual');
  assert.ok(cancelled.walker);
  assert.equal(cancelled.walker.homeBuildingId, far.id);
  assert.equal(canCompleteReturn(cancelled.buildings, cancelled.walker, DELIVERY_INVENTORY), true);
});
