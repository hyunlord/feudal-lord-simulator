import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { compareTlinkRuns } from '../scripts/engineBTlinkCompare.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
function fixture(change = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tlink-compare-'));
  for (const side of ['base', 'next']) for (const seed of [1, 2, 3]) {
    const dir = join(root, side, `seed-${seed}`); mkdirSync(dir, { recursive: true });
    const altered = side === 'next' && seed === 2;
    const state = JSON.stringify({ tick: 500000, ledger: { amount: altered && change.amount ? 11 : 10 } });
    const hash = sha(state);
    const parity = { schemaVersion: 1, exclusions: ['history'], seasonLength: 1000, hashScope: 'sampled', everyTickStateParity: false,
      finalized: true, commandCount: 1, lastTick: 500000, finalHash: hash, rollingHash: hash,
      checkpoints: [{ phase: 'final', tick: 500000, commandOrdinal: 1, hash }] };
    const artifacts = {};
    for (const phase of ['collect', 'replay']) {
      for (const [name, bytes] of [[`${phase}-parity.json`, JSON.stringify(parity)], [`${phase}-rule-state.json.gz`, gzipSync(state)]]) {
        writeFileSync(join(dir, name), bytes); artifacts[name] = sha(bytes);
      }
    }
    const manifest = { seed, years: 125, sourceRevision: sha(side).slice(0, 40), valid: true, replayVerified: true,
      source: { status: '', node: 'v24', platform: 'linux', lock: sha('same') }, toolHashes: { tool: altered && change.tool ? sha('different') : sha('same') },
      commandCount: 1, commandStreamSha256: altered && change.command ? sha('different') : sha('same'),
      final: { tick: 500000, stateSha: sha(side) }, tlinkParity: { enabled: true, artifacts } };
    const bytes = JSON.stringify(manifest); writeFileSync(join(dir, 'manifest.json'), bytes);
    writeFileSync(join(dir, 'validity.json'), JSON.stringify({ valid: true, manifestSha256: sha(bytes) }));
  }
  return { run: () => compareTlinkRuns(join(root, 'base'), join(root, 'next')), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
test('paired projection may match while full state differs', () => {
  const f = fixture(); try { const r = f.run(); assert.equal(r.passed, true); assert.equal(r.seeds[0].fullFinalHashEqual, false); } finally { f.cleanup(); }
});
test('actual ledger mismatch identifies first sampled checkpoint and final JSON path', () => {
  const f = fixture({ amount: true }); try { const r = f.run(); assert.equal(r.passed, false); assert.equal(r.seeds[1].earliestMismatch.index, 0);
    assert.equal(r.seeds[1].finalDifferences[0].path, '$["ledger"]["amount"]'); } finally { f.cleanup(); }
});
test('command divergence fails even identical projections; mismatched tools reject', () => {
  for (const change of [{ command: true }, { tool: true }]) {
    const f = fixture(change); try { if (change.tool) assert.throws(f.run, /toolHashes/); else assert.equal(f.run().passed, false); } finally { f.cleanup(); }
  }
});
