import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { sampleAutoplayDecision } from '../src/ui/autoplayDecisionCache';
import { shouldRetryAutoplayAfterMillReplenishment as retryAtCurrentMargin } from '../src/engine/autoplayMillReplenishment';
import { ARABLE_MARGIN_PERMILLE, withArableMargin, YEAR_RATION_PERMILLE } from '../src/engine/autoplayArable';
import { migrateStateV9ToV10 } from '../src/save/migrations/v9ToV10';
import { underPreK4Unlocks } from './preK4UnlockScenario';

// AF-13/AF-12: this natural fixture predates the arable-fields work order (a raw wheat_farm town, no zones), so
// it is migrated on load like an old save. Migration hands the new farmstead(s) zero workers (labour has not
// been reallocated since); the town was otherwise fully staffed, so that is corrected here rather than by
// running ticks (which would drift away from the exact captured replenishment moment the fixture exists for).
/**
 * F0-A (FP-6): the planner's year need now includes the winter ration (× 1.05). This town was planned for a year
 * without it, so at today's need its grain reads short and the food decision is `grain_short`, not the transport
 * block this retry is about. The retry is judged at the margin the town was planned with (1.2 ÷ 1.05).
 */
const shouldRetryAutoplayAfterMillReplenishment = (previous: GameState, current: GameState): boolean =>
  withArableMargin(Math.floor(ARABLE_MARGIN_PERMILLE * 1000 / YEAR_RATION_PERMILLE), () => retryAtCurrentMargin(previous, current));

function naturalTown(): GameState {
  // Captured under the pre-K4-1 unlock table (church locked until stone town); see preK4UnlockScenario.ts.
  const raw: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/mill-replenishment-seed2-324000.json.gz', import.meta.url))).toString());
  const migrated = migrateStateV9ToV10(raw);
  const staffed = { ...migrated, buildings: migrated.buildings.map(b => b.kind === 'farmstead' ? { ...b, workers: 4 } : b) };
  return underPreK4Unlocks(staffed);
}

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
  // AF-13: migration drops a farm-tied legacy observation (the farm it watched no longer exists), so a live
  // observation is set up directly here rather than relying on one surviving from the raw natural fixture.
  const observing = { ...delivered, autoplayFoodObservation: {
    kind: 'granary' as const, siteId: 'watching', placedTick: delivered.tick - 10, observeUntilTick: delivered.tick + 120,
  } };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(start, observing), false);
});

for (const kind of ['farmstead', 'mill', 'granary'] as const) {
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
  // AF-13: same as above, a fresh observation stands in for the migration-dropped legacy one.
  const observing = { ...start, autoplayFoodObservation: {
    kind: 'granary' as const, siteId: 'watching', placedTick: start.tick - 10, observeUntilTick: start.tick + 1,
  } };
  assert.equal(shouldRetryAutoplayAfterMillReplenishment(observing, advanceTick(observing)), true);
});
