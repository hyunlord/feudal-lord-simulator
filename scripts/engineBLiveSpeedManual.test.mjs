import assert from 'node:assert/strict';
import test from 'node:test';
const { manualReceiptTarget } = await import(process.env.EB_MANUAL_MODULE ?? './engineBLiveSpeedCapture.mjs');
test('manual receipt target remains available when no automatic surface appeared', () => {
  assert.equal(manualReceiptTarget({ automaticPresentations: [], receipts: [{ id: 'h-receipt' }] }, {}), 'h-receipt');
  assert.equal(manualReceiptTarget({ automaticPresentations: [], receipts: [] }, {}), undefined);
});
