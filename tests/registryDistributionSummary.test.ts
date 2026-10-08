import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summarizeRegistryDistribution } from '../scripts/registryDistributionSummary';

const options = { catalog: [{ id: 'known', category: 'town' }], enabledEntryIds: ['known', 'unseen'], legacyRange: { startYear: 1300, endYearExclusive: 1425 } };
const input = { occurrences: [{ entry: 'known', year: 1300, status: 'answered' }, { entry: 'unknown', year: 1381, status: 'lapsed' },
  { entry: 'known', year: 1425, status: 'offered' }], decisionsByYear: { 1300: 2 } };

test('range boundary, unknown category, and missing years remain explicit without inflating totals', () => {
  const result = summarizeRegistryDistribution(input, options);
  assert.ok(result);
  assert.equal(result.inRange.total, 2);
  assert.equal(result.boundary.after.total, 1);
  assert.equal(result.inRange.eras.reduce((sum, row) => sum + row.count, 0), 2);
  assert.equal(result.inRange.categories.reduce((sum, row) => sum + row.count, 0), 2);
  assert.deepEqual(result.inRange.unknownEntryIds, ['unknown']);
  assert.equal(result.density.length, 125);
  assert.deepEqual(result.density[1], { year: 1301, allCommands: 0, askedResponses: null, arrivedQueue: null });
  assert.equal(result.retention.status, 'unknown');
  assert.equal(result.gp7.status, 'not_evaluated');
  assert.deepEqual(result.support?.enabledNotObserved, ['unseen']);
  assert.deepEqual(result.support?.observedNotEnabled, ['unknown']);
});

test('modern three density metrics and complete archive stay separate from GP7 approval', () => {
  const result = summarizeRegistryDistribution({ ...input, startYear: 1300, endYearExclusive: 1425,
    annualDensity: [{ year: 1300, allCommands: 8, askedCommandResponses: 3, arrivedDecisionItems: 5 }],
    occurrenceRetention: { scope: 'entire_run_observed', observed: 3, openWhenLastObservedAndAbsent: 0 } }, options);
  assert.deepEqual(result.density[0], { year: 1300, allCommands: 8, askedResponses: 3, arrivedQueue: 5 });
  assert.equal(result.retention.status, 'complete');
  assert.equal(result.gp7.status, 'not_evaluated');
});

test('malformed counts and missing ranges are rejected; known retention loss is incomplete', () => {
  assert.throws(() => summarizeRegistryDistribution(input, { catalog: [] }));
  assert.throws(() => summarizeRegistryDistribution({ ...input, decisionsByYear: { 1300: -1 } }, options));
  assert.throws(() => summarizeRegistryDistribution({ ...input, occurrences: [{ entry: 'known', year: '1300', status: 'answered' }] }, options));
  const result = summarizeRegistryDistribution({ ...input, registryOffers: 500 }, options);
  assert.equal(result.retention.status, 'incomplete');
});

test('actual legacy v4e seed3 keeps 1425 outside both era and category totals', () => {
  const raw: unknown = JSON.parse(readFileSync('docs/verification/lm-e9b/runs/v4e-run-3.json', 'utf8'));
  const result = summarizeRegistryDistribution(raw, { catalog: [], legacyRange: options.legacyRange });
  assert.equal(result.inRange.total, 73);
  assert.equal(result.boundary.after.total, 1);
  assert.equal(result.retention.status, 'unknown');
  assert.equal(result.support, null);
});


test('no fabricated known-category counts; duplicate identities and contradictory totals reject', () => {
  const result = summarizeRegistryDistribution(input, { ...options, catalog: [...options.catalog, { id: 'absent', category: 'church' }] });
  assert.equal(result.inRange.categories.some(row => row.category === 'church'), false);
  assert.deepEqual(result.inRange.categories, [{ category: 'town', count: 1 }, { category: null, count: 1 }]);
  assert.throws(() => summarizeRegistryDistribution({ ...input, registryOffers: 1 }, options));
  assert.throws(() => summarizeRegistryDistribution({ ...input, occurrences: input.occurrences.map(row => ({ ...row, id: 'same' })) }, options));
  assert.throws(() => summarizeRegistryDistribution({ ...input, startYear: 1300 }, options));
});

test('missing modern years are unknown even with legacy counts, while explicit zero rows stay zero', () => {
  const result = summarizeRegistryDistribution({ ...input, decisionsByYear: { 1301: 9 }, annualDensity: [
    { year: 1300, allCommands: 0, askedCommandResponses: 0, arrivedDecisionItems: 0 },
    { year: 1302, allCommands: 2, askedCommandResponses: 1, arrivedDecisionItems: 3 },
  ] }, options);
  assert.deepEqual(result.density[0], { year: 1300, allCommands: 0, askedResponses: 0, arrivedQueue: 0 });
  assert.deepEqual(result.density[1], { year: 1301, allCommands: null, askedResponses: null, arrivedQueue: null });
  assert.deepEqual(result.density[2], { year: 1302, allCommands: 2, askedResponses: 1, arrivedQueue: 3 });
  assert.equal(result.density.length, 125);
});

test('asked responses cannot exceed all commands; arrived queue is an independent count', () => {
  assert.throws(() => summarizeRegistryDistribution({ ...input, annualDensity: [
    { year: 1300, allCommands: 1, askedCommandResponses: 2, arrivedDecisionItems: 3 },
  ] }, options), /askedCommandResponses exceeds allCommands/);
});
