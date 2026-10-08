import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRegistryAnswers } from '../scripts/engineBRegistryAnswerAudit.mjs';

function fixture() {
  return { startYear: 1300, years: 5, endTick: 20000, support: { enabledIds: ['ck_evt_038'] },
    occurrences: [{ id: 'offer', entryId: 'ck_evt_038', boundId: 'suit-1', offeredTick: 1000,
      settledTick: 2000, status: 'answered', choiceId: 'enforce', weights: ['land'] }],
    history: [{ id: 'answer', tick: 2000, kind: 'decision', template: 'decision.card',
      params: { subjectId: 'offer', command: 'answer_registry_offer', decisionKind: 'registry', chosen: 'enforce' } }], decisions: [] };
}
const receipt = (id, tick, decisionId) => ({ id, tick, kind: 'event', because: [{ decisionId, key: 'suit_rent' }] });
const root = id => ({ id, tick: 500, lastTick: 2000, by: 'lord', kind: 'registry', source: 'registry:ck_evt_009:c',
  also: ['registry:ck_evt_038:enforce'], targets: ['suit:suit-1'] });

test('unique answer history joins deduplicate identical identities and fail closed on missing or ambiguous joins', () => {
  const run = fixture(); run.history.push(structuredClone(run.history[0]));
  assert.equal(summarizeRegistryAnswers(run).counts.lordAnswered, 1);
  run.history.push({ ...run.history[0], id: 'other' });
  assert.equal(summarizeRegistryAnswers(run).counts.lordAnswered, 0);
  assert.equal(summarizeRegistryAnswers(run).unresolved[0].reason, 'ambiguous_answer_history');
  run.history = [];
  assert.equal(summarizeRegistryAnswers(run).unresolved[0].reason, 'missing_answer_history');
  run.history = [{ id: 'x' }, { id: 'x', tick: 1 }];
  assert.throws(() => summarizeRegistryAnswers(run), /Conflicting history identity/);
});

test('merged candidates never credit earlier root receipts and separate direct from indirect evidence', () => {
  const run = fixture(); run.decisions = [root('root')];
  run.history.push(receipt('early', 1500, 'root'), receipt('later', 3000, 'root'));
  let result = summarizeRegistryAnswers(run);
  assert.equal(result.coverage.matureLord.directWithFuture, 0);
  assert.equal(result.coverage.matureLord.inferredRootWithFuture, 1);
  assert.deepEqual(result.answers[0].indirectFuture.map(row => row.id), ['later']);
  run.history.push(receipt('own', 4000, 'answer'));
  result = summarizeRegistryAnswers(run);
  assert.equal(result.coverage.matureLord.directWithFuture, 1);
  assert.equal(result.answers[0].rootInference.status, 'unique_candidate_not_canonical_membership');
  run.decisions.push(root('another'));
  result = summarizeRegistryAnswers(run);
  assert.equal(result.answers[0].rootInference.status, 'ambiguous');
  assert.deepEqual(result.answers[0].indirectFuture, []);
});

test('endpoint answers excluded, endpoint consequences included, censored answers separated, silent years retained', () => {
  const run = fixture(); run.occurrences[0].settledTick = 8000; run.history[0].tick = 8000;
  run.history.push(receipt('endpoint', 20000, 'answer'), receipt('beyond', 20001, 'answer'));
  let result = summarizeRegistryAnswers(run);
  assert.equal(result.coverage.matureLord.directWithFuture, 1);
  assert.equal(result.annualWeightedLordAnswers.zeroYears, 4);
  run.occurrences[0].settledTick = 8001; run.history[0].tick = 8001;
  result = summarizeRegistryAnswers(run);
  assert.equal(result.coverage.censoredLord.counted, 1);
  run.occurrences[0].settledTick = 20000; run.history[0].tick = 20000;
  assert.equal(summarizeRegistryAnswers(run).counts.lordAnswered, 0);
  assert.equal(summarizeRegistryAnswers(run).counts.excludedAnsweredSettlements, 1);
});

test('steward decisions, invalid and lapsed occurrences remain distinct from lord answers', () => {
  const run = fixture(); run.occurrences[0].decidedBy = 'steward';
  run.history[0].template = 'decision.steward'; delete run.history[0].params.command;
  run.occurrences.push({ id: 'invalid', entryId: 'ck_evt_038', offeredTick: 0, status: 'invalid' },
    { id: 'lapsed', entryId: 'ck_evt_038', offeredTick: 0, status: 'lapsed' });
  const before = JSON.stringify(run); const result = summarizeRegistryAnswers(run);
  assert.equal(result.counts.stewardAnswered, 1); assert.equal(result.counts.lordAnswered, 0);
  assert.equal(result.counts.invalid, 1); assert.equal(result.counts.lapsed, 1);
  assert.equal(JSON.stringify(run), before);
});
