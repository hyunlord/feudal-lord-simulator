import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitPaths } from './gitPaths.mjs';
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
import { refuseHeavyOnMac } from './remote/localGuard.mjs';

const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function git(...args: string[]): string { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function preflight() {
  assert.equal(realpathSync(process.cwd()), realpathSync(root), 'Run from the producer checkout root');
  assert.equal(gitPaths(['status', '--porcelain'], { cwd: root }).join('\n'), '', 'Outcome producer requires a clean committed checkout');
  const sourceRevision = git('rev-parse', 'HEAD');
  const traceSourceSha256 = verifyOutcomeTaxonomy(readFileSync(join(root, 'src/engine/decisionTrace.ts'), 'utf8'), OUTCOME_COMMAND_KIND);
  const lock = sha(readFileSync(join(root, 'package-lock.json')));
  const toolHashes = Object.fromEntries(['engineBOutcomeProduce.ts', 'engineBOutcomeEvidence.ts', 'engineBOutcomeCollect.ts', 'engineBOutcomeTaxonomy.ts', 'engineBOutcomeArchive.mjs', 'registryDecisionOccurrences.ts']
    .map(name => [name, sha(readFileSync(join(root, 'scripts', name)))]));
  const sourceFiles = gitPaths(['ls-files', 'src'], { cwd: root }).map(path => ({ path, sha256: sha(readFileSync(join(root, path))) }));
  return { sourceRevision, sourceFiles, traceSourceSha256, toolHashes, source: { revision: sourceRevision, platform: process.platform, node: process.version,
    status: '', lock, expectedLock: lock } };
}
function collect(seed: number, years: number, phase: string, provenance: { readonly sourceRevision: string; readonly sourceFiles: readonly { readonly path: string; readonly sha256: string }[] }, directory: string) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
  assert.ok(state !== null && state.tick === 0, 'Fresh lord scenario required');
  const startYear = stateCalendar(state).year, endTick = years * BALANCE.TICKS_PER_YEAR;
  const archive = createOutcomeArchive(), answers = createAnswerEvidenceCollector(), stream = createHash('sha256');
  let commandCount = 0;
  archive.observe(state);
  while (stateCalendar(state).year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const before = state;
      state = gameReducer(before, command);
      commandCount += 1;
      stream.update(json({ ordinal: commandCount, tick: before.tick, command }));
      answers.observe(before, state, command, commandCount);
      archive.observe(state);
    }
    state = advanceTick(state);
    archive.observe(state);
    if (state.tick % 10000 === 0) {
      const progress = { phase, seed, tick: state.tick, endTick, commandCount };
      writeFileSync(join(directory, 'progress.json'), json(progress)); console.log(JSON.stringify(progress));
    }
  }
  assert.equal(state.tick, endTick, 'Unexpected calendar endpoint');
  const contexts = answers.snapshot(), classification = classifyAnswerEvidence(contexts);
  assert.equal(classification.rows.length, commandCount, 'Every attempted command must retain a classification row');
  assert.equal(classification.unresolved.length, 0, 'Unresolved command classification');
  const snapshot = archive.snapshot();
  assert.deepEqual([snapshot.observation.firstTick, snapshot.observation.lastTick, snapshot.observation.maxGap, snapshot.observation.reversals], [0, endTick, 1, 0]);
  const raw = { schemaVersion: 1, seed, years, startYear, endYearExclusive: startYear + years, endTick,
    provenance: { sourceRevision: provenance.sourceRevision, dirtyPaths: '', node: process.version, sourceFiles: provenance.sourceFiles }, ...snapshot };
  const registryAnswerSetVerified = verifyRegistryAnswerSet(raw, classification);
  const finalBytes = json(state), contextBytes = gzipSync(json(contexts));
  return { raw, classification, registryAnswerSetVerified, commandCount, commandStreamSha256: stream.digest('hex'), finalBytes, contextBytes };
}

/** Two ordinary LordBot runs, with passive per-command/per-tick evidence and complete retained-archive equality. */
export function produceOutcomeReplay(seed: number, outputRoot: string, years = 125): void {
  refuseHeavyOnMac('EB-OUTCOME collect and deterministic replay', { remote: 'scripts/remote/run.sh EB-OUTCOME --heavy --experiment -- npx tsx scripts/engineBOutcomeProduce.ts 1 .remote/eb-outcome' });
  assert.equal(process.platform, 'linux', 'Use the official Linux remote runner');
  assert.ok(Number.isSafeInteger(seed) && seed > 0 && Number.isSafeInteger(years) && years > 0 && years <= 125, 'Positive seed and 1..125 years required');
  const provenance = preflight(), directory = join(resolve(outputRoot), `seed-${seed}`);
  mkdirSync(resolve(outputRoot), { recursive: true }); mkdirSync(directory);
  const write = (name: string, value: unknown): void => writeFileSync(join(directory, name), json(value), { flag: 'wx' });
  write('preflight.json', { ...provenance, seed, years, replayFormat: 'outcome-replay-v1' });
  try {
    const original = collect(seed, years, 'collect', provenance, directory);
    const rawBytes = json(original.raw);
    writeFileSync(join(resolve(outputRoot), `seed-${seed}.json`), rawBytes, { flag: 'wx' });
    writeFileSync(join(directory, 'original-contexts.json.gz'), original.contextBytes, { flag: 'wx' });
    writeFileSync(join(directory, 'original-final-state.json.gz'), gzipSync(original.finalBytes), { flag: 'wx' });
    const replay = collect(seed, years, 'replay', provenance, directory);
    writeFileSync(join(directory, 'answer-contexts.json.gz'), replay.contextBytes, { flag: 'wx' });
    write('answer-classification.json', replay.classification);
    writeFileSync(join(directory, 'final-state.json.gz'), gzipSync(replay.finalBytes), { flag: 'wx' });
    assert.equal(json(replay.raw), rawBytes, 'Replay complete retained archive mismatch');
    assert.equal(json(replay.classification), json(original.classification), 'Replay classification mismatch');
    assert.equal(replay.commandStreamSha256, original.commandStreamSha256, 'Replay command stream mismatch');
    assert.equal(sha(replay.contextBytes), sha(original.contextBytes), 'Replay passive context mismatch');
    assert.equal(replay.finalBytes, original.finalBytes, 'Replay final full-state mismatch');
    assert.deepEqual(preflight(), provenance, 'Source or tool files changed during collection');
    const stateSha = sha(original.finalBytes);
    const manifest = { ...provenance, seed, years, replayFormat: 'outcome-replay-v1', valid: true, replayVerified: true, browserEligible: false,
      raw: { sha256: sha(rawBytes), provenance: original.raw.provenance }, classification: replay.classification,
      commandCount: replay.commandCount, commandStreamSha256: replay.commandStreamSha256, contextSha256: sha(replay.contextBytes),
      checkpoints: [], final: { phase: 'final', tick: replay.raw.endTick, hit: true, stateSha, file: 'final-state.json.gz' },
      finalComparison: { expectedSha256: stateSha, actualSha256: sha(replay.finalBytes), expectedChecksum: `sha256:${stateSha}`, actualChecksum: `sha256:${sha(replay.finalBytes)}` },
      registryAnswerSetVerified: replay.registryAnswerSetVerified,
      verification: { archive: 'entire JSON archive equality', commands: 'entire attempted command stream SHA', contexts: 'entire compressed context SHA',
        final: 'full final state JSON bytes', intermediateFullStatesCompared: 0, browserEvidence: false } };
    const manifestBytes = json(manifest); writeFileSync(join(directory, 'manifest.json'), manifestBytes, { flag: 'wx' });
    write('validity.json', { valid: true, browserEligible: false, manifestSha256: sha(manifestBytes) });
    write('pins.json', { seed, manifestSha256: sha(manifestBytes), rawSha256: sha(rawBytes), years,
      ticksPerSeason: BALANCE.TICKS_PER_YEAR / 4, horizonTicks: 3 * BALANCE.TICKS_PER_YEAR });
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
