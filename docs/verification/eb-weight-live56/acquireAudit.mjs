// Resume a genuine player-command path, leaving its pending audit unanswered until the next season.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { encodeSave } from '../../../src/save/saveCodec.ts';
import { decodeSave, saveAdmissions } from './reviewedSaveAdmission.mjs';
import { openRegistryOffers, offerChoices } from '../../../src/engine/registry.ts';
import { advanceTick } from '../../../src/engine/tick.ts';
assert.equal(process.platform, 'linux');
assert.equal(process.env.FLS_REMOTE, '1');
assert.ok(process.env.FLS_REMOTE_PORT, 'Official runner required');
const meta = readFileSync('.remote-in/meta.env', 'utf8');
assert.match(meta, /^SLOT=heavy$/m);
assert.match(meta, /^RUN_CLASS=experiment$/m);
const [input, out] = process.argv.slice(2);
assert.ok(input && out, 'Expected authentic raw audit-pending.json and output directory');
mkdirSync(out, { recursive: true });
assert.equal(readdirSync(out).length, 0, 'Never overwrite acquisition evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '00125eb96838ea1143d496c41953159d631e6bd3';
const expectedInput = '2cfdff1a7f0ba416f41df4508291b533fddd8b739b81568ddcb94abcbb9fd804';
const targets = ['ck_evt_013', 'ck_evt_025', 'ck_evt_052'];
const cohort = new Set(JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url))).rows.map(row => row.entryId));
assert.equal(cohort.size, 56);
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const started = Date.now();
const report = { trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, schemaVersion: 1, product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  input, expectedInputSha256: expectedInput, targets, startTick: 54320, endLimit: 55000, offered: [], targetsFound: [], errors: [],
  provenance: {
    remoteSource: '/home/hyunlord/fls-lmr2-states/audit-pending.json',
    archive: 'codex/engine-b-tlink:docs/verification/eb-answer-effects/fixtures.tar.xz',
    archiveSha256: '03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4',
    member: 'lmr2/audit-pending.json',
    generation: 'scripts/lmr2States.ts marriageStates/stewardshipStates: real marriagePath, then normal set_estate_oversight(greedy candidate) and set_audit_mode(visit) commands, then first pending Michaelmas audit.',
    limits: ['A deliberately chosen player-policy path, not the original default lord-bot cohort.',
      'No bot commands: player leaves the genuine pending audit unanswered for 680 normal ticks, before its deadline 55320.',
      'No state fields are injected, repaired, filled, or reverted. Raw state must pass lossless current codec admission.',
      'Offers prove acquired inputs only; chance, pace and competing offers can leave target events absent. No screen acceptance.']
  } };
let state;
const seen = new Set();
function save(file) {
  const now = new Date().toISOString();
  const encoded = encodeSave({ state, createdAt: now, savedAt: now }).bytes;
  assert.equal(JSON.stringify(decodeSave(encoded).envelope.state), JSON.stringify(state), 'Codec changed raw state; admission refused');
  const packed = gzipSync(encoded, { level: 9 });
  writeFileSync(join(out, file), packed, { flag: 'wx' });
  return { file, tick: state.tick, stateSha256: sha(JSON.stringify(state)), encodedSha256: sha(encoded), gzipSha256: sha(packed) };
}
function observe() {
  for (const offer of openRegistryOffers(state)) {
    if (!cohort.has(offer.entryId) || seen.has(offer.id)) continue;
    seen.add(offer.id);
    const record = save(`${offer.entryId}-offered-${state.tick}-${report.offered.length}.save.json.gz`);
    report.offered.push({ ...record, entryId: offer.entryId, offer, choices: offerChoices(state, offer) });
    if (targets.includes(offer.entryId) && !report.targetsFound.includes(offer.entryId)) report.targetsFound.push(offer.entryId);
  }
}
try {
  const raw = readFileSync(input);
  assert.equal(sha(raw), expectedInput, 'Authentic input pin mismatch');
  state = JSON.parse(raw);
  assert.equal(state.seed, 1);
  assert.equal(state.tick, 54320);
  const audit = state.stewardship.audits.find(row => row.id === 'audit-1');
  assert.equal(audit?.status, 'pending');
  assert.equal(audit.deadline, 55320);
  assert.equal(audit.revealedKept, 356);
  assert.equal(audit.stewardId, 'est-000006');
  const steward = state.stewardship.stewards.find(row => row.personId === audit.stewardId);
  assert.equal(steward?.status, 'serving');
  assert.equal(steward.loyalty, 45);
  report.initialAudit = audit;
  report.initialSave = save('initial-admitted.save.json.gz');
  observe();
  while (state.tick < report.endLimit && report.targetsFound.length === 0) {
    state = advanceTick(state);
    observe();
  }
  report.finalAudit = state.stewardship.audits.find(row => row.id === 'audit-1');
  assert.equal(report.finalAudit?.status, 'pending', 'Audit was resolved without player command; review required');
  report.finalSave = save('final.save.json.gz');
} catch (error) { report.errors.push(error instanceof Error ? error.stack : String(error)); }
report.endTick = state?.tick ?? null;
report.seconds = (Date.now() - started) / 1000;
report.found = report.targetsFound.length > 0;
report.allTargetsFound = targets.every(entry => report.targetsFound.includes(entry));
report.status = report.errors.length ? 'error' : report.found ? 'at_least_one_target_acquired' : 'bounded_search_no_target';
writeFileSync(join(out, 'acquisition.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }), { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, tick: report.endTick, targetsFound: report.targetsFound, offered: report.offered.map(row => row.entryId), errors: report.errors }));
process.exitCode = report.errors.length ? 1 : report.found ? 0 : 2;
