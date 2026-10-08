import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateHistoricalReference } from '../scripts/engineBHistoricalReference.mjs';
import { createHistoricalObservations } from '../scripts/engineBHistoricalObservations.mjs';
const reference = validateHistoricalReference(Object.fromEntries(Object.entries({ runGzip: 'run-1', reportGzip: 'report-1', contextGzip: 'context' }).map(([key, name]) => [key, readFileSync(new URL(`../docs/verification/lm-e9c-final/distribution/${name}.json.gz`, import.meta.url))])));
const ids = reference.absentEntryIds;
const candidate = (gate, tick = 1000, entryId = ids[0]) => ({ scope: 'candidate', gate, tick, entryId, enabledChoices: null, enabledChoicesObserved: false, choiceEvaluationReached: gate === 'accepted' || gate === 'enabled_choices' });
test('empty stream preserves all forty unknown rows and no acceptance claim', () => {
  const result = createHistoricalObservations(ids).snapshot();
  assert.deepEqual(result.rows.map(row => row.entryId), ids);
  assert.equal(result.records, 0);
  for (const row of result.rows) { assert.equal(row.records, 0); assert.equal(row.firstTick, null); assert.equal(row.lastTick, null); }
  for (const key of ['applicabilityAllowed', 'fullStateComparable', 'originalRuntimeVerified']) assert.equal(result[key], false);
  assert.equal('valid' in result, false);
});
test('multiple observed gates remain record counts with min/max ticks, not inferred causes', () => {
  const acc = createHistoricalObservations(ids);
  acc.observe(candidate('chance', 3000)); acc.observe(candidate('binding_or_context', 1000)); acc.observe(candidate('accepted', 2000));
  acc.observe({ scope: 'v4_selection', gate: 'ordered_candidate', tick: 2000, entryId: ids[0], position: 0, weight: 2, rangeFrom: 0, rangeTo: 2, total: 5, initialPick: 3 });
  acc.observe({ scope: 'v4_outer', gate: 'chosen', tick: 4000, entryId: ids[0] });
  acc.observe({ scope: 'v4_outer', gate: 'constructed_offer', tick: 4000, entryId: ids[0], offeredId: 'offer-1' });
  acc.observe({ scope: 'layer', gate: 'crowded_rejected', tick: 4000, entryId: ids[0], offeredId: 'offer-1' });
  const row = acc.snapshot().rows[0];
  assert.deepEqual([row.records, row.firstTick, row.lastTick], [7, 1000, 4000]);
  assert.deepEqual([row.acceptedCandidateRecords, row.orderedCandidateRecords, row.chosenRecords, row.constructedOfferRecords, row.layerRecords], [1, 1, 1, 1, 1]);
  assert.equal(row.gateCounts['candidate.binding_or_context'], 1);
  assert.equal(row.gateCounts['layer.crowded_rejected'], 1);
  assert.equal(row.enabledChoiceCountObserved, false);
});
test('outer skips stay global and non-target entries cannot become forty target diagnoses', () => {
  const acc = createHistoricalObservations(ids);
  acc.observe({ scope: 'v4_outer', gate: 'budget', tick: 1000 });
  acc.observe({ scope: 'v4_outer', gate: 'legacy_suppressed', tick: 2000, chosenIdsJson: JSON.stringify([ids[0]]) });
  acc.observe(candidate('support', 2000, 'ck_evt_999'));
  const result = acc.snapshot();
  assert.equal(result.global.records, 2); assert.equal(result.nonTarget.records, 1);
  assert.equal(result.global.gateCounts['v4_outer.legacy_suppressed'], 1);
  assert.equal(result.rows.reduce((sum, row) => sum + row.records, 0), 0);
});
test('legacy chosen and constructed records keep distinct scope and repeated records are not deduplicated', () => {
  const acc = createHistoricalObservations(ids), record = { scope: 'legacy_selection', gate: 'constructed_offer', tick: 1000, entryId: ids[0], offeredId: 'legacy-1' };
  acc.observe(record); acc.observe(record);
  const row = acc.snapshot().rows[0];
  assert.equal(row.constructedOfferRecords, 2); assert.equal(row.gateCounts['legacy_selection.constructed_offer'], 2);
});
test('invalid schema and unknown scope/gate reject atomically', () => {
  const acc = createHistoricalObservations(ids);
  for (const record of [null, [], {}, { ...candidate('chance'), tick: -1 }, { ...candidate('chance'), tick: Infinity },
    { ...candidate('chance'), nested: {} }, candidate('invented'), { ...candidate('chance'), scope: 'invented' },
    { ...candidate('chance'), entryId: undefined }, { ...candidate('chance'), enabledChoicesObserved: true },
    { scope: 'layer', gate: 'heavy_admitted', tick: 1000, entryId: ids[0] },
    { scope: 'v4_outer', gate: 'budget', tick: 1000, entryId: ids[0] }]) assert.throws(() => acc.observe(record));
  assert.equal(acc.snapshot().records, 0);
});
test('target list must have forty unique canonical IDs', () => {
  for (const list of [[], ids.slice(1), [...ids.slice(1), ids[1]], [...ids.slice(1), 'bad']]) assert.throws(() => createHistoricalObservations(list));
});
test('snapshots and caller mutation cannot alter future counters', () => {
  const list = [...ids], acc = createHistoricalObservations(list), record = candidate('chance');
  acc.observe(record); record.tick = 999; list[0] = 'changed';
  const snapshot = acc.snapshot(); snapshot.rows[0].gateCounts['candidate.chance'] = 99;
  assert.equal(acc.snapshot().rows[0].gateCounts['candidate.chance'], 1);
  assert.equal(acc.snapshot().rows[0].firstTick, 1000);
});
test('selection payload errors and malformed JSON leave earlier counters unchanged', () => {
  const acc = createHistoricalObservations(ids); acc.observe(candidate('chance'));
  const before = acc.snapshot();
  const ordered = { scope: 'v4_selection', gate: 'ordered_candidate', tick: 1000, entryId: ids[0], position: 0, weight: 2, rangeFrom: 0, rangeTo: 2, total: 5, initialPick: 3 };
  for (const record of [{ ...ordered, rangeTo: 4 }, { ...ordered, position: -1 }, { ...ordered, initialPick: 5 },
    { scope: 'v4_outer', gate: 'legacy_suppressed', tick: 1000, chosenIdsJson: '{' }]) assert.throws(() => acc.observe(record));
  assert.deepEqual(acc.snapshot(), before);
});
test('legacy noncanonical IDs and disabled IDs are legitimate non-target records', () => {
  const acc = createHistoricalObservations(ids);
  acc.observe({ scope: 'legacy_selection', gate: 'chosen', tick: 1000, entryId: 'legacy:market-fair' });
  acc.observe(candidate('support', 1000, 'ck_evt_001'));
  assert.equal(acc.snapshot().nonTarget.records, 2);
  assert.equal(acc.snapshot().rows.length, 40);
});
