import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { settleMarkets } from '../src/engine/marketSettlement';
import { createConstructionSite } from '../src/economy/construction';
import type { GameState } from '../src/engine/engine.types';

// R1 s6-market-sells-committed: same opening, market and keep; no output artifact dependency.
function fixture(stone: number): GameState {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const market = { id: 'market-48-39-probe', kind: 'market' as const, tx: 48, ty: 39,
    workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  return { ...state, tick: 80, era: 'stone_town',
    buildings: [...state.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { stone } } : b), market],
    tiles: state.tiles.map(t => (t.tx === 48 || t.tx === 49) && (t.ty === 39 || t.ty === 40)
      ? { ...t, buildingId: market.id } : t),
    constructionSites: [createConstructionSite({ ordinal: 1, kind: 'keep', tx: 30, ty: 30, startedTick: 0 })],
    nextConstructionOrdinal: 2 };
}
function settleThirty(state: GameState): GameState {
  for (let tick = 80; tick <= 2400; tick += 80) state = settleMarkets({ ...state, tick });
  return state;
}
function stoneStock(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (b.inventory.stone ?? 0), 0);
}
test('R-T12: thirty market cycles cannot sell stone committed to a keep', () => {
  const state = fixture(100);
  const result = settleThirty(state);
  assert.equal(stoneStock(result), 100);
  assert.equal(result.treasuryCoin, state.treasuryCoin);
});
test('R-T13: only the stone exceeding all construction demand may be sold', () => {
  const state = fixture(155);
  state.houses = [];
  const result = settleThirty(state);
  assert.equal(stoneStock(result), 150);
  // C2 (spec M-1): five surplus stones are traded out; the proceeds are the owners', not the treasury's.
  assert.equal(result.treasuryCoin - state.treasuryCoin, 0);
});
test('delivered and in-transit construction materials reduce the export reserve once', () => {
  const state = fixture(65);
  state.houses = [];
  state.constructionSites = state.constructionSites.map(site => ({ ...site, delivered: { stone: 70 }, reserved: { stone: 20 } }));
  assert.equal(stoneStock(settleThirty(state)), 60);
});
