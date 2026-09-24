import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import type { GameState } from '../src/engine/engine.types';
import { clearAutoplayServiceProofMemo, autoplayServiceProofMemoStats, preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from '../src/engine/autoplayServiceSpace';
import { runAutoplaySearch, type SearchDiagnosticCollector } from '../src/engine/autoplaySearchBudget';

function natural(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-capacity/seed3-108000.json.gz', import.meta.url))).toString('utf8'));
}
const action = { kind: 'place_building', building: 'house', tx: 16, ty: 17 } as const;
function proof(state: GameState, limit: number) {
  resetAutoplayServiceSearch();
  const diagnostic: SearchDiagnosticCollector = {};
  const allowed = runAutoplaySearch(() => preservesAutoplayServiceSpace(state, action), diagnostic, limit);
  return { allowed, diagnostic };
}
function decision(state: GameState) {
  const diagnostic: FoodDiagnosticCollector = {};
  return { action: decideNextAction(state, { maxHousingLots: 24 }, diagnostic), diagnostic };
}

test('Given a repeated natural layout When complete proofs are memoized Then full advisor action and diagnostic preserve their cold budget cost', () => {
  clearAutoplayServiceProofMemo();
  const cold = decision(natural());
  const warm = decision(natural());
  assert.deepEqual(warm, cold);
  assert.ok(autoplayServiceProofMemoStats().hits > 0);
  clearAutoplayServiceProofMemo();
  assert.deepEqual(decision(natural()), cold);
});

test('Given a warm completed proof When remaining budget varies across its exact cost Then cold and replayed cutoffs match', () => {
  clearAutoplayServiceProofMemo();
  const full = proof(natural(), 192);
  const cost = full.diagnostic.search?.used;
  assert.ok(cost);
  for (const limit of [0, 1, 6, 7, cost - 1, cost, cost + 1]) {
    clearAutoplayServiceProofMemo();
    const cold = proof(natural(), limit);
    clearAutoplayServiceProofMemo();
    proof(natural(), 192);
    assert.deepEqual(proof(natural(), limit), cold, `remaining work ${limit}`);
  }
});

test('Given an incomplete or unbounded proof When a later bounded search runs Then no uncharged answer leaks across decisions', () => {
  clearAutoplayServiceProofMemo();
  const cold = proof(natural(), 192);
  clearAutoplayServiceProofMemo();
  proof(natural(), 1);
  assert.deepEqual(proof(natural(), 192), cold);
  clearAutoplayServiceProofMemo();
  resetAutoplayServiceSearch();
  preservesAutoplayServiceSpace(natural(), action);
  assert.equal(autoplayServiceProofMemoStats().entries, 0);
  assert.deepEqual(proof(natural(), 192), cold);
});

test('Given building order or stock-derived supply sources change When another layout was warmed Then each ordering keeps its own cold answer and diagnostic', () => {
  const original = natural();
  const variants: GameState[] = [
    { ...original, buildings: [...original.buildings].reverse(), houses: [...original.houses].reverse() },
    { ...original, treasuryTimber: 0, buildings: original.buildings.map(building => ({ ...building, inventory: {} })) },
    { ...original, buildings: original.buildings.map((building, index) => index === 0 ? { ...building, operationPaused: true } : building) },
    { ...original, tiles: original.tiles.map(tile => tile.tx === 16 && tile.ty === 17 ? { ...tile, hasRoad: true } : tile) },
  ];
  for (const state of variants) {
    clearAutoplayServiceProofMemo();
    const cold = proof(state, 192);
    clearAutoplayServiceProofMemo();
    proof(original, 192);
    assert.deepEqual(proof(state, 192), cold);
  }
});

test('Given unchanged structural sources When stocks, staffing and house status change Then warm and cold structural proof remain equivalent', () => {
  const original = natural();
  const changed: GameState = { ...original, tick: original.tick + 120,
    houses: original.houses.map(house => ({ ...house, residents: 0, level: 0, breadStock: 0 })),
    buildings: original.buildings.map(building => ({ ...building, workers: 0,
      inventory: Object.fromEntries(Object.entries(building.inventory).map(([resource, amount]) => [resource, (amount ?? 0) * 2])) })) };
  clearAutoplayServiceProofMemo();
  const cold = proof(changed, 192);
  clearAutoplayServiceProofMemo();
  proof(original, 192);
  assert.deepEqual(proof(changed, 192), cold);
  assert.ok(autoplayServiceProofMemoStats().hits > 0);
});

test('Given reordered states share one decision When proofs are reused across calls Then later cold and warm advisor costs stay identical', () => {
  const state = natural();
  const reversed = { ...state, buildings: [...state.buildings].reverse() };
  const mixed = (first: GameState, second: GameState) => {
    resetAutoplayServiceSearch();
    const diagnostic: SearchDiagnosticCollector = {};
    const allowed = runAutoplaySearch(() => [preservesAutoplayServiceSpace(first, action), preservesAutoplayServiceSpace(second, action)], diagnostic, 1920);
    return { allowed, diagnostic };
  };
  for (const [first, second] of [[state, reversed], [reversed, state]]) {
    assert.ok(first && second);
    clearAutoplayServiceProofMemo();
    const cold = mixed(first, second);
    const warm = mixed(first, second);
    assert.deepEqual(warm, cold);
    const afterMixed = decision(second);
    clearAutoplayServiceProofMemo();
    assert.deepEqual(afterMixed, decision(second));
  }
});

test('Given many distinct layouts When completed proofs are retained Then persistent memo occupancy remains bounded', () => {
  clearAutoplayServiceProofMemo();
  const base = natural();
  for (let width = 4; width < 44; width++) {
    const state: GameState = { ...base, width, height: 4, buildings: [], houses: [], constructionSites: [], palisade: null,
      tiles: Array.from({ length: width * 4 }, (_, index) => ({ tx: index % width, ty: Math.floor(index / width), terrain: 'grass', hasRoad: false, buildingId: null })) };
    resetAutoplayServiceSearch();
    assert.equal(runAutoplaySearch(() => preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'well', tx: 1, ty: 1 })), true);
  }
  assert.equal(autoplayServiceProofMemoStats().layouts, 32);
});
