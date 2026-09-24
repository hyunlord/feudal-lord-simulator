import assert from 'node:assert/strict';
import test from 'node:test';
import { createMillZeroWheatObservation } from '../scripts/efficientGrowthMillContinuity';
import { efficientGrowthMetrics } from '../scripts/efficientGrowthMetrics';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { building } from './helpers/autoplayFoodFixtures';

test('Given 2399 continuous zero-wheat ticks When wheat arrives Then no mill qualifies', () => {
  const observer = createMillZeroWheatObservation();
  for (let tick = 1; tick < 2400; tick += 1) observer.observe(tick, 1, [{ id: 'mill-a', wheat: 0 }]);
  observer.observe(2400, 1, [{ id: 'mill-a', wheat: 1 }]);
  assert.deepEqual(observer.report(), { known: true, stableTicks: 2400, millIds: [] });
});

test('Given exactly 2400 continuous zero-wheat ticks in stable growth When reported Then the mill qualifies', () => {
  const observer = createMillZeroWheatObservation();
  for (let tick = 1; tick <= 2400; tick += 1) observer.observe(tick, 1, [{ id: 'mill-a', wheat: 0 }]);
  assert.deepEqual(observer.report(), { known: true, stableTicks: 2400, millIds: ['mill-a'] });
  observer.observe(2401, 1, [{ id: 'mill-a', wheat: 3 }]);
  assert.deepEqual(observer.report().millIds, ['mill-a']);
});

test('Given a stability interruption When a new stable interval starts Then the earlier streak is discarded', () => {
  const observer = createMillZeroWheatObservation();
  for (let tick = 1; tick <= 2399; tick += 1) observer.observe(tick, 1, [{ id: 'mill-a', wheat: 0 }]);
  observer.observe(2400, null, [{ id: 'mill-a', wheat: 0 }]);
  for (let tick = 2401; tick <= 4800; tick += 1) observer.observe(tick, 2401, [{ id: 'mill-a', wheat: 0 }]);
  assert.deepEqual(observer.report(), { known: true, stableTicks: 2400, millIds: ['mill-a'] });
});

test('Given a missing tick or removed mill When reported Then no unsupported continuity is inferred', () => {
  const observer = createMillZeroWheatObservation();
  for (let tick = 1; tick <= 2399; tick += 1) observer.observe(tick, 1, [{ id: 'mill-a', wheat: 0 }]);
  observer.observe(2401, 1, [{ id: 'mill-a', wheat: 0 }]);
  assert.deepEqual(observer.report(), { known: false, stableTicks: 1, millIds: [] });
  for (let tick = 2402; tick <= 4800; tick += 1) observer.observe(tick, 2401, [{ id: 'mill-a', wheat: 0 }]);
  observer.observe(4801, 2401, []);
  assert.deepEqual(observer.report(), { known: true, stableTicks: 2400, millIds: [] });
});

test('Given a mill empty only in the final state When measured without tick history Then no chronic ratio is inferred', () => {
  const state = { ...DEFAULT_GAME_STATE, buildings: [building('mill-a', 'mill', 4, 4, 2)] };
  const result = efficientGrowthMetrics(state, createMillZeroWheatObservation().report());
  assert.equal(result.zeroWheatMillRatio, null);
  assert.equal(result.metrics.chronicZeroWheatKnown, false);
});
