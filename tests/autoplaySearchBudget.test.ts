import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { serviceCandidate, serviceFootprint, serviceTileKey } from '../src/engine/autoplayServiceSpaceRoutes';
import { searchBudgetedServicePlan } from '../src/engine/autoplayServiceBudget';
import { preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from '../src/engine/autoplayServiceSpace';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { computePalisadeProposalForState } from '../src/engine/palisadeFootprints';
import { decideNextAction } from '../src/engine/autoplay';
import type { GameState } from '../src/engine/engine.types';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { autoplaySearchExhausted, runAutoplaySearch, runAutoplaySearchPhase, spendAutoplaySearch } from '../src/engine/autoplaySearchBudget';

const fixture = (): GameState => JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/autoplay-search-budget/seed3-28080.json.gz', import.meta.url))).toString());

test('R-T16: seed 3 tick 28080 bounds search work and ignores previous cache history', () => {
  const state = fixture();
  const diagnostics: FoodDiagnosticCollector = {};
  const action = decideNextAction(state, { maxHousingLots: 24 }, diagnostics);
  // Strict <1 second is enforced by serial autoplaySearchReplay, not a contended test runner.
  assert.ok(diagnostics.search !== undefined && diagnostics.search.used <= diagnostics.search.limit);
  assert.equal(diagnostics.search?.reason, 'search_budget_hit');
  assert.deepEqual(decideNextAction(structuredClone(state), { maxHousingLots: 24 }), action);
  assert.deepEqual(decideNextAction(state, { maxHousingLots: 24 }), action);
});

test('search budget counts work, preserves best completed result and reports exhaustion', () => {
  const diagnostic: FoodDiagnosticCollector = {};
  const result = runAutoplaySearch(() => {
    assert.equal(spendAutoplaySearch(5), true);
    assert.equal(spendAutoplaySearch(6), false);
    assert.equal(spendAutoplaySearch(1), false);
    return 'best-complete-candidate';
  }, diagnostic, 10);
  assert.equal(result, 'best-complete-candidate');
  assert.equal(diagnostic.search?.reason, 'search_budget_hit');
});

test('exhausting food search cannot suppress a later housing or era search', () => {
  const results = runAutoplaySearch(() => [
    runAutoplaySearchPhase(() => { spendAutoplaySearch(192); return spendAutoplaySearch(); }),
    runAutoplaySearchPhase(() => spendAutoplaySearch()),
  ]);
  assert.deepEqual(results, [false, true]);
});

test('a truncated automatic wall query cannot truncate the later manual recommendation', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const expected = computePalisadeProposalForState(state);
  computePalisadeProposalForState(state, () => false, 0);
  assert.deepEqual(computePalisadeProposalForState(state), expected);
});

test('a local branch cutoff is unknown, never a cached proof that existing homes were impossible', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-normal-97560.json.gz', import.meta.url))).toString());
  const truncated = runAutoplaySearch(() => searchBudgetedServicePlan(state));
  assert.equal(truncated.witness, null);
  assert.equal(truncated.complete, false);
  resetAutoplayServiceSearch();
  const alternative = { kind: 'place_building', building: 'granary', tx: 61, ty: 41 } as const;
  assert.equal(runAutoplaySearch(() => preservesAutoplayServiceSpace(state, alternative)), false,
    'an unproven baseline does not permit an unproven projection');
  const proven = searchBudgetedServicePlan(state);
  assert.equal(proven.witness, null);
  assert.equal(proven.complete, true);
  assert.equal(preservesAutoplayServiceSpace(state, alternative), true,
    'truncated null/false answers must not poison the complete, safe legacy query');
});

test('service layout cache invalidates when an existing provider pauses or resumes', () => {
  const buildings = [serviceCandidate('house', { tx: 10, ty: 10 }, 'home'),
    serviceCandidate('storehouse', { tx: 8, ty: 10 }, 'source'),
    serviceCandidate('market', { tx: 12, ty: 9 }, 'market'),
    serviceCandidate('church', { tx: 12, ty: 12 }, 'church')];
  const owners = new Map(buildings.flatMap(building => serviceFootprint(building).map(tile => [serviceTileKey(tile), building.id] as const)));
  const state: GameState = { ...structuredClone(DEFAULT_GAME_STATE), width: 24, height: 24, buildings,
    treasuryTimber: 100, constructionSites: [], palisade: null,
    houses: [{ buildingId: 'home', level: 1, residents: 1, hasWater: true, breadStock: 10, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 576 }, (_, index) => {
      const tile = { tx: index % 24, ty: Math.floor(index / 24) };
      const buildingId = owners.get(serviceTileKey(tile)) ?? null;
      return { ...tile, terrain: 'grass', buildingId, hasRoad: buildingId === null && !(tile.tx === 16 && tile.ty === 10) };
    }) };
  const action = { kind: 'place_building', building: 'house', tx: 16, ty: 10 } as const;
  resetAutoplayServiceSearch();
  assert.equal(preservesAutoplayServiceSpace(state, action), true);
  const paused = { ...state, buildings: state.buildings.map(building => building.id === 'market' ? { ...building, operationPaused: true } : building) };
  assert.equal(preservesAutoplayServiceSpace(paused, action), false);
  assert.equal(preservesAutoplayServiceSpace(state, action), true);
});


test('a natural seed 4 food/storage shortage retains a legal recovery within the deterministic budget', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/autoplay-search-budget/seed4-120000.json.gz', import.meta.url))).toString());
  const diagnostic: FoodDiagnosticCollector = {};
  const action = decideNextAction(state, { maxHousingLots: 24 }, diagnostic);
  assert.notEqual(action.kind, 'none', 'proved reachable service pads must not be hidden by disconnected candidate pairs');
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command !== null);
  assert.notEqual(gameReducer(state, command), state, 'the actual game reducer must accept the recovery');
  assert.ok(diagnostic.search !== undefined && diagnostic.search.used <= diagnostic.search.limit);
  assert.deepEqual(decideNextAction(structuredClone(state), { maxHousingLots: 24 }), action);
});

test('an exhausted housing search stops reading further candidate tiles instead of scanning wall proposals', () => {
  const input = fixture();
  let readsAfterExhaustion = 0;
  const tiles = new Proxy(input.tiles, { get(target, property, receiver) {
    if (typeof property === 'string' && /^\d+$/.test(property) && autoplaySearchExhausted()) readsAfterExhaustion++;
    return Reflect.get(target, property, receiver);
  } });
  const action = decideNextAction({ ...input, tiles }, { maxHousingLots: 24 });
  assert.deepEqual(action, decideNextAction(input, { maxHousingLots: 24 }));
  assert.ok(readsAfterExhaustion <= 1, `only the next loop item may be read after exhaustion, saw ${readsAfterExhaustion}`);
});
