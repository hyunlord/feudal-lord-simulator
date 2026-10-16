// Acquire an offered state through normal rules; never reconstruct it from a post-answer projection.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { encodeSave } from '../../../src/save/saveCodec.ts';
import { decodeSave, saveAdmissions } from './reviewedSaveAdmission.mjs';
import { lordBotCommands } from '../../../src/engine/lordBot.ts';
import { openRegistryOffers, offerChoices } from '../../../src/engine/registry.ts';
import { advanceTick } from '../../../src/engine/tick.ts';
import { gameReducer } from '../../../src/state/gameStore.ts';
assert.equal(process.platform, 'linux');
assert.equal(process.env.FLS_REMOTE, '1');
const [input, out] = process.argv.slice(2);
assert.ok(input && out);
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '5ade799acb870c00d3fab7f52fe1ca88279854ed';
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const compressed = readFileSync(input);
assert.equal(sha(compressed), '4bfde9d9015d5d5957b11b23bd779e83c39d69f85f7ddb8930e5035e0bc921ec');
const raw = gunzipSync(compressed);
assert.equal(sha(raw), '7dc728ae13b1eebbcf53c10290b3f6b62f1e4b29eb9585c1c19c317056bb8a22');
let state = decodeSave(raw).envelope.state;
assert.equal(state.tick, 286320); assert.equal(state.seed, 1);
const report = { trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), input,
  inputGzipSha256: sha(compressed), inputEncodedSha256: sha(raw), startTick: state.tick, endLimit: state.tick + 24000,
  provenance: 'genuine 2485af4 consequence save resumed under current 0b9e1a6bb rules; normal lordBotCommands/gameReducer/advanceTick only',
  commands: [], offered: [], found: false, errors: [] };
const seen = new Set();
function observe() {
  for (const offer of openRegistryOffers(state)) {
    if (seen.has(offer.entryId)) continue;
    seen.add(offer.entryId);
    const now = new Date().toISOString();
    const bytes = encodeSave({ state, createdAt: now, savedAt: now }).bytes;
    const packed = gzipSync(bytes, { level: 9 });
    const file = `${offer.entryId}-offered-${state.tick}.save.json.gz`;
    assert.equal(JSON.stringify(decodeSave(bytes).envelope.state), JSON.stringify(state));
    writeFileSync(join(out, file), packed, { flag: 'wx' });
    report.offered.push({ entryId: offer.entryId, offer, tick: state.tick, choices: offerChoices(state, offer), file,
      encodedSha256: sha(bytes), gzipSha256: sha(packed), stateSha256: sha(JSON.stringify(state)) });
    if (offer.entryId === 'ck_evt_024') { report.found = true; return true; }
  }
  return false;
}
const started = Date.now();
try {
  outer: while (state.tick < report.endLimit) {
    if (observe()) break;
    for (const { kind, command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      report.commands.push({ tick: state.tick, kind, command, changed: next !== state });
      state = next;
      if (observe()) break outer;
    }
    state = advanceTick(state);
    if (state.tick % 1000 === 0) console.log(JSON.stringify({ tick: state.tick, seconds: (Date.now() - started) / 1000 }));
  }
  observe();
} catch (error) { report.errors.push(String(error)); }
report.endTick = state.tick; report.seconds = (Date.now() - started) / 1000;
writeFileSync(join(out, 'acquisition.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
console.log(JSON.stringify({ found: report.found, tick: state.tick, offered: report.offered.map(x => [x.entryId, x.choices]), errors: report.errors }));
process.exitCode = report.found && !report.errors.length ? 0 : 1;
