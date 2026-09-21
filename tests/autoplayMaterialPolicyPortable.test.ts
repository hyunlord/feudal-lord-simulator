import assert from 'node:assert/strict';
import test from 'node:test';
import { materialPolicyTown, observedMaterialTown } from './autoplayMaterialPolicyFixtures';
import { materialBuildCandidate, materialRouteScore } from '../src/engine/autoplayMaterialCandidates';
import { materialRecoveryAction } from '../src/engine/autoplayMaterialRecovery';
import { decideNextAction } from '../src/engine/autoplay';
import { foodAction } from '../src/engine/autoplayFood';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';

test('Given different best-total and best-active incumbents Then an improving candidate cannot worsen the shortest active route', () => {
  const single = materialPolicyTown(), preferred = materialBuildCandidate(single, 'wall-a');
  assert.ok(preferred);
  const paired = materialPolicyTown(true), first = paired.buildings.find(home => home.id === 'incumbent');
  const second = paired.buildings.find(home => home.id === 'near-active');
  assert.ok(first && second);
  const a = materialRouteScore(paired, first, 'wall-a'), b = materialRouteScore(paired, second, 'wall-a');
  assert.ok(a && b);
  assert.ok(a.score < b.score);
  assert.ok(a.activeEdges > b.activeEdges);
  const score = materialRouteScore({ ...paired, buildings: [...paired.buildings, preferred.home], pathCache: {} }, preferred.home, 'wall-a');
  assert.ok(score);
  assert.ok(score.score < a.score);
  assert.ok(score.activeEdges <= a.activeEdges);
  assert.ok(score.activeEdges > b.activeEdges);
  assert.equal(materialBuildCandidate(paired, 'wall-a'), null);
  assert.equal(materialBuildCandidate({ ...paired, buildings: [...paired.buildings].reverse(), pathCache: {} }, 'wall-a'), null);
});

test('Given food NONE confirmation metadata When material placement wins Then advisor adapter and reducer preserve both records', () => {
  const state: GameState = { ...observedMaterialTown(), autoplayFoodTransientConfirmation: { status: 'pending', startedTick: 880,
    deadlineTick: 1120, evaluationTick: 1120, epoch: 'obsolete-fixture-epoch', firstWindowUntilTick: 880 } };
  const food = foodAction(state, () => assert.fail('Unexpected food building'));
  assert.equal(food.kind, 'none');
  assert.ok(food.foodTransient);
  assert.equal(materialRecoveryAction(state).kind, 'place_building');
  const action = decideNextAction(state, { maxHousingLots: 1 });
  assert.ok(action.kind === 'place_building' && action.building === 'masonry', JSON.stringify(action));
  assert.deepEqual(action.foodTransient, food.foodTransient);
  const command = autoplayActionToGameAction(action, state); assert.ok(command);
  const next = gameReducer(state, command);
  assert.equal(next.autoplayMaterialRecovery?.status, 'placed');
  assert.deepEqual(next.autoplayFoodTransientConfirmation, food.foodTransient);
});

test('Given a qualified cycle When ordinary placement succeeds or fails Then only successful construction spends the episode', () => {
  const state = observedMaterialTown(), action = materialRecoveryAction(state);
  assert.equal(action.kind, 'place_building');
  const command = autoplayActionToGameAction(action, state); assert.ok(command);
  const next = gameReducer(state, command), record = next.autoplayMaterialRecovery;
  assert.ok(record?.status === 'placed');
  assert.ok(next.constructionSites.some(site => site.id === record.attemptSiteId && site.kind === 'masonry'));
  assert.equal('opportunity' in record, false);
  assert.deepEqual(materialRecoveryAction(next), { kind: 'none' });
  const noTimber = { ...state, buildings: state.buildings.map(home => ({ ...home, inventory: { ...home.inventory, timber: 0 } })) };
  assert.equal(gameReducer(noTimber, command).autoplayMaterialRecovery?.status, 'observing');
});

test('Given a qualified cycle When production, stock claims or spare workforce prohibit expansion Then no material facility is proposed', () => {
  const state = observedMaterialTown(), record = state.autoplayMaterialRecovery;
  assert.ok(record?.status === 'observing' && record.completedCycle);
  const variants: GameState[] = [
    { ...state, autoplayMaterialRecovery: { ...record, completedCycle: { ...record.completedCycle, haulNoInputTicks: record.completedCycle.workingTicks } } },
    { ...state, constructionSites: state.constructionSites.map(site => ({ ...site, reserved: { ...site.reserved, stone: site.required.stone ?? 0 } })) },
    { ...state, buildings: state.buildings.map(home => ({ ...home, stockReserved: { ...home.stockReserved, stone_raw: home.inventory.stone_raw ?? 0 } })) },
    { ...state, idleWorkers: 2 },
    { ...state, buildings: state.buildings.map(home => ({ ...home, inventory: { ...home.inventory, stone: home.id === 'raw' ? 0 : 100 } })) },
  ];
  for (const variant of variants) assert.deepEqual(materialRecoveryAction(variant), { kind: 'none' });
});
