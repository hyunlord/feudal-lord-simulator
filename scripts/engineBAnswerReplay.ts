import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import type { GameState } from '../src/engine/engine.types';
import { TRACE_LIVE_TICKS } from '../src/engine/decisionTrace';
import { registryV4Support } from '../src/engine/registryV4';
import { lordBotCommands } from '../src/engine/lordBot';
import { stewardReport } from '../src/engine/decisionReads';
import { stateCalendar } from '../src/engine/scenarioState';
import { advanceTick } from '../src/engine/tick';
import { registerRegistryCandidateObserver, registryCandidateObserverFailures } from '../src/engine/registryCandidateObservation';
import { decodeSave, encodeSave, stateChecksum } from '../src/save/saveCodec';
import { gameReducer } from '../src/state/gameStore';
import { newGameState } from '../src/state/newGame';
import { createWeightAuditCollector } from './engineBWeightAuditCollector';
import { createCandidateAuditCollector } from './engineBWeightAuditCandidates';
import { createAnswerEvidenceCollector, classifyAnswerEvidence } from './engineBAnswerEvidence';

export const REPLAY_SOURCE = '2485af40046793f1856829fa1161dc4431942aa7';
export const replaySha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export function requireReplay(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function object(value: unknown): Record<string, unknown> {
  requireReplay(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  return value as Record<string, unknown>;
}
function jsonFile(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) as unknown; }
const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function validateReplaySource(input: { platform: string; node: string; revision: string; status: string; lock: string; expectedLock: string | undefined }): void {
  requireReplay(input.platform === 'linux' && input.node === 'v24.21.0', 'DGX Linux and original Node v24.21.0 required');
  requireReplay(input.revision === REPLAY_SOURCE, 'Wrong engine source');
  requireReplay(input.expectedLock !== undefined && input.lock === input.expectedLock, 'Dependency lock pin mismatch');
  const allowed = new Set(['?? scripts/engineBAnswerEvidence.ts', '?? scripts/engineBAnswerReplay.ts']);
  requireReplay(input.status.split('\n').filter(Boolean).every(line => allowed.has(line)), 'Original source dirty or unexpected copied tool');
}
export function verifyRawBytes(bytes: Uint8Array, expected: string | undefined): void {
  requireReplay(expected !== undefined && /^[a-f0-9]{64}$/.test(expected) && replaySha(bytes) === expected, 'Raw archive SHA pin mismatch');
}
export function verifyStateSerialization(stored: string, decoded: unknown, checksum: string): string {
  const json = JSON.stringify(decoded);
  requireReplay(json === stored, 'Decode normalized original state');
  requireReplay(stateChecksum(json) === checksum, 'State checksum mismatch');
  return replaySha(json);
}
export function compareReplayProjection(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  // Compare the pinned JSON representation, which omits undefined fields and serializes -0 as 0.
  const archived = object(JSON.parse(JSON.stringify(actual)) as unknown);
  for (const key of Object.keys(actual)) requireReplay(isDeepStrictEqual(archived[key], expected[key]), `Original collector mismatch: ${key}`);
}
export function verifyRegistryAnswerSet(actual: readonly Record<string, unknown>[], sidecar: unknown): void {
  const expected = object(sidecar);
  requireReplay(Array.isArray(expected.answers) && Array.isArray(expected.unresolved) && expected.unresolved.length === 0, 'Registry sidecar unresolved or malformed');
  const normalize = (values: readonly unknown[]) => values.map(value => {
    const row = object(value);
    requireReplay(row.by === 'lord' && typeof row.occurrenceId === 'string' && typeof row.answerHistoryId === 'string'
      && typeof row.entryId === 'string' && typeof row.choiceId === 'string' && Number.isSafeInteger(row.settledTick)
      && Array.isArray(row.weights), 'Registry answer shape mismatch');
    return { occurrenceId: row.occurrenceId, answerHistoryId: row.answerHistoryId, entryId: row.entryId, choiceId: row.choiceId,
      settledTick: row.settledTick, by: row.by, weights: row.weights };
  }).sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  const left = normalize(actual), right = normalize(expected.answers);
  requireReplay(new Set(left.map(row => row.occurrenceId)).size === left.length && new Set(right.map(row => row.occurrenceId)).size === right.length, 'Duplicate registry answer identity');
  requireReplay(isDeepStrictEqual(left, right), 'Exact registry answer set mismatch');
}
export function passiveReplayObservation(before: unknown, after: unknown, observe: () => void): void {
  const left = JSON.stringify(before), right = JSON.stringify(after);
  observe();
  requireReplay(JSON.stringify(before) === left && JSON.stringify(after) === right, 'Answer observer mutated simulation state');
}
/** Mirrors pinned createRegistryCheckpointObserver selection, including reference skips and existing history rows. */
export function createReplayCheckpointSelector(enabledIds: readonly string[]) {
  const enabled = new Set(enabledIds), pairs = new Map<string, { id: string; tick: number; consequence: boolean }>();
  let previousTrace: GameState['trace'], previousHistory: GameState['history'];
  return (state: GameState): { entryId: string; identity: string; phase: 'answer' | 'consequence' }[] => {
    const selected: { entryId: string; identity: string; phase: 'answer' | 'consequence' }[] = [];
    if (previousTrace !== state.trace) {
      for (const decision of state.trace?.decisions ?? []) {
        const entry = /^registry:(ck_evt_\d{3}):/.exec(decision.source)?.[1];
        if (decision.kind !== 'registry' || decision.by !== 'lord' || decision.lapsed === true || decision.tick !== state.tick
          || decision.tick >= 500000 || entry === undefined || !enabled.has(entry) || pairs.has(entry)) continue;
        const own = state.history?.records.find(row => row.id === decision.id);
        if (own?.kind !== 'decision' || own.decision === undefined || own.template === 'decision.lapsed') continue;
        pairs.set(entry, { id: decision.id, tick: decision.tick, consequence: false }); selected.push({ entryId: entry, identity: decision.id, phase: 'answer' });
      }
      previousTrace = state.trace;
    }
    if (previousHistory !== state.history) {
      for (const [entryId, pair] of pairs) {
        if (pair.consequence || state.tick > pair.tick + TRACE_LIVE_TICKS) continue;
        const first = (state.history?.records ?? []).filter(row => row.kind !== 'decision' && row.tick > pair.tick
          && row.tick <= pair.tick + TRACE_LIVE_TICKS && row.because?.some(cause => cause.decisionId === pair.id))
          .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id))[0];
        if (first?.because === undefined) continue;
        pair.consequence = true; selected.push({ entryId, identity: first.id, phase: 'consequence' });
      }
      previousHistory = state.history;
    }
    return selected;
  };
}
export function replayIteration<S, C>(initial: S, commands: (state: S) => readonly C[], reduce: (state: S, command: C) => S,
  afterCommand: (before: S, after: S, command: C) => void, preTick: (state: S) => void,
  tick: (state: S) => S, afterTick: (before: S, after: S) => void): S {
  let state = initial;
  const batch = commands(state);
  for (const command of batch) { const before = state; state = reduce(state, command); afterCommand(before, state, command); }
  preTick(state);
  const next = tick(state); afterTick(state, next); return next;
}
interface Checkpoint { entryId: string | null; phase: 'answer' | 'consequence' | 'final'; file: string; tick: number; identity: string | null; stateSha: string; checksum: string; hit: boolean; }
function loadCheckpoint(value: unknown, directory: string, seed: number, identity: string | null, entryId: string | null, phase: Checkpoint['phase']): Checkpoint {
  const record = object(value), file = record.file;
  requireReplay(typeof file === 'string' && basename(file) === file && !file.includes('..'), 'Unsafe checkpoint filename');
  const zipped = readFileSync(join(directory, file));
  requireReplay(replaySha(zipped) === record.fileSha256 && zipped.length === record.bytes, 'Checkpoint gzip mismatch');
  const bytes = gunzipSync(zipped);
  requireReplay(replaySha(bytes) === record.encodedSaveSha256, 'Checkpoint encoded SHA mismatch');
  const text = bytes.toString('utf8'), raw = object(JSON.parse(text) as unknown), decoded = decodeSave(bytes);
  requireReplay(raw.schemaVersion === 54 && decoded.migratedFrom === 54 && decoded.envelope.schemaVersion === 54, 'Migration forbidden');
  const marker = ',"state":', at = text.indexOf(marker);
  requireReplay(at >= 0 && typeof raw.checksum === 'string', 'Checkpoint header missing');
  const state = decoded.envelope.state;
  requireReplay(state.tick === record.observedTick && state.seed === seed && state.scenarioId === LORD_SLICE_SCENARIO_ID, 'Checkpoint scenario/seed/tick mismatch');
  const stateSha = verifyStateSerialization(text.slice(at + marker.length, -1), state, raw.checksum);
  if (identity !== null) requireReplay(state.history?.records.some(row => row.id === identity), 'Checkpoint history identity missing');
  return { entryId, phase, file, tick: state.tick, identity, stateSha, checksum: raw.checksum, hit: false };
}
const PRECLOSES = [
  { tick: 126999, entry: 'ck_evt_058', choice: 'remit', id: 'registry:ck_evt_058:petition.charterFee|ck_evt_058@126000:126' },
  { tick: 171999, entry: 'ck_evt_034', choice: 'precedent', id: 'registry:ck_evt_034:steward.precedent|:171' },
  { tick: 415999, entry: 'ck_evt_144', choice: 'b', id: 'registry:ck_evt_144:ck_evt_144|:415' },
  { tick: 450999, entry: 'ck_evt_163', choice: 'b', id: 'registry:ck_evt_163:ck_evt_163|:450' },
] as const;
function preclose(state: GameState, output: string): Record<string, unknown> | null {
  const wanted = PRECLOSES.find(row => row.tick === state.tick);
  if (wanted === undefined) return null;
  const from = state.tick - 999, to = state.tick + 1;
  const occurrence = state.registry?.occurrences.find(row => row.id === wanted.id);
  requireReplay(occurrence?.entryId === wanted.entry && occurrence.offeredTick === from && occurrence.decidedBy === 'steward'
    && occurrence.choiceId === wanted.choice && occurrence.policy === 'customary', 'Preclose occurrence identity mismatch');
  const report = stewardReport(state, from, to);
  requireReplay(report.events.some(row => row.occurrenceId === wanted.id && row.choiceId === wanted.choice && row.policy === 'customary'), 'Preclose report membership mismatch');
  const now = new Date().toISOString(), encoded = encodeSave({ state, createdAt: now, savedAt: now });
  requireReplay(typeof encoded.header.checksum === 'string', 'Encoded checksum missing');
  verifyStateSerialization(JSON.stringify(state), decodeSave(encoded.bytes).envelope.state, encoded.header.checksum);
  const bytes = gzipSync(encoded.bytes), file = `${wanted.entry}-preclose-${state.tick}.save.json.gz`;
  writeFileSync(join(output, file), bytes, { flag: 'wx' });
  return { file, tick: state.tick, phase: 'after_all_bot_commands_before_advanceTick', resume: 'advanceTick FIRST; do not repeat bot commands',
    browserEligible: false, occurrence, report, from, to, fileSha256: replaySha(bytes), encodedSha256: replaySha(encoded.bytes), stateSha256: replaySha(JSON.stringify(state)), checksum: encoded.header.checksum };
}

/** Heavy only on DGX; importing this file never starts a game. */
export function runAnswerReplay(seed: number, rawPath: string, checkpointDirectory: string, expectedManifestSha: string, output: string): void {
  requireReplay(Number.isSafeInteger(seed) && seed >= 1 && seed <= 3, 'Expected original seed 1..3');
  requireReplay(readdirSync(output).length === 0, 'Output must exist and be empty');
  const write = (name: string, value: unknown): void => writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
  const result: Record<string, unknown> = { valid: false, browserEligible: false, sourceRevision: REPLAY_SOURCE, seed, checkpoints: [], captures: [] };
  write('validity.json', result);
  let unregister: (() => void) | undefined;
  let saveContexts: (() => void) | undefined;
  try {
    const source = { platform: process.platform, node: process.version, revision: git('rev-parse', 'HEAD'), status: git('status', '--porcelain'),
      lock: replaySha(readFileSync('package-lock.json')), expectedLock: process.env.EB_PINNED_LOCK_SHA256 };
    validateReplaySource(source); result.source = source;
    result.toolHashes = Object.fromEntries(['engineBAnswerReplay.ts', 'engineBAnswerEvidence.ts', 'engineBWeightAuditRun.ts'].map(name => [name, replaySha(readFileSync(join('scripts', name)))]));
    const rawBytes = readFileSync(rawPath); verifyRawBytes(rawBytes, process.env.EB_EXPECTED_RAW_FILE_SHA256);
    const raw = object(JSON.parse(rawBytes.toString('utf8')) as unknown); verifyRawBytes(rawBytes, process.env.EB_EXPECTED_RAW_SHA256);
    const provenance = object(raw.provenance);
    requireReplay(provenance.sourceRevision === REPLAY_SOURCE && provenance.dirtyPaths === '' && provenance.node === 'v24.21.0'
      && raw.seed === seed && raw.years === 125 && raw.endTick === 500000, 'Original raw provenance mismatch');
    result.raw = { path: rawPath, sha256: replaySha(rawBytes), provenance };
    const sidecarPath = process.env.EB_REGISTRY_ANSWERS_JSON;
    requireReplay(sidecarPath !== undefined, 'Registry answer sidecar required');
    const sidecarBytes = readFileSync(sidecarPath); verifyRawBytes(sidecarBytes, process.env.EB_REGISTRY_ANSWERS_SHA256);
    const registrySidecar: unknown = JSON.parse(sidecarBytes.toString('utf8'));
    result.registrySidecarSha256 = replaySha(sidecarBytes);
    const manifestBytes = readFileSync(join(checkpointDirectory, 'manifest.json')); verifyRawBytes(manifestBytes, expectedManifestSha);
    const manifest = object(jsonFile(join(checkpointDirectory, 'manifest.json')));
    requireReplay(isDeepStrictEqual(manifest, raw.checkpointManifest), 'Raw/manifest mismatch');
    requireReplay(manifest.sourceRevision === REPLAY_SOURCE && manifest.dirtyPaths === '' && manifest.endTickExclusive === 500000
      && manifest.lastObservedTick === 500000 && Array.isArray(manifest.pairs), 'Original checkpoint provenance incomplete');
    writeFileSync(join(output, 'source-manifest.json'), manifestBytes); result.manifestSha256 = expectedManifestSha;
    const checkpoints: Checkpoint[] = manifest.pairs.flatMap(value => {
      const pair = object(value); requireReplay(typeof pair.decisionId === 'string' && typeof pair.entryId === 'string', 'Missing decision identity');
      const answer = loadCheckpoint(pair.answer, checkpointDirectory, seed, pair.decisionId, pair.entryId, 'answer');
      if (pair.consequence === undefined) return [answer];
      const consequence = object(pair.consequence); requireReplay(typeof consequence.historyId === 'string', 'Missing consequence identity');
      return [answer, loadCheckpoint(consequence, checkpointDirectory, seed, consequence.historyId, pair.entryId, 'consequence')];
    });
    const final = loadCheckpoint(manifest.finalSave, checkpointDirectory, seed, null, null, 'final');
    requireReplay(final.tick === 500000 && new Set(checkpoints.map(row => row.file)).size === checkpoints.length, 'Invalid checkpoint set');
    result.checkpoints = checkpoints; result.final = final;
    const audit = createWeightAuditCollector(), candidates = createCandidateAuditCollector(500000), answers = createAnswerEvidenceCollector();
    saveContexts = () => {
      const bytes = gzipSync(JSON.stringify(answers.snapshot()));
      writeFileSync(join(output, 'answer-contexts.json.gz'), bytes); result.contextSha256 = replaySha(bytes);
    };
    requireReplay(registryCandidateObserverFailures() === 0, 'Existing candidate observer failure');
    unregister = registerRegistryCandidateObserver(candidates.observe);
    let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
    requireReplay(state !== null && state.tick === 0, 'Original initial state failed');
    audit.observe(state);
    const selectCheckpoints = createReplayCheckpointSelector(registryV4Support().filter(row => row.runs).map(row => row.id));
    requireReplay(selectCheckpoints(state).length === 0, 'Unexpected initial checkpoint');
    const startYear = stateCalendar(state).year;
    const stream = createHash('sha256'); let ordinal = 0, changedCommands = 0;
    const captures: Record<string, unknown>[] = []; result.captures = captures;
    const observe = (after: GameState, phase: string): void => {
      audit.observe(after);
      const selected = selectCheckpoints(after);
      const due = selected.map(({ identity, entryId, phase: checkpointPhase }) => {
        const matches = checkpoints.filter(row => !row.hit && row.tick === after.tick && row.identity === identity && row.entryId === entryId && row.phase === checkpointPhase);
        requireReplay(matches.length === 1, `Unexpected or ambiguous first-eligible checkpoint ${identity}`); return matches[0]!;
      });
      if (due.length === 0) return;
      const json = JSON.stringify(after), actual = replaySha(json);
      for (const row of due) {
        if (actual !== row.stateSha || stateChecksum(json) !== row.checksum) {
          write('mismatch.json', { file: row.file, tick: after.tick, phase, ordinal, expected: row.stateSha, actual });
          writeFileSync(join(output, 'mismatch.state.json.gz'), gzipSync(json));
          throw new Error(`Checkpoint mismatch ${row.file}`);
        }
        row.hit = true; write('progress.json', { tick: after.tick, phase, ordinal, checkpoints, captures });
      }
    };
    while (stateCalendar(state).year < startYear + 125) {
      requireReplay(state.tick < 500000, 'Original calendar/tick span mismatch');
      state = replayIteration(state, value => lordBotCommands(value).map(item => item.command), gameReducer,
        (before, after, command) => {
          ordinal += 1; if (after !== before) changedCommands += 1;
          requireReplay(after.tick === before.tick, 'Command changed tick');
          stream.update(`${JSON.stringify({ ordinal, tick: before.tick, command })}\n`);
          passiveReplayObservation(before, after, () => answers.observe(before, after, command, ordinal));
          observe(after, 'after_command');
        }, value => { if (seed === 1) { const capture = preclose(value, output); if (capture !== null) captures.push(capture); } },
        advanceTick, (before, after) => { observe(after, 'after_tick'); requireReplay(after.tick === before.tick + 1, 'Tick progression changed'); });
      if (state.tick % 10000 === 0) console.log(JSON.stringify({ seed, tick: state.tick, ordinal }));
    }
    unregister(); unregister = undefined;
    requireReplay(checkpoints.every(row => row.hit), 'Original checkpoints not all observed at identity boundaries');
    const finalJson = JSON.stringify(state);
    result.finalComparison = { expectedSha256: final.stateSha, actualSha256: replaySha(finalJson), expectedChecksum: final.checksum, actualChecksum: stateChecksum(finalJson) };
    if (replaySha(finalJson) !== final.stateSha || stateChecksum(finalJson) !== final.checksum) {
      writeFileSync(join(output, 'mismatch-final.state.json.gz'), gzipSync(finalJson)); throw new Error('Final full state mismatch');
    }
    final.hit = true;
    writeFileSync(join(output, 'audit-snapshot.json.gz'), gzipSync(JSON.stringify(audit.snapshot())));
    compareReplayProjection(audit.snapshot(), raw);
    compareReplayProjection({ candidateObservation: { ...candidates.snapshot(), observerFailures: registryCandidateObserverFailures() } }, raw);
    requireReplay(changedCommands === raw.commands && registryCandidateObserverFailures() === 0, 'Command count or observer mismatch');
    requireReplay(seed !== 1 || captures.length === 4, 'Missing seed1 preclose captures');
    saveContexts(); const contexts = answers.snapshot();
    result.commandStreamSha256 = stream.digest('hex'); result.commandCount = ordinal;
    // Offline phase: every original state/checkpoint/collector comparison finished before hypothetical weighing.
    const classified = classifyAnswerEvidence(contexts); write('answer-classification.json', classified);
    result.classification = classified;
    const registryRows = classified.classified.filter(row => row.command === 'answer_registry_offer').map(row => {
      const context = contexts.find(record => record.ordinal === row.ordinal), occurrence = context?.context.registryAfter;
      requireReplay(occurrence !== null && occurrence !== undefined, 'Classified registry context absent');
      return { occurrenceId: occurrence.id, entryId: occurrence.entryId, choiceId: occurrence.choiceId, answerHistoryId: row.historyId,
        settledTick: row.tick, by: 'lord', weights: row.weights };
    });
    verifyRegistryAnswerSet(registryRows, registrySidecar); result.registryAnswerSetVerified = registryRows.length;
    requireReplay(classified.unresolved.length === 0, 'Unresolved answer classification; evidence not eligible');
    requireReplay(git('status', '--porcelain') === source.status, 'Source changed during replay');
    result.valid = true; result.browserEligible = true; for (const capture of captures) capture.browserEligible = true;
    write('manifest.json', result); write('validity.json', { valid: true, browserEligible: true, manifestSha256: replaySha(readFileSync(join(output, 'manifest.json'))) });
  } catch (error) { saveContexts?.(); result.error = String(error); result.valid = false; result.browserEligible = false; write('manifest.json', result); write('validity.json', result); throw error; }
  finally { unregister?.(); }
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, raw, directory, manifest, output, extra] = process.argv.slice(2);
  requireReplay(seed !== undefined && raw !== undefined && directory !== undefined && manifest !== undefined && output !== undefined && extra === undefined,
    'usage: engineBAnswerReplay.ts seed rawJSON checkpointDir expectedManifestSHA emptyOutputDir');
  mkdirSync(output, { recursive: true }); runAnswerReplay(Number(seed), raw, directory, manifest, output);
}
