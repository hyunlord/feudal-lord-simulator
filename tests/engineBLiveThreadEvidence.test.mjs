import assert from 'node:assert/strict';
import test from 'node:test';
import { createTraceThreadEvidence, isInformationalSeasonLedger } from '../scripts/engineBLiveThreadEvidence.mjs';
const receipt = () => ({ id: 'h-receipt', tick: 1800, because: [{ decisionId: 'h-answer', key: 'payment_flow', part: true }] });
const observation = () => ({ tick: 1800, chips: [{ chipId: 'trace:h-answer:1', text: 'Actual title', tag: 'BUTTON' }],
  traceRows: [{ recordId: 'h-receipt', tick: 1800, decisionId: 'h-answer', decisionTick: 1015, key: 'payment_flow', actor: 'town', delta: 14, part: true }],
  traceNews: [{ decisionId: 'h-answer', title: 'Actual title', facts: ['Shared payment consequence'] }] });
const collector = () => createTraceThreadEvidence('h-answer', 1015, 1000);
test('contemporaneous exact canonical membership yields only a thread indicator and detached evidence', () => {
  const audit = collector(), input = observation(); audit.observe(input, [receipt()]);
  const result = audit.snapshot(); assert.equal(result.automaticThreadVisible, true);
  assert.equal(result.threadPresentations.length, 1); const row = result.threadPresentations[0];
  assert.equal(row.evidenceKind, 'trace-thread-indicator'); assert.equal(row.receiptId, 'h-receipt');
  assert.equal(row.observationTick, 1800); assert.equal(row.firstSeenTick, 1800); assert.equal(row.sourceRow.part, true);
  input.traceNews[0].facts[0] = 'mutated'; result.threadPresentations[0].sourceRow.recordId = 'mutated';
  assert.equal(audit.snapshot().threadPresentations[0].sourceRow.recordId, 'h-receipt');
  assert.deepEqual(audit.snapshot().threadPresentations[0].news.facts, ['Shared payment consequence']);
  audit.observe(observation(), [receipt()]); assert.equal(audit.snapshot().threadPresentations.length, 1);
});
test('a chip first seen before the receipt never becomes evidence even after disappearing', () => {
  const audit = collector(); audit.observe({ ...observation(), tick: 1015, traceRows: [], traceNews: [] }, []);
  audit.observe({ ...observation(), tick: 1700, chips: [] }, []); audit.observe(observation(), [receipt()]);
  assert.equal(audit.snapshot().automaticThreadVisible, false);
});
test('rejects wrong root, member, tick, season, title, relation, invisible, ambiguous and stale inputs', () => {
  const changes = [o => { o.traceRows[0].decisionId = 'other'; }, o => { o.traceRows[0].recordId = 'other'; },
    o => { o.traceRows[0].tick = 1799; }, o => { o.chips[0].chipId = 'trace:h-answer:0'; },
    o => { o.chips[0].text = 'other'; }, o => { o.traceRows[0].key = 'relation'; }, o => { o.chips[0].visible = false; },
    o => { o.traceNews.push({ ...o.traceNews[0] }); }, o => { o.tick = 1799; }, o => { o.tick = 2800; o.chips[0].chipId = 'trace:h-answer:2'; }];
  for (const change of changes) { const audit = collector(), o = observation(); change(o); audit.observe(o, [receipt()]); assert.equal(audit.snapshot().automaticThreadVisible, false); }
  for (const tick of [1014, 1015]) { const audit = collector(), o = observation(), r = receipt(); r.tick = tick; o.traceRows[0].tick = tick; audit.observe(o, [r]); assert.equal(audit.snapshot().automaticThreadVisible, false); }
});
test('unknown or multiple dialogs cannot be treated as informational season ledger', () => {
  const panel = { className: 'season-ledger-card', season: '1310:0', continueCount: 1, continueAvailable: true };
  assert.equal(isInformationalSeasonLedger([panel]), true);
  assert.equal(isInformationalSeasonLedger([{ ...panel, season: 41 }]), false);
  for (const panels of [[], [panel, panel], [{ ...panel, className: 'season-ledger-card other' }], [{ ...panel, season: '' }],
    [{ ...panel, season: -1 }], [{ ...panel, season: '41x' }], [{ ...panel, season: '1310:4' }], [{ ...panel, season: '-1:0' }], [{ ...panel, season: '9007199254740992:0' }], [{ ...panel, continueCount: 2 }], [{ ...panel, continueAvailable: false }], [{}]])
    assert.equal(isInformationalSeasonLedger(panels), false);
});
