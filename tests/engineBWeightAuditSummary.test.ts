import assert from 'node:assert/strict';
import test from 'node:test';
import { annualStatistics, summarizeWeightAudit } from '../scripts/engineBWeightAuditSummary';
import { TRACE_LIVE_TICKS } from '../src/engine/decisionTrace';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import type { HistoryRecord } from '../src/engine/history.types';

const decision: TracedDecision = { id: 'h-1', tick: 0, by: 'lord', kind: 'registry', source: 'registry:ck_evt_001:yes', weights: ['rights'], targets: [] };
function record(id: string, tick: number): HistoryRecord {
  return { id, tick, kind: 'event', template: 'consequence', severity: 1, subject: { type: 'town', id: 'town' },
    because: [{ decisionId: decision.id, key: 'project_started', part: true }] };
}
test('annual statistics retain silent years and even medians', () => {
  assert.deepEqual(annualStatistics([0, 0, 2, 6]), { median: 1, maximum: 6, zeroYears: 2, aboveFourYears: 1, total: 8 });
});
test('duplicate IDs count once; same-tick receipts and out-of-window outcomes excluded', () => {
  const future = record('h-3', 1);
  const summary = summarizeWeightAudit({ startYear: 1300, years: 4, endTick: TRACE_LIVE_TICKS,
    decisions: [decision, decision], history: [record('h-2', 0), future, future, record('h-4', TRACE_LIVE_TICKS + 1)], reportKeys: [] });
  assert.equal(summary.wholeGame.total, 1);
  assert.equal(summary.wholeGame.zeroYears, 3);
  assert.equal(summary.trace.matureLord.withFutureConsequence, 1);
  assert.equal(summary.decisions[0]?.futureConsequenceCount, 1);
  assert.equal(summary.decisions[0]?.consequences[0]?.thisDecisionIsMain, true);
});
test('tail decisions are censored, not counted as mature failures', () => {
  const summary = summarizeWeightAudit({ startYear: 1300, years: 1, endTick: TRACE_LIVE_TICKS - 1,
    decisions: [decision], history: [], reportKeys: [] });
  assert.equal(summary.trace.matureLord.counted, 0);
  assert.equal(summary.trace.censoredLord.counted, 1);
  assert.equal(summary.trace.matureLord.fraction, null);
});
test('steward coverage requires exact source ID and report family membership', () => {
  const steward: TracedDecision = { ...decision, by: 'steward', weights: [] };
  const own: HistoryRecord = { ...record('h-1', 0), kind: 'decision', params: { subjectId: 'occ-1' } };
  const input = { startYear: 1300, years: 1, endTick: 1, decisions: [steward], history: [own] };
  assert.equal(summarizeWeightAudit({ ...input, reportKeys: ['petition:occ-1'] }).steward.inReport, 0);
  assert.equal(summarizeWeightAudit({ ...input, reportKeys: ['registry:occ-1'] }).steward.inReport, 1);
});
