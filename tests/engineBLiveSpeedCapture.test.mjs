import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveReceiptEvidence, shouldDismissInformationalSeasonLedger } from '../scripts/engineBLiveSpeedCapture.mjs';
const receipt = (id, tick, decisionId = 'h-answer') => ({ id, tick, kind: 'event', because: [{ decisionId }] });
test('only new strictly later exact-answer receipts within the bound qualify', () => {
  const evidence = createLiveReceiptEvidence('h-answer', 100, 3000, ['old']);
  evidence.observe(200, [receipt('old', 150), receipt('same', 100), receipt('alias', 150, 'h-root'), receipt('late', 3101), receipt('valid', 200)], []);
  evidence.observe(3100, [receipt('valid', 200), receipt('endpoint', 3100)], []);
  assert.deepEqual(evidence.snapshot().receipts.map(row => row.id), ['valid', 'endpoint']);
  assert.equal(evidence.snapshot().automaticVisible, false);
});
test('unrelated chips and manual discovery never count as automatic target visibility', () => {
  const evidence = createLiveReceiptEvidence('h-answer', 100, 3000, []);
  evidence.observe(200, [receipt('target', 200)], [{ recordId: 'other', origin: 'automatic' }, { recordId: 'target', origin: 'manual' }]);
  assert.equal(evidence.snapshot().automaticVisible, false);
  evidence.observe(201, [], [{ recordId: 'target', origin: 'automatic' }]);
  assert.equal(evidence.snapshot().automaticVisible, true);
});
test('observations fail closed on tick reversal or overshoot', () => {
  const evidence = createLiveReceiptEvidence('h-answer', 100, 3000, []);
  evidence.observe(200, [], []);
  assert.throws(() => evidence.observe(199, [], []), /tick/);
  assert.throws(() => evidence.observe(3101, [], []), /tick/);
});


test('informational season ledger continuation is based on ledger identity, not stale pause seal', () => {
  const panel = { className: 'season-ledger-card', season: '1310:0', continueCount: 1, continueAvailable: true };
  assert.equal(shouldDismissInformationalSeasonLedger({ paused: false, panels: [panel] }), true);
  assert.equal(shouldDismissInformationalSeasonLedger({ paused: true, panels: [{ ...panel, className: 'substantive-dialog' }] }), false);
  assert.equal(shouldDismissInformationalSeasonLedger({ paused: true, panels: [] }), false);
});
