// Bounded genuine marriage/small-rights acquisition; no bot, invented state, or registry answers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { encodeSave } from '../../../src/save/saveCodec.ts';
import { decodeSave, saveAdmissions } from './reviewedSaveAdmission.mjs';
import { openRegistryOffers, offerChoices } from '../../../src/engine/registry.ts';
import { gameReducer } from '../../../src/state/gameStore.ts';
import { treasuryBalance } from '../../../src/ledger/ledger.ts';
import { advanceTick } from '../../../src/engine/tick.ts';
assert.equal(process.platform, 'linux');
assert.equal(process.env.FLS_REMOTE, '1');
assert.ok(process.env.FLS_REMOTE_PORT, 'Official runner required');
const meta = readFileSync('.remote-in/meta.env', 'utf8');
assert.match(meta, /^SLOT=heavy$/m);
assert.match(meta, /^RUN_CLASS=experiment$/m);
const [caseId, input, out] = process.argv.slice(2);
assert.ok(caseId && input && out, 'Expected marriage|small-rights, authentic raw state and output directory');
const cases = {
  marriage: { seed: 1, startTick: 13000, endTick: 18000, member: 'lord/registry-offer.json',
    remoteSource: '/home/hyunlord/fls-lord-states/registry-offer.json',
    rawSha256: '0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508',
    targets: ['ck_evt_018', 'ck_evt_128', 'ck_evt_131', 'ck_evt_132', 'ck_evt_133', 'ck_evt_139'],
    generation: 'scripts/eventArtStates.ts play: ordinary core:lord_slice newGameState and lordBotCommands/gameReducer/advanceTick, captured real registry offer before bot answer.',
    pathLimit: 'Leave existing 124 unanswered; natural expiry and any engine lapse behavior are retained. No marriage commands. Cash starts at 46d; target eligibility is not assumed.' },
  'small-rights': { seed: 1, startTick: 52030, endTick: 60000, member: 'lmr2/inherited.json',
    remoteSource: '/home/hyunlord/fls-lmr2-states/inherited.json',
    rawSha256: 'cc9af1c61693d7148b833e71aa285a00a908808935faee4bac20e1f5fd9b3349',
    targets: ['ck_evt_061', 'ck_evt_077'],
    generation: 'scripts/lmr2States.ts stewardshipStates: actual marriagePath inheritance; normal set_estate_oversight appoints real greedy candidate, set_audit_mode(visit), then one advanceTick before inherited save.',
    pathLimit: 'One normal set_exception_rules command delegates rights below 100d, with marriage escalation disabled; then normal time only. Actual steward-decided rights petitions must arise naturally.' }
};
const selected = cases[caseId];
assert.ok(selected, 'Unknown case; only marriage and small-rights are allowed');
mkdirSync(out, { recursive: true });
assert.equal(readdirSync(out).length, 0, 'Never overwrite acquisition evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '53407fe6946921ddd448fcffeb417ae07e7351f2';
const expectedInput = selected.rawSha256;
const targets = selected.targets;
const cohort = new Set(JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url))).rows.map(row => row.entryId));
assert.equal(cohort.size, 56);
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const started = Date.now();
const report = { trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, schemaVersion: 1, product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  caseId, input, expectedInputSha256: expectedInput, targets, startTick: selected.startTick, endLimit: selected.endTick, offered: [], targetsFound: [], commands: [], errors: [],
  provenance: {
    remoteSource: selected.remoteSource,
    archive: 'codex/engine-b-tlink:docs/verification/eb-answer-effects/fixtures.tar.xz',
    archiveSha256: '03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4',
    member: selected.member,
    generation: selected.generation,
    limits: ['A deliberately chosen player-policy path, not the original default lord-bot cohort.',
      selected.pathLimit,
      'No bot or registry answers. Marriage uses only advanceTick; small-rights uses one logged normal reducer command. Stop at fixed bound or when all targets are acquired.',
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
  return { tick: state.tick, treasuryCoin: state.treasuryCoin, treasuryBalance: treasuryBalance(state),
    rules: state.stewardship?.rules ?? null, petitions: state.stewardship?.petitions ?? [],
    occurrences: state.registry?.occurrences ?? [],
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
  if (caseId === 'marriage') {
    const offer = openRegistryOffers(state).find(row => row.id === 'registry:ck_evt_124:marriage.offer|kin:1:1|est-000002:13');
    assert.equal(offer?.entryId, 'ck_evt_124');
    assert.equal(offer.deadline, 14000);
    assert.equal(treasuryBalance(state), 46);
  } else {
    const estate = state.estates.estates.find(row => row.id === 'estate-neighbour-3');
    assert.equal(estate?.possessor, 'lord');
    assert.equal(estate.titleHolder, 'lord');
    const oversight = state.stewardship.oversight.find(row => row.estateId === estate.id);
    assert.equal(oversight?.mode, 'steward');
    assert.equal(oversight.stewardId, 'est-000006');
    assert.equal(oversight.auditMode, 'visit');
    assert.deepEqual(state.stewardship.rules, { amountAtLeast: null, rights: false, marriage: false });
  }
  report.initialPending = pendingState();
  report.initialSave = save('initial-admitted.save.json.gz');
  // Baseline offers remain documented in the admitted save, but are never newly acquired.
  report.initialOffers = openRegistryOffers(state).map(offer => ({ offer, choices: offerChoices(state, offer) }));
  for (const offer of openRegistryOffers(state)) seen.add(offer.id);
  if (caseId === 'small-rights') {
    const command = { type: 'set_exception_rules', rules: { amountAtLeast: 100, rights: false, marriage: false } };
    const beforeSha256 = sha(JSON.stringify(state));
    const next = gameReducer(state, command);
    assert.equal(next.tick, state.tick);
    assert.deepEqual(next.stewardship.rules, command.rules);
    assert.notEqual(sha(JSON.stringify(next)), beforeSha256, 'Normal policy command must actually change rules');
    state = next;
    report.commands.push({ tick: state.tick, command, beforeSha256, afterSha256: sha(JSON.stringify(state)) });
    report.afterCommandSave = save('after-normal-policy.save.json.gz');
    observe();
  }
  while (state.tick < report.endLimit && !targets.every(entry => report.targetsFound.includes(entry))) {
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
