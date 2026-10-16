// Observe one genuine player-command path until its first next season, without commands or state edits.
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
const [caseId, input, out] = process.argv.slice(2);
assert.ok(caseId && input && out, 'Expected attention|contested, authentic raw state and output directory');
const cases = {
  attention: { seed: 1, startTick: 54321, endTick: 55000, member: 'lmr2/attention-overloaded.json',
    rawSha256: 'd4e0b795dc9b6c0f051d1dc41c4f5e32dee089810fe7e91e440a55d669aca05c',
    targets: ['ck_evt_019'],
    generation: 'scripts/lmr2States.ts stewardshipStates: genuine inherited estate, greedy candidate appointment and visit audit; normal set_estate_oversight(direct) after pending audit, then one tick records actual overload.',
    pathLimit: 'The player leaves the direct-oversight state alone for at most 679 ticks; the existing audit deadline is 55320. Target eligibility is not assumed.' },
  contested: { seed: 5, startTick: 52029, endTick: 53000, member: 'lmr2/contested.json',
    rawSha256: 'dc66551fdfaecb234178346b8bf5b6d5a8e99ad0625d0b45a2efa18234686aa5',
    targets: ['ck_evt_033', 'ck_evt_143', 'ck_evt_150'],
    generation: 'scripts/lmr2States.ts marriageStates and scripts/marriagePath.ts: willAnswer let_it_be, actual contested inheritance and normal file_suit; observed before submitting evidence.',
    pathLimit: 'The player submits no evidence or other commands for at most 971 ticks. Suit stages and pending deadlines may evolve naturally; stage and money eligibility are not assumed.' }
};
const selected = cases[caseId];
assert.ok(selected, 'Unknown case; only attention and contested are allowed');
mkdirSync(out, { recursive: true });
assert.equal(readdirSync(out).length, 0, 'Never overwrite acquisition evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '0b9e1a6bbb7c6b47cd19b5a1f1358dedde6afa96';
const expectedInput = selected.rawSha256;
const targets = selected.targets;
const cohort = new Set(JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url))).rows.map(row => row.entryId));
assert.equal(cohort.size, 56);
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const started = Date.now();
const report = { trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, schemaVersion: 1, product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  caseId, input, expectedInputSha256: expectedInput, targets, startTick: selected.startTick, endLimit: selected.endTick, offered: [], targetsFound: [], errors: [],
  provenance: {
    remoteSource: `/home/hyunlord/fls-lmr2-states/${selected.member.split('/').at(-1)}`,
    archive: 'codex/engine-b-tlink:docs/verification/eb-answer-effects/fixtures.tar.xz',
    archiveSha256: '03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4',
    member: selected.member,
    generation: selected.generation,
    limits: ['A deliberately chosen player-policy path, not the original default lord-bot cohort.',
      selected.pathLimit,
      'No bot or reducer commands; only normal advanceTick. Stop at first target offer or the first next season.',
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
function pendingState() {
  // Keep actual deadlines/stages, including natural expiry or progression; never reset them to preserve eligibility.
  return { tick: state.tick, treasuryCoin: state.treasuryCoin,
    audits: state.stewardship?.audits ?? [], oversight: state.stewardship?.oversight ?? [],
    suits: state.estates?.suits ?? [], claims: state.estates?.claims ?? [],
    negotiations: (state.diplomacy?.negotiations ?? []).map(row => ({ id: row.id, status: row.status, deadline: row.deadline })) };
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
  assert.equal(state.seed, selected.seed);
  assert.equal(state.tick, selected.startTick);
  assert.equal(selected.endTick, (Math.floor(state.tick / 1000) + 1) * 1000);
  if (caseId === 'attention') {
    const audit = state.stewardship.audits.find(row => row.id === 'audit-1');
    assert.equal(audit?.status, 'pending');
    assert.equal(audit.deadline, 55320);
    assert.equal(audit.revealedKept, 356);
    const oversight = state.stewardship.oversight.find(row => row.estateId === 'estate-neighbour-3');
    assert.equal(oversight?.mode, 'direct');
    assert.equal(oversight.since, 54320);
    assert.equal(oversight.stewardId, 'est-000006');
    const candidates = state.stewardship.stewards.filter(row => row.status === 'candidate');
    assert.ok(candidates.some(row => row.personId === 'est-000004' && row.disposition === 'merchant'));
    assert.ok(candidates.some(row => row.personId === 'est-000005' && row.disposition === 'peasant'));
  } else {
    const suit = state.estates.suits.find(row => row.id === 'suit-1');
    assert.equal(suit?.claimId, 'claim-2');
    assert.equal(suit.plaintiff, 'lord');
    assert.equal(suit.defendant, 'person:est-000004');
    assert.equal(suit.stage, 'filed');
    assert.equal(suit.stageSince, 52028);
    const claim = state.estates.claims.find(row => row.id === 'claim-2');
    assert.equal(claim?.basis, 'marriage');
    assert.equal(claim.status, 'suing');
    assert.deepEqual(claim.evidence, []);
  }
  report.initialPending = pendingState();
  report.initialSave = save('initial-admitted.save.json.gz');
  observe();
  while (state.tick < report.endLimit && report.targetsFound.length === 0) {
    state = advanceTick(state);
    observe();
  }
  report.finalPending = pendingState();
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
