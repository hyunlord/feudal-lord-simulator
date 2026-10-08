import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRegistryGp7 } from '../scripts/registryGp7Summary';
import { summarizeRegistryDistribution } from '../scripts/registryDistributionSummary';
const range = { startYear: 1300, endYearExclusive: 1302 };
const decision = { id: 'd1', tick: 5, year: 1300, by: 'lord', kind: 'registry', source: 'registry:a:b', weights: ['rights'], targets: [], cameHeavyToLord: true };
const group = { year: 1301, kind: 'event', template: 'town.changed', count: 2,
  example: { id: 'h2', tick: 15, kind: 'event', template: 'town.changed', subject: { type: 'town', id: 'town' }, params: { count: 2 },
    because: [{ decisionId: 'd1', key: 'community_built' }] } };
const input = { schemaVersion: 1, meaning: 'resolved_or_lapsed_trace_tick_not_offer_arrival', calendar: { startYear: 1300, ticksPerYear: 10 },
  coverage: { firstTick: 0, lastTick: 20, observations: 21, maxGap: 1, timeReversals: 0 },
  decisions: [decision, { ...decision, id: 'd2', tick: 20, year: 1302, lapsed: true }], chronicle: [group,
    { ...group, kind: 'ledger', template: 'ledger.rollup', count: 1, example: { ...group.example, id: 'h3', kind: 'ledger', template: 'ledger.rollup' } }] };

test('measures resolved trace years with explicit boundaries and separate rollup evidence, never grants GP7 approval', () => {
  // Given: a boundary-year decision and ordinary/rollup chronicle evidence in a quiet year.
  // When: the versioned observation is summarized.
  const result = summarizeRegistryGp7(input, range);
  // Then: boundary decisions are excluded and quiet-year evidence is retained without a visibility claim.
  assert.equal(result.status, 'measured_not_adjudicated');
  assert.equal(result.coverage.status, 'complete');
  assert.equal(result.boundary.after.decisions, 1);
  assert.equal(result.annual[0]?.resolvedHeavyToLord, 1);
  assert.equal(result.annual[1]?.quietByResolvedTrace, true);
  assert.equal(result.annual[1]?.chronicleRecords, 2);
  assert.equal(result.annual[1]?.rollupRecords, 1);
  assert.deepEqual(result.annual[1]?.evidence[0]?.example.because, group.example.because);
});

test('gaps, late starts, reversals and incomplete end coverage remain incomplete', () => {
  // Given / When: each sampling defect is reported separately.
  for (const change of [{ maxGap: 3 }, { firstTick: 1 }, { timeReversals: 1 }, { lastTick: 19 }]) {
    const result = summarizeRegistryGp7({ ...input, decisions: [decision], coverage: { ...input.coverage, ...change } }, range);
    // Then: incomplete observation never becomes a verdict or a confident quiet year.
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.annual[1]?.quietByResolvedTrace, null);
  }
});

test('rejects malformed versions, duplicate IDs/groups, inconsistent years and invalid evidence', () => {
  // Given: malformed externally supplied raw files.
  const malformed = [null, { ...input, schemaVersion: 2 }, { ...input, decisions: [decision, decision] },
    { ...input, chronicle: [group, group] }, { ...input, decisions: [{ ...decision, year: 1301 }] },
    { ...input, decisions: [{ ...decision, weights: [] }] },
    { ...input, decisions: [{ ...decision, weights: ['imagined'] }] },
    { ...input, decisions: [{ ...decision, tick: 30, year: 1303 }] },
    { ...input, chronicle: [{ ...group, count: 0 }] },
    { ...input, chronicle: [{ ...group, example: { ...group.example, params: { bad: {} } } }] },
    { ...input, coverage: { ...input.coverage, observations: 1 } }];
  // When / Then: invalid inputs fail instead of silently dropping data.
  for (const raw of malformed) assert.throws(() => summarizeRegistryGp7(raw, range));
});

test('legacy summary retains its exact not-evaluated object while new raw data opts into measurement', () => {
  // Given: identical registry data, with and without the optional new observation.
  const run = { ...range, occurrences: [] };
  // When: each summary is built.
  const oldResult = summarizeRegistryDistribution(run, { catalog: [] });
  const newResult = summarizeRegistryDistribution({ ...run, gp7Observation: input }, { catalog: [] });
  // Then: old reports stay exact; the new path is explicitly observational.
  assert.equal(JSON.stringify(oldResult.gp7), '{"status":"not_evaluated","reason":"Heavy-decision weight tags and quiet-year world-change evidence are not provided; empty years are not a failure gate."}');
  assert.equal(newResult.gp7.status, 'measured_not_adjudicated');
});


test('empty new-engine observation remains incomplete without pretending weight tags are unavailable', () => {
  // Given: a collector not sampled yet, unlike a legacy raw file lacking this field.
  const empty = { ...input, calendar: null, coverage: { firstTick: null, lastTick: null, observations: 0, maxGap: 0, timeReversals: 0 }, decisions: [], chronicle: [] };
  // When: it is summarized.
  const result = summarizeRegistryGp7(empty, range);
  // Then: the schema is recognized, but coverage and quiet years are unknown.
  assert.equal(result.status, 'measured_not_adjudicated');
  assert.equal(result.coverage.status, 'incomplete');
  assert.equal(result.annual[0]?.quietByResolvedTrace, null);
});
