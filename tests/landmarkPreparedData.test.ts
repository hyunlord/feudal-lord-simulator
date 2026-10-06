import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import prepared from '../docs/requests/landmark-growth/assets.prepared.json';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';

test('landmark handoff matches all 44 canonical rows and uses confirmed replacement sources', () => {
  const rows = readFileSync(prepared.manifest, 'utf8').trim().split(/\r?\n/).slice(1);
  assert.equal(prepared.entries.length, rows.length);
  assert.equal(rows.length, 44);
  assert.equal(new Set(prepared.entries.map(entry => entry.id)).size, 44);
  const ledger = readFileSync('assets-inbox/INBOX_LEDGER.csv', 'utf8').split(/\r?\n/);
  for (const entry of prepared.entries) {
    const row = rows.find(value => value.startsWith(`${entry.id}.png,`));
    assert.ok(row, entry.id);
    const cells = row.split(',');
    assert.equal(entry.family, cells[1]);
    assert.equal(entry.growthStage, cells[2]);
    assert.equal(entry.season, cells[3]);
    assert.deepEqual(entry.geometry.pivot, { x: Number(cells[6]), y: Number(cells[7]) });
    assert.equal(entry.geometry.scale, Number(cells[8]));
    assert.deepEqual(entry.geometry.sourceFootprint, { width: Number(cells[9]), depth: Number(cells[10]) });
    const inboxPath = entry.source.inboxFile.replace(/^assets-inbox\//, '');
    assert.ok(ledger.some(line => line.startsWith(`landmarks,${inboxPath},${entry.source.sha256},confirmed,`)), entry.id);
    const replacement = entry.family === 'bridge' || entry.family === 'guildhall';
    assert.equal(entry.source.canonicalBatch, replacement ? 'rework-20261003' : 'candidates-20261003');
  }
});

test('prepared source hashes and PNG dimensions are real, with identical seasonal registration', () => {
  for (const entry of prepared.entries) {
    const bytes = readFileSync(entry.source.inboxFile);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.source.sha256, entry.id);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual(entry.imageDimensions, { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
    const partner = prepared.entries.find(other => other.family === entry.family && other.growthStage === entry.growthStage && other.season !== entry.season);
    assert.ok(partner, entry.id);
    assert.deepEqual(entry.geometry, partner.geometry);
  }
});

test('preparation cannot silently become a runtime bundle or claim approved expansion', () => {
  assert.equal(prepared.packId, 'core');
  assert.equal(prepared.status, 'preparation-only-not-installed');
  assert.deepEqual(prepared.rules, []);
  assert.throws(() => createArtRegistry([prepared]));
  const activeData = JSON.stringify(catalog);
  for (const entry of prepared.entries) {
    assert.equal(entry.runtimeAsset, null);
    assert.equal(entry.engineFootprintApproval, 'unresolved');
    assert.equal(entry.engineMapping.growthStageField, null);
    assert.equal(activeData.includes(entry.source.inboxFile), false);
  }
});
