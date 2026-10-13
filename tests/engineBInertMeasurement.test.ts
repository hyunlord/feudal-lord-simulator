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
  const annual = { bySeed: [{ seed: 1, total: 6, median: 1, max: 3, yearsAboveFour: 0 }, { seed: 2, total: 3, median: 0, max: 2, yearsAboveFour: 0 }, { seed: 3, total: 7, median: 0, max: 2, yearsAboveFour: 0 }], pooled: { total: 16, median: 0, max: 3, yearsAboveFour: 0 } };
  const baseline = { bySeed: [{ seed: 1, total: 245, median: 2, max: 5, yearsAboveFour: 8 }, { seed: 2, total: 282, median: 2, max: 6, yearsAboveFour: 9 }, { seed: 3, total: 309, median: 3, max: 6, yearsAboveFour: 9 }], pooled: { total: 836, median: 2, max: 6, yearsAboveFour: 26 } };
  const comparison = tools.compareInertAnnualHeavy(baseline, annual);
  assert.equal(comparison.bySeed[0].delta.total, -239);
  assert.equal(comparison.bySeed[0].delta.median, -1);
  assert.equal(comparison.pooled.delta.max, -3);
});

test('EB-INERT pooled gate rejects inert answers but treats per-seed maxima as diagnostic', () => {
  const summary = { finalGate: { pass: true, numerator: 90, denominator: 100 }, fourCategories: { b: 0 } };
  const report = { summary, bySeed: [1, 2, 3].map(seed => ({ seed, ...structuredClone(summary) })) };
  const annual = { bySeed: [1, 2, 3].map(seed => ({ seed, pass: true })), pooled: { pass: true } };
  assert.equal(tools.evaluateInertGate(report, annual).pass, true);
  const second = report.bySeed[1]; assert.ok(second); second.fourCategories.b = 1;
  assert.equal(tools.evaluateInertGate(report, annual).pass, false);
  second.fourCategories.b = 0;
  const third = annual.bySeed[2]; assert.ok(third); third.pass = false;
  assert.equal(tools.evaluateInertGate(report, annual).pass, true);
  third.pass = true; report.summary.finalGate.pass = false;
  assert.equal(tools.evaluateInertGate(report, annual).pass, false);
});


test('pooled comparison rejects the measured 864 answers and 27 crowded years', () => {
  const stats = (total: number, max: number, yearsAboveFour: number) => ({ total, median: 2, max, yearsAboveFour });
  const baseline = { bySeed: [1, 2, 3].map(seed => ({ seed, ...stats(278, 6, 8) })), pooled: stats(836, 6, 26) };
  const current = { bySeed: [1, 2, 3].map(seed => ({ seed, ...stats(288, 6, 9) })), pooled: stats(864, 6, 27) };
  const result = tools.compareInertAnnualHeavy(baseline, current);
  assert.equal(result.pooled.delta.total, 28);
  assert.equal(result.pooled.delta.yearsAboveFour, 1);
  assert.equal(result.pooled.pass, false);
  const generous = { ...baseline, pooled: stats(900, 6, 30) };
  assert.equal(tools.compareInertAnnualHeavy(generous, current).pooled.pass, false);
});

test('pooled gate permits opposite per-seed maximum shifts when all pooled bounds hold', () => {
  const row = (seed: number, max: number) => ({ seed, total: 200, median: 2, max, yearsAboveFour: 5 });
  const baseline = { bySeed: [row(1, 5), row(2, 6), row(3, 6)], pooled: { total: 836, median: 2, max: 6, yearsAboveFour: 26 } };
  const current = { bySeed: [row(1, 6), row(2, 6), row(3, 5)], pooled: { total: 600, median: 2, max: 6, yearsAboveFour: 15 } };
  const summary = { finalGate: { pass: true, numerator: 90, denominator: 100 }, fourCategories: { b: 0 } };
  const report = { summary, bySeed: [1, 2, 3].map(seed => ({ seed, ...summary })) };
  const annual = tools.compareInertAnnualHeavy(baseline, current);
  assert.equal(annual.bySeed[0].pass, false);
  assert.equal(tools.evaluateInertGate(report, annual).pass, true);
});

test('annual tally counts only calendar years with more than four decisions', () => {
  const scope = { seeds: [1, 2, 3], yearsPerSeed: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000, ticksPerSeason: 1000, horizonTicks: 12000 };
  const answers = Array.from({ length: 9 }, (_, index) => ({ seed: 1, tick: index < 4 ? 0 : 4000, historyId: String(index) }));
  const result = tools.summarizeInertAnnualHeavy({ scope, answers });
  assert.equal(result.bySeed[0].yearsAboveFour, 1);
  assert.equal(result.pooled.yearsAboveFour, 1);
});
