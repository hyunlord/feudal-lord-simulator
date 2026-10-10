import assert from 'node:assert/strict';
import test from 'node:test';
import { newGameState } from '../src/state/newGame';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
const tools = await import(new URL('../scripts/engineBInertMeasurement.mjs', import.meta.url).href);
const producer = await import('../scripts/engineBOutcomeProduce');

test('annual heavy counts include empty years and immature answers in the authentic cohort', () => {
  const score = { scope: { seeds: [1, 2, 3], yearsPerSeed: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000, ticksPerSeason: 1000, horizonTicks: 12000 },
    answers: [{ seed: 1, tick: 0, historyId: 'a' }, { seed: 1, tick: 499999, historyId: 'b' }, { seed: 2, tick: 4000, historyId: 'c' }] };
  const result = tools.summarizeInertAnnualHeavy(score);
  assert.equal(result.bySeed[0].counts.length, 125);
  assert.equal(result.bySeed[0].counts[124], 1);
  assert.equal(result.bySeed[0].median, 0);
  assert.equal(result.bySeed[2].total, 0);
  assert.equal(result.pooled.total, 3);
  assert.equal(result.pooled.max, 1);
});

test('annual heavy tally refuses duplicate answers and out-of-window ticks', () => {
  const scope = { seeds: [1, 2, 3], yearsPerSeed: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000, ticksPerSeason: 1000, horizonTicks: 12000 };
  assert.throws(() => tools.summarizeInertAnnualHeavy({ scope, answers: [{ seed: 1, tick: 500000, historyId: 'a' }] }), /tick/);
  assert.throws(() => tools.summarizeInertAnnualHeavy({ scope, answers: [{ seed: 1, tick: 1, historyId: 'a' }, { seed: 1, tick: 2, historyId: 'a' }] }), /duplicate/);
});

test('passive command observer preserves states and rejects mutation before acceptance', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }); assert.ok(state);
  const before = JSON.stringify(state);
  producer.observeOutcomeCommand(undefined, state, state, { type: 'order_timber', amount: 0 }, 1);
  assert.equal(JSON.stringify(state), before);
  const observer = () => { state.tick += 1; };
  assert.throws(() => producer.observeOutcomeCommand(observer, state, state, { type: 'order_timber', amount: 0 }, 1), /observer mutated/);
});

test('annual comparison retains independent old/new cohorts rather than matching answer IDs', () => {
  const annual = { bySeed: [{ seed: 1, total: 6, median: 1, max: 3 }, { seed: 2, total: 3, median: 0, max: 2 }, { seed: 3, total: 7, median: 0, max: 2 }], pooled: { total: 16, median: 0, max: 3 } };
  const baseline = { bySeed: [{ seed: 1, total: 245, median: 2, max: 5 }, { seed: 2, total: 282, median: 2, max: 6 }, { seed: 3, total: 309, median: 3, max: 6 }], pooled: { total: 836, median: 2, max: 6 } };
  const comparison = tools.compareInertAnnualHeavy(baseline, annual);
  assert.equal(comparison.bySeed[0].delta.total, -239);
  assert.equal(comparison.bySeed[0].delta.median, -1);
  assert.equal(comparison.pooled.delta.max, -3);
});

test('EB-INERT gate rejects inert answers or increased annual maxima even with sufficient visibility', () => {
  const summary = { finalGate: { pass: true, numerator: 90, denominator: 100 }, fourCategories: { b: 0 } };
  const report = { summary, bySeed: [1, 2, 3].map(seed => ({ seed, ...structuredClone(summary) })) };
  const annual = { bySeed: [1, 2, 3].map(seed => ({ seed, pass: true })), pooled: { pass: true } };
  assert.equal(tools.evaluateInertGate(report, annual).pass, true);
  const second = report.bySeed[1]; assert.ok(second); second.fourCategories.b = 1;
  assert.equal(tools.evaluateInertGate(report, annual).pass, false);
  second.fourCategories.b = 0;
  const third = annual.bySeed[2]; assert.ok(third); third.pass = false;
  assert.equal(tools.evaluateInertGate(report, annual).pass, false);
  third.pass = true; report.summary.finalGate.pass = false;
  assert.equal(tools.evaluateInertGate(report, annual).pass, false);
});
