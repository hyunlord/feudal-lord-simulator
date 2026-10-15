// Genuine offered-state acquisition only. Run one configured case per official DGX experiment.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decodeSave, encodeSave } from '../../../src/save/saveCodec.ts';
import { lordBotCommands } from '../../../src/engine/lordBot.ts';
import { openRegistryOffers, offerChoices } from '../../../src/engine/registry.ts';
import { advanceTick } from '../../../src/engine/tick.ts';
import { gameReducer } from '../../../src/state/gameStore.ts';
import { newGameState } from '../../../src/state/newGame.ts';
assert.equal(process.platform, 'linux');
assert.equal(process.env.FLS_REMOTE, '1');
assert.ok(process.env.FLS_REMOTE_PORT, 'Official remote runner required');
const meta = readFileSync('.remote-in/meta.env', 'utf8');
assert.match(meta, /^SLOT=heavy$/m);
assert.match(meta, /^RUN_CLASS=experiment$/m);
const [caseId, out] = process.argv.slice(2);
assert.ok(caseId && out, 'Expected case id and output directory');
const config = JSON.parse(readFileSync(new URL('./acquisition-cases.json', import.meta.url)));
const selected = config.cases.find(row => row.id === caseId);
assert.ok(selected, `Unknown acquisition case: ${caseId}`);
const cohort = new Set(JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url))).rows.map(row => row.entryId));
assert.equal(cohort.size, 56);
assert.ok(selected.targets.every(entry => cohort.has(entry)));
assert.equal(execFileSync('git', ['diff', config.product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
mkdirSync(out, { recursive: true });
assert.equal(readdirSync(out).length, 0, 'Never overwrite acquisition evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const started = Date.now();
const report = { schemaVersion: 1, case: selected, product: config.product,
  toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  provenance: 'Natural current-rule trajectory from verified save or ordinary new game; no state fabrication or policy edits.',
  limits: config.limits, input: null, commands: [], offered: [], targetsFound: [], found: false, errors: [] };
let state;
const seen = new Set();
function saveState(file) {
  const now = new Date().toISOString();
  const bytes = encodeSave({ state, createdAt: now, savedAt: now }).bytes;
  assert.equal(JSON.stringify(decodeSave(bytes).envelope.state), JSON.stringify(state), 'Save codec roundtrip changed state');
  const packed = gzipSync(bytes, { level: 9 });
  writeFileSync(join(out, file), packed, { flag: 'wx' });
  return { file, tick: state.tick, encodedSha256: sha(bytes), gzipSha256: sha(packed), stateSha256: sha(JSON.stringify(state)) };
}
function observe() {
  // Save the whole current state before any normal bot command can answer or invalidate an offer.
  for (const offer of openRegistryOffers(state)) {
    if (!cohort.has(offer.entryId) || seen.has(offer.id)) continue;
    assert.equal(typeof offer.id, 'string');
    seen.add(offer.id);
    const saved = saveState(`${offer.entryId}-offered-${state.tick}-${report.offered.length}.save.json.gz`);
    report.offered.push({ ...saved, entryId: offer.entryId, offer, choices: offerChoices(state, offer) });
    if (selected.targets.includes(offer.entryId) && !report.targetsFound.includes(offer.entryId)) report.targetsFound.push(offer.entryId);
  }
  report.found = selected.targets.every(entry => report.targetsFound.includes(entry));
  return report.found && !selected.continueToLimit;
}
try {
  if (selected.input.kind === 'save') {
    const packed = readFileSync(selected.input.file);
    assert.equal(sha(packed), selected.input.gzipSha256, 'Input gzip pin mismatch');
    const bytes = gunzipSync(packed);
    if (selected.input.encodedSha256) assert.equal(sha(bytes), selected.input.encodedSha256, 'Input encoded pin mismatch');
    const original = JSON.parse(bytes).state;
    if (selected.input.stateSha256) assert.equal(sha(JSON.stringify(original)), selected.input.stateSha256, 'Input raw-state pin mismatch');
    state = decodeSave(bytes).envelope.state;
    assert.equal(JSON.stringify(state), JSON.stringify(original), 'Migration changed input state; review required');
    report.input = { file: selected.input.file, gzipSha256: sha(packed), encodedSha256: sha(bytes), stateSha256: sha(JSON.stringify(state)) };
  } else {
    assert.equal(selected.input.kind, 'new_game');
    state = newGameState(selected.input.options);
    assert.ok(state, 'Ordinary new game rejected configured options');
    report.input = { kind: 'new_game', options: selected.input.options, ...saveState('initial.save.json.gz') };
  }
  assert.equal(state.seed, selected.seed);
  assert.equal(state.tick, selected.input.tick);
  report.startTick = state.tick;
  if (selected.advanceFirst) {
    // This checkpoint was saved after its entire normal bot batch, before the tick.
    observe();
    state = advanceTick(state);
    report.firstOperation = 'advanceTick; saved bot batch was already complete';
  }
  outer: while (state.tick < selected.endTick) {
    if (observe()) break;
    for (const { kind, command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      report.commands.push({ tick: state.tick, kind, command, changed: next !== state });
      state = next;
      if (observe()) break outer;
    }
    state = advanceTick(state);
    if (state.tick % 1000 === 0) console.log(JSON.stringify({ caseId, tick: state.tick, seconds: (Date.now() - started) / 1000, found: report.targetsFound }));
  }
  observe();
  report.finalSave = saveState('final.save.json.gz');
} catch (error) { report.errors.push(error instanceof Error ? error.stack : String(error)); }
report.endTick = state?.tick ?? null;
report.seconds = (Date.now() - started) / 1000;
report.status = report.errors.length ? 'error' : report.found ? 'targets_acquired' : 'bounded_search_no_target';
writeFileSync(join(out, 'acquisition.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }), { flag: 'wx' });
console.log(JSON.stringify({ caseId, status: report.status, tick: report.endTick, targetsFound: report.targetsFound, offers: report.offered.length, errors: report.errors }));
process.exitCode = report.errors.length ? 1 : report.found ? 0 : 2;
