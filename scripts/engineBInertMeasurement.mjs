import assert from 'node:assert/strict';

export function summarizeInertAnnualHeavy(score) {
  const scope = score.scope;
  assert.deepEqual(scope.seeds, [1, 2, 3], 'Expected three-seed cohort');
  assert.equal(scope.yearsPerSeed, 125);
  assert.equal(scope.endYearExclusive - scope.startYear, 125);
  assert.equal(scope.endTick, 500000);
  assert.equal(scope.ticksPerSeason, 1000);
  assert.equal(scope.horizonTicks, 12000);
  const counts = new Map(scope.seeds.map(seed => [seed, Array(125).fill(0)])), identities = new Set();
  for (const answer of score.answers) {
    assert.ok(counts.has(answer.seed), 'Unexpected answer seed');
    assert.ok(Number.isSafeInteger(answer.tick) && answer.tick >= 0 && answer.tick < scope.endTick, 'Answer tick outside cohort');
    assert.ok(typeof answer.historyId === 'string' && answer.historyId.length > 0, 'Answer ID missing');
    const identity = `${answer.seed}:${answer.historyId}`;
    assert.ok(!identities.has(identity), 'duplicate answer'); identities.add(identity);
    counts.get(answer.seed)[Math.floor(answer.tick / (4 * scope.ticksPerSeason))] += 1;
  }
  const stats = values => {
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return { total: values.reduce((a, b) => a + b, 0), median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, max: Math.max(...values) };
  };
  const bySeed = scope.seeds.map(seed => ({ seed, startYear: scope.startYear, counts: counts.get(seed), ...stats(counts.get(seed)) }));
  return { definition: 'All classified heavy answers, including immature answers; zero-filled calendar years; pooled seed-years.',
    bySeed, pooled: { seedYears: 375, ...stats(bySeed.flatMap(row => row.counts)) } };
}

export function compareInertAnnualHeavy(baseline, current) {
  const compare = (old, next) => ({ baseline: old, current: next,
    delta: Object.fromEntries(['total', 'median', 'max'].map(key => [key, next[key] - old[key]])),
    pass: next.median <= old.median && next.max <= old.max });
  assert.deepEqual(baseline.bySeed.map(row => row.seed), [1, 2, 3]);
  assert.deepEqual(current.bySeed.map(row => row.seed), [1, 2, 3]);
  return { bySeed: current.bySeed.map((row, index) => ({ seed: row.seed, ...compare(baseline.bySeed[index], row) })),
    pooled: compare(baseline.pooled, current.pooled) };
}

/** Gameplay and decision-volume gates are independent of the retained legacy trace score. */
export function evaluateInertGate(report, annualHeavy) {
  const category = summary => ({ visible: summary.finalGate, inert: summary.fourCategories.b,
    pass: summary.finalGate.pass && summary.fourCategories.b === 0 });
  assert.deepEqual(report.bySeed.map(row => row.seed), [1, 2, 3]);
  const bySeed = report.bySeed.map(row => {
    const annual = annualHeavy.bySeed.find(item => item.seed === row.seed);
    assert.ok(annual, 'Missing annual comparison seed');
    return { seed: row.seed, categories: category(row), annualPass: annual.pass,
      pass: category(row).pass && annual.pass };
  });
  const pooled = { categories: category(report.summary), annualPass: annualHeavy.pooled.pass,
    pass: category(report.summary).pass && annualHeavy.pooled.pass };
  return { criterion: 'visible_at_least_80_percent_and_zero_inert_and_annual_median_max_nonincrease',
    bySeed, pooled, pass: bySeed.every(row => row.pass) && pooled.pass,
    excludes: ['nonlord_guardrail_hashes', 'ten_designated_event_tests', 'render_acceptance'] };
}
