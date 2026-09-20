import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { Building, BuildingKind } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { foodCoverageAction } from '../src/engine/autoplayFoodCoverage';
import { createConstructionSite } from '../src/economy/construction';

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: kind === 'house' ? 0 : 2, inventory: { bread: 100 }, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function town(): GameState {
  const buildings = [building('granary', 'granary', 1, 1), building('home', 'house', 55, 2)];
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 64, height: 8, era: 'hamlet', palisade: null,
    treasuryTimber: 1000, idleWorkers: 20, buildings, constructionSites: [], walkers: [],
    houses: [{ buildingId: 'home', level: 0, builtLevel: 0, residents: 0, hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 512 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64), terrain: 'grass', hasRoad: Math.floor(n / 64) === 3,
      buildingId: buildings.find(b => n % 64 >= b.tx && n % 64 < b.tx + (b.kind === 'house' ? 1 : 2) && Math.floor(n / 64) >= b.ty && Math.floor(n / 64) < b.ty + (b.kind === 'house' ? 1 : 2))?.id ?? null })), pathCache: {} };
}
test('vacant connected home beyond distributor range requests coverage despite stocked granary', () => {
  const state = town();
  state.buildings = state.buildings.map(b => b.kind === 'house' ? { ...b, ty: 2 } : b);
  assert.notEqual(foodCoverageAction(state).kind, 'none');
});
for (const reason of ['in-range', 'empty-stock-in-range', 'disconnected', 'pending', 'workers', 'provider-workers', 'no-source-bread', 'budget', 'no-legal-sites'] as const) {
  test(`coverage does not duplicate granaries for ${reason}`, () => {
    const state = town();
    state.buildings = state.buildings.map(b => b.kind === 'house' ? { ...b, ty: 2 } : b);
    if (reason === 'in-range' || reason === 'empty-stock-in-range') state.buildings = state.buildings.map(b => b.kind === 'house' ? { ...b, tx: 10 } : b);
    if (reason === 'empty-stock-in-range') state.buildings = state.buildings.map(b => ({ ...b, inventory: {} }));
    if (reason === 'disconnected') state.tiles = state.tiles.map(t => t.tx === 30 ? { ...t, hasRoad: false } : t);
    if (reason === 'pending') state.constructionSites = [createConstructionSite({ ordinal: 1, kind: 'granary', tx: 20, ty: 0, startedTick: 0 })];
    if (reason === 'provider-workers') state.buildings = state.buildings.map(b => ({ ...b, workers: 0 }));
    if (reason === 'no-source-bread') state.buildings = state.buildings.map(b => ({ ...b, inventory: {} }));
    if (reason === 'workers') state.idleWorkers = 0;
    if (reason === 'budget') { state.treasuryTimber = 0;  }
    if (reason === 'no-legal-sites') state.tiles = state.tiles.map(t => t.hasRoad ? t : { ...t, terrain: 'water' });
    assert.deepEqual(foodCoverageAction(state), { kind: 'none' });
  });
}

test('actual distributor origin, rather than nearest granary edge, determines range', async () => {
  const { createSimulationRoutePorts } = await import('../src/engine/simulationPorts');
  const { resolveBuildingRoute } = await import('../src/engine/routing');
  const state = town();
  state.buildings = state.buildings.map(b => b.kind === 'house' ? { ...b, tx: 42 } : b);
  const granary = state.buildings[0]!;
  const home = state.buildings[1]!;
  const routes = createSimulationRoutePorts(state).roaming;
  const start = routes.homePath(granary.id)?.[0];
  assert.ok(start);
  const actual = routes.servicePath?.(start, { ...state.houses[0]!, tx: home.tx, ty: home.ty });
  const optimistic = resolveBuildingRoute(state, granary, home).path;
  assert.ok(actual && optimistic);
  assert.ok(actual.length - 1 > 40);
  assert.ok(optimistic.length - 1 <= 40);
  assert.notEqual(foodCoverageAction(state).kind, 'none');
});

test('stock on another road component cannot fund a food coverage claim', () => {
  const state = town();
  state.buildings = [...state.buildings.map(b => b.kind === 'house' ? { ...b, tx: 60 } : b),
    { ...building('empty-granary', 'granary', 12, 1), inventory: {} }];
  state.tiles = state.tiles.map(tile => tile.tx === 10 ? { ...tile, terrain: 'water', hasRoad: false }
    : { ...tile, buildingId: state.buildings.find(b => tile.tx >= b.tx && tile.tx < b.tx + (b.kind === 'house' ? 1 : 2) && tile.ty >= b.ty && tile.ty < b.ty + (b.kind === 'house' ? 1 : 2))?.id ?? null });
  assert.deepEqual(foodCoverageAction(state), { kind: 'none' });
});

function overloadedTown(): GameState {
  const state = town();
  state.tick = 6000;
  state.buildings = [building('granary', 'granary', 1, 1), ...Array.from({ length: 15 }, (_, index) =>
    building(`home-${index}`, 'house', 5 + index * 2, 2))];
  state.houses = state.buildings.filter(b => b.kind === 'house').map((b, index) => ({
    buildingId: b.id, level: 3, residents: index === 14 ? 0 : 24, hasWater: true,
    breadStock: index >= 13 ? 0 : 3, lastServicedTick: index >= 13 ? 0 : state.tick,
    emptyFoodTicks: index === 13 ? 600 : 0, unmetRequirementTicks: 0,
  }));
  state.tiles = state.tiles.map(tile => ({ ...tile, buildingId: state.buildings.find(b =>
    tile.tx >= b.tx && tile.tx < b.tx + (b.kind === 'house' ? 1 : 2)
    && tile.ty >= b.ty && tile.ty < b.ty + (b.kind === 'house' ? 1 : 2))?.id ?? null }));
  return state;
}

test('Given persistent in-range starvation and overloaded dispatch When coverage is assessed Then a delivery recovery is requested', () => {
  const state = overloadedTown();
  assert.notEqual(foodCoverageAction(state).kind, 'none');
});

for (const reason of ['temporary-empty', 'new-vacant', 'understaffed', 'no-stock', 'sufficient-overlapping-providers'] as const) {
  test(`Given ${reason} When in-range delivery capacity is assessed Then no speculative storage is requested`, () => {
    const state = overloadedTown();
    if (reason === 'temporary-empty' || reason === 'new-vacant') state.houses = state.houses.map(h =>
      ({ ...h, emptyFoodTicks: 0, ...(reason === 'new-vacant' && h.breadStock === 0 ? { residents: 0 } : {}) }));
    if (reason === 'understaffed') state.buildings = state.buildings.map(b => ({ ...b, workers: 0 }));
    if (reason === 'no-stock') state.buildings = state.buildings.map(b => ({ ...b, inventory: {} }));
    if (reason === 'sufficient-overlapping-providers') {
      state.buildings.push(building('second', 'granary', 12, 4));
      state.tiles = state.tiles.map(t => t.tx >= 12 && t.tx < 14 && t.ty >= 4 && t.ty < 6 ? { ...t, buildingId: 'second' } : t);
    }
    assert.deepEqual(foodCoverageAction(state), { kind: 'none' });
  });
}

for (const outcome of ['active', 'no-delivery', 'unknown', 'delivered'] as const) {
  test(`Given ${outcome} granary observation When overload persists Then recovery waits for attributed delivery evidence`, () => {
    const state: GameState = { ...overloadedTown(), autoplayFoodObservation: {
      kind: 'granary', siteId: 'granary', placedTick: 4000, completedTick: 4500,
      observeUntilTick: outcome === 'active' ? 7000 : 5000,
      ...(outcome === 'unknown' ? {} : { outcome: {
        outputDelta: 0, deliveredBreadDelta: outcome === 'delivered' ? 1 : 0,
        starvingHomesDelta: 0, effective: outcome === 'delivered',
      } }),
    } };
    assert.equal(foodCoverageAction(state).kind === 'none', outcome !== 'delivered');
  });
}
