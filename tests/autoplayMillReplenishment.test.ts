import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createAutoplayTraceDriver } from '../scripts/economyHarnessAutoplay';
import { decideNextAction } from '../src/engine/autoplay';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { sampleAutoplayDecision } from '../src/ui/autoplayDecisionCache';
import { shouldRetryAutoplayAfterMillReplenishment } from '../src/engine/autoplayMillReplenishment';

function naturalTown(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/mill-replenishment-seed2-324000.json.gz', import.meta.url))).toString());
}

test('natural seed 2 retries a none decision after actual mill replenishment before the next120tick pulse', () => {
  const start = naturalTown();
  const driver = createAutoplayTraceDriver({ id: 'mill-replenishment', source: 'a215dab seed2 tick324000', policy: { maxHousingLots: 24 } });
  assert.equal(driver.apply(start), start);
  const delivered = advanceTick(start);
  assert.ok(delivered.buildings.filter(b => b.kind === 'mill').every(b => (b.inventory.wheat ?? 0) > 0));
  const next = driver.apply(delivered);
  assert.ok(next.constructionSites.some(site => site.kind === 'mill' && site.startedTick === delivered.tick));
  assert.equal(driver.appliedActions.length, 1);
  let state = next;
  for (let n = 0; n < 119; n += 1) state = driver.apply(advanceTick(state));
  assert.equal(driver.appliedActions.length, 1);
});

test('the UI none cache refreshes for the same natural replenishment transition', () => {
  const start = naturalTown();
  const decide = (state: GameState) => decideNextAction(state, { maxHousingLots: 24 });
  const first = sampleAutoplayDecision(null, { state: start, enabled: true, pending: false }, decide);
  assert.equal(first.decision?.action.kind, 'none');
  const second = sampleAutoplayDecision(first, { state: advanceTick(start), enabled: true, pending: false }, decide, shouldRetryAutoplayAfterMillReplenishment);
  assert.equal(second.decision?.action.kind, 'place_building');
});

test('replenishment retry requires an existing transport bottleneck and the same mills', () => {
  const start = naturalTown();
  const delivered = advanceTick(start);
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, delivered), true);
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(delivered, advanceTick(delivered)), false);
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, { ...delivered, tick: start.tick }), false);
  const { autoplayFoodFlow: omittedFlow, ...unmeasured } = start;
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(unmeasured, delivered), false);
  const missingMill = { ...delivered, buildings: delivered.buildings.filter(b => b.kind !== 'mill' || b.id !== 'construction-site-000052') };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, missingMill), false);
  const understaffed = { ...delivered, buildings: delivered.buildings.map(b => b.kind === 'mill' ? { ...b, workers: 0 } : b) };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, understaffed), false);
});

test('UI replenishment does not replace a pending or previously selected action', () => {
  const start = naturalTown();
  const delivered = advanceTick(start);
  let calls = 0;
  const decide = () => { calls += 1; return { kind: 'place_building', building: 'mill', tx: 57, ty: 47 } as const; };
  const first = sampleAutoplayDecision(null, { state: start, enabled: true, pending: false }, decide);
  const selected = sampleAutoplayDecision(first, { state: delivered, enabled: true, pending: false }, decide, shouldRetryAutoplayAfterMillReplenishment);
  assert.equal(selected.decision, first.decision);
  const none = sampleAutoplayDecision(null, { state: start, enabled: true, pending: false }, () => ({ kind: 'none' }));
  const pending = sampleAutoplayDecision(none, { state: delivered, enabled: true, pending: true }, decide, shouldRetryAutoplayAfterMillReplenishment);
  assert.equal(pending.decision, none.decision);
  assert.equal(calls, 1);
});

test('actual mill replenishment does not retry while the current food observation is active', () => {
  const start = naturalTown();
  const delivered = advanceTick(start);
  assert.ok(delivered.autoplayFoodObservation);
  const observing = { ...delivered, autoplayFoodObservation: {
    ...delivered.autoplayFoodObservation, observeUntilTick: delivered.tick + 120,
  } };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, observing), false);
});

for (const kind of ['wheat_farm', 'mill', 'granary'] as const) {
  test(`actual mill replenishment does not retry while a ${kind} is under construction`, () => {
    const start = naturalTown();
    const delivered = advanceTick(start);
    const pending: GameState = { ...delivered, constructionSites: [...delivered.constructionSites, {
      id: 'pending-food', kind, tx: 57, ty: 47, required: { timber: 30 }, delivered: {}, reserved: {},
      builderTicks: 0, requiredBuilderTicks: 600, assignedBuilders: 0, stall: 'awaiting_materials', startedTick: start.tick,
    }] };
    assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, pending), false);
  });
}

test('a food observation ending on the actual replenishment tick permits retry', () => {
  const start = naturalTown();
  assert.ok(start.autoplayFoodObservation);
  const observing = { ...start, autoplayFoodObservation: {
    ...start.autoplayFoodObservation, observeUntilTick: start.tick + 1,
  } };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(observing, advanceTick(observing)), true);
});
