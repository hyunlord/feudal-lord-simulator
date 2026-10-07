import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [beforePath, afterPath, out] = process.argv.slice(2);
if (!beforePath || !afterPath || !out) throw new Error('BEFORE_RESULT AFTER_RESULT OUT required');
const before = JSON.parse(readFileSync(beforePath));
const after = JSON.parse(readFileSync(afterPath));
assert.equal(before.installed, false);
assert.equal(after.installed, true);
assert.equal(before.errors.length, 0);
assert.equal(after.errors.length, 0);
assert.equal(before.views.length, 18);
assert.equal(after.views.length, 18);
assert.deepEqual(before.provenance, after.provenance);
const pairs = after.views.map(row => {
  const prior = before.views.find(view => view.name === row.name);
  assert.ok(prior, `missing baseline ${row.name}`);
  for (const field of ['saveSHA256', 'stateSHA256', 'tick', 'inventory', 'camera', 'targetClientPoint', 'target', 'tile', 'zoom', 'expectedWorldRect']) {
    assert.deepEqual(prior[field], row[field], `${row.name}: ${field} mismatch`);
  }
  assert.equal(prior.targetDraws.length, 0);
  if (row.target.selected) assert.ok(row.targetDraws.length > 0, `${row.name}: absent target draw`);
  else assert.equal(row.targetDraws.length, 0);
  return { name: row.name, saveSHA256: row.saveSHA256, stateSHA256: row.stateSHA256, zoom: row.zoom,
    inventory: row.inventory, expectedWorldRect: row.expectedWorldRect,
    positive: row.target.selected !== null, targetDrawCount: row.targetDraws.length,
    beforeJPEG: prior.jpegSHA256, afterJPEG: row.jpegSHA256,
    screenshotBytesDiffer: prior.jpegSHA256 !== row.jpegSHA256 };
});
writeFileSync(out, JSON.stringify({ beforeHead: before.head, afterHead: after.head,
  matchingSameSaveViews: pairs.length, positiveViews: pairs.filter(row => row.positive).length,
  zeroStockViews: pairs.filter(row => !row.positive).length,
  note: 'Actual target draws and identical saved state/camera are asserted. JPEG changes are recorded, not a substitute for visual grounding/occlusion review.',
  networkFailures: { before: before.networkFailures, after: after.networkFailures }, pairs }, null, 2) + '\n');
