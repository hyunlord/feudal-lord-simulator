import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { migrateStateV9ToV10 } from '../src/save/migrations/v9ToV10';
import type { GameState } from '../src/engine/engine.types';
import { clearAutoplayServiceProofMemo, preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from '../src/engine/autoplayServiceSpace';
import { runAutoplaySearch, runAutoplaySearchPhase, type SearchDiagnosticCollector } from '../src/engine/autoplaySearchBudget';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';

function natural(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-market/seed1-564000.json.gz', import.meta.url))).toString('utf8'));
}

test('Given natural seed1 after palisade completion When the advisor must establish its first market Then a legal action progresses under the original phase budget', () => {
  clearAutoplayServiceProofMemo();
  // AF-13/v10: the captured save predates the wheat-farm retirement, so it is migrated (as a real load would)
  // before the advisor decides; otherwise its 18 legacy wheat farms count as zero farmsteads and the advisor
  // reaches for a grain action instead of establishing the market this proof is about.
  const state = migrateStateV9ToV10(natural());
  const diagnostic: FoodDiagnosticCollector = {};
  const action = decideNextAction(state, { maxHousingLots: 24 }, diagnostic);
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command, JSON.stringify(diagnostic));
  const next = gameReducer(state, command);
  assert.notEqual(next, state);
  assert.ok(action.kind === 'place_road' || action.kind === 'place_building' && action.building === 'market');
  const warm: FoodDiagnosticCollector = {};
  assert.deepEqual(decideNextAction(migrateStateV9ToV10(natural()), { maxHousingLots: 24 }, warm), action);
  assert.deepEqual(warm, diagnostic);
});

test('Given three reachable markets consume the limited future slots When a shared joint plan is checked first Then impossible candidates leave room for a feasible market', () => {
  clearAutoplayServiceProofMemo(); resetAutoplayServiceSearch();
  const state = natural();
  const diagnostic: SearchDiagnosticCollector = {};
  const choices = runAutoplaySearch(() => runAutoplaySearchPhase(() => [[41, 18], [40, 18], [39, 17], [47, 44]].map(([tx, ty]) => {
    assert.ok(tx !== undefined && ty !== undefined);
    return preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'market', tx, ty });
  })), diagnostic);
  assert.deepEqual(choices, [false, false, false, true]);
  assert.equal(diagnostic.search?.reason, 'search_complete');
  assert.ok((diagnostic.search?.used ?? Infinity) <= 192);
});

test('Given only one proof step remains When a future market has not been fully proved Then no positive shortcut is exposed', () => {
  clearAutoplayServiceProofMemo(); resetAutoplayServiceSearch();
  assert.equal(runAutoplaySearch(() => preservesAutoplayServiceSpace(natural(), { kind: 'place_building', building: 'market', tx: 47, ty: 44 }), undefined, 1), false);
});
