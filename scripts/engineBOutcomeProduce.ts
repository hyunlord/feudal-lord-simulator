import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { BALANCE } from '../src/content/balanceConfig';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import { lordBotCommands } from '../src/engine/lordBot';
import { stateCalendar } from '../src/engine/scenarioState';
import { advanceTick } from '../src/engine/tick';
import { gameReducer } from '../src/state/gameStore';
import { newGameState } from '../src/state/newGame';
import { verifyRegistryAnswerSet } from './engineBOutcomeArchive.mjs';
import { createOutcomeArchive } from './engineBOutcomeCollect';
import { classifyAnswerEvidence, createAnswerEvidenceCollector, OUTCOME_COMMAND_KIND } from './engineBOutcomeEvidence';
import { verifyOutcomeTaxonomy } from './engineBOutcomeTaxonomy';
import { canonicalTlinkRuleState, createTlinkParityObserver } from './engineBTlinkParity';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
import type { GameState } from '../src/engine/engine.types';
import type { GameAction } from '../src/state/gameStore.types';

export type OutcomeCommandObserver = (before: GameState, after: GameState, command: GameAction, ordinal: number) => void;
export interface OutcomeReplayObserver {
  readonly toolFiles: readonly string[];
  readonly create: (classification: ReturnType<typeof classifyAnswerEvidence>) => OutcomeCommandObserver;
  readonly complete: (directory: string) => void;
}
export function observeOutcomeCommand(observer: OutcomeCommandObserver | undefined, before: GameState, after: GameState, command: GameAction, ordinal: number): void {
  if (observer === undefined) return;
  const beforeBytes = JSON.stringify(before), afterBytes = JSON.stringify(after), commandBytes = JSON.stringify(command);
  observer(before, after, command, ordinal);
  assert.equal(JSON.stringify(before), beforeBytes, 'Passive observer mutated before state');
  assert.equal(JSON.stringify(after), afterBytes, 'Passive observer mutated after state');
  assert.equal(JSON.stringify(command), commandBytes, 'Passive observer mutated command');
}

const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function git(...args: string[]): string { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function preflight(parityEnabled: boolean, observer?: OutcomeReplayObserver) {
  assert.equal(realpathSync(process.cwd()), realpathSync(root), 'Run from the producer checkout root');
  assert.equal(git('status', '--porcelain'), '', 'Outcome producer requires a clean committed checkout');
  const sourceRevision = git('rev-parse', 'HEAD');
  const traceSourceSha256 = verifyOutcomeTaxonomy(readFileSync(join(root, 'src/engine/decisionTrace.ts'), 'utf8'), OUTCOME_COMMAND_KIND);
  const lock = sha(readFileSync(join(root, 'package-lock.json')));
  const toolHashes = Object.fromEntries(['engineBOutcomeProduce.ts', 'engineBOutcomeEvidence.ts', 'engineBOutcomeCollect.ts', 'engineBOutcomeTaxonomy.ts', 'engineBOutcomeArchive.mjs', 'registryDecisionOccurrences.ts', ...(parityEnabled ? ['engineBTlinkParity.ts'] : []), ...(observer?.toolFiles ?? [])]
    .map(name => [name, sha(readFileSync(join(root, 'scripts', name)))]));
  const sourceFiles = git('ls-files', 'src').split('\n').filter(Boolean).map(path => ({ path, sha256: sha(readFileSync(join(root, path))) }));
  return { sourceRevision, sourceFiles, traceSourceSha256, toolHashes, source: { revision: sourceRevision, platform: process.platform, node: process.version,
    status: '', lock, expectedLock: lock } };
}
function collect(seed: number, years: number, phase: string, provenance: { readonly sourceRevision: string; readonly sourceFiles: readonly { readonly path: string; readonly sha256: string }[] }, directory: string, parityEnabled: boolean, observer?: OutcomeCommandObserver) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
  assert.ok(state !== null && state.tick === 0, 'Fresh lord scenario required');
  const startYear = stateCalendar(state).year, endTick = years * BALANCE.TICKS_PER_YEAR;
  const archive = createOutcomeArchive(), answers = createAnswerEvidenceCollector(), stream = createHash('sha256');
  const parity = parityEnabled ? createTlinkParityObserver({ seasonLength: BALANCE.TICKS_PER_YEAR / 4 }) : null;
  let commandCount = 0;
  archive.observe(state);
  parity?.observe(state, { phase: 'initial', commandOrdinal: commandCount });
  while (stateCalendar(state).year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const before = state;
      state = gameReducer(before, command);
      commandCount += 1;
      observeOutcomeCommand(observer, before, state, command, commandCount);
      stream.update(json({ ordinal: commandCount, tick: before.tick, command }));
      answers.observe(before, state, command, commandCount);
      archive.observe(state);
      parity?.observe(state, { phase: 'command', commandOrdinal: commandCount });
    }
    state = advanceTick(state);
    archive.observe(state);
    parity?.observe(state, { phase: 'tick', commandOrdinal: commandCount });
    if (state.tick % 10000 === 0) {
      const progress = { phase, seed, tick: state.tick, endTick, commandCount };
      writeFileSync(join(directory, 'progress.json'), json(progress)); console.log(JSON.stringify(progress));
    }
  }
  assert.equal(state.tick, endTick, 'Unexpected calendar endpoint');
  parity?.observe(state, { phase: 'final', commandOrdinal: commandCount });
  const parityEvidence = parity?.snapshot() ?? null;
  const ruleStateBytes = parityEnabled ? canonicalTlinkRuleState(state) : null;
  if (parityEvidence !== null && ruleStateBytes !== null) {
    assert.equal(sha(ruleStateBytes), parityEvidence.finalHash, 'Final parity diagnostic mismatch');
    writeFileSync(join(directory, `${phase}-parity.json`), json(parityEvidence), { flag: 'wx' });
    writeFileSync(join(directory, `${phase}-rule-state.json.gz`), gzipSync(ruleStateBytes), { flag: 'wx' });
  }
  const contexts = answers.snapshot(), classification = classifyAnswerEvidence(contexts);
  assert.equal(classification.rows.length, commandCount, 'Every attempted command must retain a classification row');
  assert.equal(classification.unresolved.length, 0, 'Unresolved command classification');
  const snapshot = archive.snapshot();
  assert.deepEqual([snapshot.observation.firstTick, snapshot.observation.lastTick, snapshot.observation.maxGap, snapshot.observation.reversals], [0, endTick, 1, 0]);
  const raw = { schemaVersion: 1, seed, years, startYear, endYearExclusive: startYear + years, endTick,
    provenance: { sourceRevision: provenance.sourceRevision, dirtyPaths: '', node: process.version, sourceFiles: provenance.sourceFiles }, ...snapshot };
  const registryAnswerSetVerified = verifyRegistryAnswerSet(raw, classification);
  const finalBytes = json(state), contextBytes = gzipSync(json(contexts));
  return { raw, classification, registryAnswerSetVerified, parityEvidence, ruleStateBytes, commandCount, commandStreamSha256: stream.digest('hex'), finalBytes, contextBytes };
}

/** Two ordinary LordBot runs, with passive per-command/per-tick evidence and complete retained-archive equality. */
export function produceOutcomeReplay(seed: number, outputRoot: string, years = 125, observer?: OutcomeReplayObserver): void {
  refuseHeavyOnMac('EB-OUTCOME collect and deterministic replay', { remote: 'scripts/remote/run.sh EB-OUTCOME --heavy --experiment -- npx tsx scripts/engineBOutcomeProduce.ts 1 .remote/eb-outcome' });
  assert.equal(process.platform, 'linux', 'Use the official Linux remote runner');
  assert.ok(Number.isSafeInteger(seed) && seed > 0 && Number.isSafeInteger(years) && years > 0 && years <= 125, 'Positive seed and 1..125 years required');
  const parityFlag = process.env.FLS_TLINK_PARITY;
  assert.ok(parityFlag === undefined || parityFlag === '0' || parityFlag === '1', 'FLS_TLINK_PARITY must be 0 or 1');
  const parityEnabled = parityFlag === '1';
  assert.ok(observer === undefined || parityEnabled, 'Passive capture requires parity');
  const provenance = preflight(parityEnabled, observer), directory = join(resolve(outputRoot), `seed-${seed}`);
  mkdirSync(resolve(outputRoot), { recursive: true }); mkdirSync(directory);
  const write = (name: string, value: unknown): void => writeFileSync(join(directory, name), json(value), { flag: 'wx' });
  write('preflight.json', { ...provenance, seed, years, replayFormat: 'outcome-replay-v1', parityEnabled });
  try {
    const original = collect(seed, years, 'collect', provenance, directory, parityEnabled);
    const rawBytes = json(original.raw);
    writeFileSync(join(resolve(outputRoot), `seed-${seed}.json`), rawBytes, { flag: 'wx' });
    writeFileSync(join(directory, 'original-contexts.json.gz'), original.contextBytes, { flag: 'wx' });
    writeFileSync(join(directory, 'original-final-state.json.gz'), gzipSync(original.finalBytes), { flag: 'wx' });
    const replay = collect(seed, years, 'replay', provenance, directory, parityEnabled, observer?.create(original.classification));
    writeFileSync(join(directory, 'answer-contexts.json.gz'), replay.contextBytes, { flag: 'wx' });
    write('answer-classification.json', replay.classification);
    writeFileSync(join(directory, 'final-state.json.gz'), gzipSync(replay.finalBytes), { flag: 'wx' });
    assert.equal(json(replay.raw), rawBytes, 'Replay complete retained archive mismatch');
    assert.equal(json(replay.classification), json(original.classification), 'Replay classification mismatch');
    assert.equal(replay.commandStreamSha256, original.commandStreamSha256, 'Replay command stream mismatch');
    assert.equal(sha(replay.contextBytes), sha(original.contextBytes), 'Replay passive context mismatch');
    assert.equal(replay.finalBytes, original.finalBytes, 'Replay final full-state mismatch');
    assert.deepEqual(replay.parityEvidence, original.parityEvidence, 'Replay sampled rule parity mismatch');
    assert.equal(replay.ruleStateBytes, original.ruleStateBytes, 'Replay final rule projection mismatch');
    assert.deepEqual(preflight(parityEnabled, observer), provenance, 'Source or tool files changed during collection');
    const stateSha = sha(original.finalBytes);
    const manifest = { ...provenance, seed, years, replayFormat: 'outcome-replay-v1', valid: true, replayVerified: true, browserEligible: false,
      raw: { sha256: sha(rawBytes), provenance: original.raw.provenance }, classification: replay.classification,
      commandCount: replay.commandCount, commandStreamSha256: replay.commandStreamSha256, contextSha256: sha(replay.contextBytes),
      checkpoints: [], final: { phase: 'final', tick: replay.raw.endTick, hit: true, stateSha, file: 'final-state.json.gz' },
      finalComparison: { expectedSha256: stateSha, actualSha256: sha(replay.finalBytes), expectedChecksum: `sha256:${stateSha}`, actualChecksum: `sha256:${sha(replay.finalBytes)}` },
      registryAnswerSetVerified: replay.registryAnswerSetVerified,
      ...(parityEnabled ? { tlinkParity: { enabled: true, everyTickStateParity: false,
        artifacts: Object.fromEntries(['collect-parity.json', 'replay-parity.json', 'collect-rule-state.json.gz', 'replay-rule-state.json.gz']
          .map(name => [name, sha(readFileSync(join(directory, name)))])) } } : {}),
      verification: { archive: 'entire JSON archive equality', commands: 'entire attempted command stream SHA', contexts: 'entire compressed context SHA',
        final: 'full final state JSON bytes', intermediateFullStatesCompared: 0, browserEvidence: false } };
    const manifestBytes = json(manifest); writeFileSync(join(directory, 'manifest.json'), manifestBytes, { flag: 'wx' });
    write('validity.json', { valid: true, browserEligible: false, manifestSha256: sha(manifestBytes) });
    write('pins.json', { seed, manifestSha256: sha(manifestBytes), rawSha256: sha(rawBytes), years,
      ticksPerSeason: BALANCE.TICKS_PER_YEAR / 4, horizonTicks: 3 * BALANCE.TICKS_PER_YEAR });
    observer?.complete(directory);
    console.log(JSON.stringify({ seed, years, directory, replayVerified: true, classifiedHeavyAnswers: replay.classification.classified.filter(row => row.cameHeavyToLord).length }));
  } catch (error) {
    write('failure.json', { valid: false, seed, years, error: error instanceof Error ? error.message : String(error), sourceRevision: provenance.sourceRevision });
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, output, years, ...extra] = process.argv.slice(2);
  assert.ok(seed && output && extra.length === 0, 'usage: tsx scripts/engineBOutcomeProduce.ts SEED NEW_OUTPUT_ROOT [YEARS=125]');
  produceOutcomeReplay(Number(seed), output, years === undefined ? 125 : Number(years));
}
