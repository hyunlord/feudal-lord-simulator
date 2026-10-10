import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const [input, destination, ...extra] = process.argv.slice(2);
assert.ok(input && destination && extra.length === 0, 'usage: node archive.mjs FETCHED_REMOTE_DIR OUTPUT_DIR');
const official = resolve(input), out = resolve(destination), root = join(official, 'eb-inert-native-paired');
const expected = {
  baseline: 'db750c16486a283e7f320ceaca70504589a00f93',
  changed: '72c77f6157ac91f21d9fde73cf262702d0f787a0',
  lockSha256: '26dc99ffc28b42fb06be47ac220f206a101d8cd2217b2391a20cb8006cc18697',
};
assert.equal(basename(official), 'engineB-inert-native-72c77f6');
assert.ok(!existsSync(join(out, 'manifest.json')), 'Do not replace an archived verdict');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const members = [], rawFinalStates = [];
function add(path, bytes, rawSha256) {
  members.push({ path, bytes, size: bytes.length, sha256: hash(bytes), ...(rawSha256 ? { rawSha256 } : {}) });
}
function receipt(path) { const raw = readFileSync(join(root, path)); add(path, raw); return raw; }
const provenance = Object.fromEntries(receipt('provenance.txt').toString().trim().split('\n').map(line => {
  const split = line.indexOf('='); assert.ok(split > 0); return [line.slice(0, split), line.slice(split + 1)];
}));
for (const [key, value] of Object.entries(expected)) assert.equal(provenance[key], value, key);
assert.equal(provenance.node, 'v24.21.0');
assert.equal(provenance.platform, 'Linux aarch64');
assert.match(provenance.nodeSha256, /^[a-f0-9]{64}$/);
assert.equal(provenance.scope, '24lots max1200000ticks seeds1,2,3,4,5 not-standard-guardrail');
assert.equal(Number(receipt('aggregate-exit-code').toString().trim()), 0);
const comparison = JSON.parse(receipt('comparison.json'));
assert.equal(comparison.standardGuardrail, false);
assert.equal(comparison.failed, false);
assert.equal(comparison.rawFinalStateAllEqual, true);
assert.deepEqual(comparison.rows.map(row => row.seed), [1, 2, 3, 4, 5]);
for (const side of ['baseline', 'changed']) {
  const recordedTree = receipt(`${side}/source-tree.txt`);
  const actualTree = execFileSync('git', ['ls-tree', '-r', expected[side], 'src', 'scripts', 'package.json', 'package-lock.json']);
  assert.deepEqual(recordedTree, actualTree, `${side} exact source tree`);
  assert.equal(hash(execFileSync('git', ['show', `${expected[side]}:package-lock.json`])), expected.lockSha256);
  for (const seed of [1, 2, 3, 4, 5]) {
    const prefix = `${side}/seed-${seed}`;
    const exitCode = Number(receipt(`${prefix}.exit-code`).toString().trim()); assert.equal(exitCode, 0);
    const summary = JSON.parse(receipt(`${prefix}/summary.json`));
    const bytes = readFileSync(join(root, `${prefix}/final-state.json`));
    const state = JSON.parse(bytes), sha256 = hash(bytes);
    const reported = comparison.rows.find(row => row.seed === seed).sides[side];
    assert.equal(state.seed, seed); assert.equal(state.agency, undefined, 'Non-lord state required');
    assert.equal(summary.targetLots, 24); assert.equal(summary.maxTicks, 1200000);
    assert.ok(Number.isInteger(state.tick) && state.tick > 0 && state.tick <= 1200000);
    assert.equal(state.tick, reported.tick); assert.equal(state.tick, summary.final.tick);
    assert.equal(sha256, summary.finalStateSha256); assert.equal(sha256, reported.sha256);
    assert.equal(sha256, reported.reportedSha256); assert.equal(exitCode, reported.exitCode);
    assert.equal(summary.stopReason, reported.stopReason); assert.equal(summary.simulationPassed, true);
    const peer = comparison.rows.find(row => row.seed === seed);
    assert.equal(peer.rawFinalStateEqual, true); assert.equal(peer.sides.baseline.sha256, peer.sides.changed.sha256);
    rawFinalStates.push({ side, seed, path: `${prefix}/final-state.json`, bytes: bytes.length, sha256, tick: state.tick,
      stopReason: summary.stopReason, retainedInCompactArchive: false });
  }
}
const exit = readFileSync(join(official, 'exit-code')); assert.equal(Number(exit), 0); add('official/exit-code', exit);
const timingBytes = readFileSync(join(official, 'timing.env')); add('official/timing.env', timingBytes);
const timing = Object.fromEntries(timingBytes.toString().trim().split('\n').map(line => line.split('=')));
assert.ok(Number(timing.COMMAND_S) > 0);
const log = readFileSync(join(official, 'run.log')); assert.ok(log.length > 0);
assert.match(log.toString(), /== git: HEAD 72c77f6[0-9a-f]*,\s+0 path\(s\) differ from HEAD/, 'Runner clean product checkout receipt');
add('official/run.log.gz', gzipSync(log, { level: 9 }), hash(log));
add('archive.mjs', readFileSync(new URL(import.meta.url)));
const table = rawFinalStates.filter(row => row.side === 'changed').map(row =>
  `| ${row.seed} | ${row.tick} | ${row.stopReason} | ${row.sha256} |`).join('\n');
add('README.md', Buffer.from(`# EB-INERT non-lord paired native evidence\n\nOfficial run: engineB-inert-native-72c77f6. Baseline db750c16486a283e7f320ceaca70504589a00f93; product 72c77f6157ac91f21d9fde73cf262702d0f787a0. Linux aarch64, Node v24.21.0, identical package lock.\n\nThe five pairs use 24 lots and a maximum of 1,200,000 ticks. Actual early stops are retained below. All ten raw final-state files were independently hashed against their summaries and comparison.json; both sides of each pair have identical raw bytes. The official run exited 0. This is a paired non-lord final-state check, **not the standard baseline-JSON guardrail**, and does not prove full-trajectory parity or lord-mode outcome acceptance.\n\n| Seed | Actual final tick on both sides | Stop reason | Raw final-state SHA256 on both sides |\n| --- | ---: | --- | --- |\n${table}\n\nThe compact archive omits raw final-state files. Their paths, byte lengths and hashes are in manifest.json; originals remain in the kept official run and local fetched artifact directory. Fetch the same run with \`bash scripts/remote/run.sh --fetch engineB-inert-native-72c77f6\`; do not resubmit. Reproduce the verification with \`node docs/verification/eb-inert/native/archive.mjs .remote-runs/engineB-inert-native-72c77f6 NEW_ARCHIVE_DIR\` from the repository containing both source commits. The archived run log includes the submitted command and clean-checkout assertions.\n`));
const manifest = {
  schemaVersion: 1, verdict: 'raw_final_state_equal_5_of_5',
  scope: 'Non-lord paired native run; 24 lots; maximum 1200000 ticks; seeds 1–5; measured early stops retained. Not the standard baseline-JSON guardrail.',
  standardGuardrail: false, runId: basename(official), revisions: expected, provenance,
  officialExitCode: 0, cleanCheckoutEvidence: 'Official runner log records zero paths different from product HEAD; successful submitted command asserts DIRTY=0 and clean tracked files for both source trees.',
  timing, rawFinalStateAllEqual: true, rawFinalStates,
  members: members.map(({ bytes: _bytes, ...member }) => member),
  limitations: ['Raw final-state bytes were independently hashed against both summaries and the remote comparison. They remain in the kept official run and local fetched folder, not this compact archive.',
    'Raw final-state equality does not claim full-trajectory equivalence, 125-year lord-mode acceptance, or the standard baseline-JSON guardrail.'],
};
add('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
const checksums = members.map(member => `${member.sha256}  ${member.path}`).join('\n') + '\n';
add('SHA256SUMS', Buffer.from(checksums));
for (const member of members) {
  const file = join(out, member.path); mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) assert.deepEqual(readFileSync(file), member.bytes, `Refusing to overwrite ${member.path}`);
  else writeFileSync(file, member.bytes, { flag: 'wx' });
}
console.log(JSON.stringify({ runId: manifest.runId, verified: true, rawFinalStateAllEqual: true,
  ticks: rawFinalStates.filter(row => row.side === 'changed').map(row => ({ seed: row.seed, tick: row.tick, sha256: row.sha256 })),
  archiveBytes: members.reduce((sum, member) => sum + member.size, 0), manifestSha256: hash(readFileSync(join(out, 'manifest.json'))) }, null, 2));
