import assert from 'node:assert/strict';
import test from 'node:test';
const { manualReceiptTarget } = await import(process.env.EB_MANUAL_MODULE ?? './engineBLiveSpeedCapture.mjs');
test('manual receipt target remains available when no automatic surface appeared', () => {
  assert.equal(manualReceiptTarget({ automaticPresentations: [], receipts: [{ id: 'h-receipt' }] }, {}), 'h-receipt');
  assert.equal(manualReceiptTarget({ automaticPresentations: [], receipts: [] }, {}), undefined);
});

test('manual receipt navigation waits for known informational Continue only', () => {
  const receipts = { automaticPresentations: [], receipts: [{ id: 'h-receipt' }] };
  const ledger = { className: 'season-ledger-card', season: '1325:1', continueCount: 1, continueAvailable: true };
  assert.equal(manualReceiptTarget(receipts, {}, { panels: [ledger] }), undefined);
  assert.equal(manualReceiptTarget(receipts, {}, { panels: [] }), 'h-receipt');
  assert.equal(manualReceiptTarget(receipts, {}, { panels: [{ ...ledger, className: 'substantive-dialog' }] }), 'h-receipt');
  assert.equal(manualReceiptTarget(receipts, {}, { panels: [ledger, ledger] }), 'h-receipt');
});
