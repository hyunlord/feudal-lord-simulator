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
