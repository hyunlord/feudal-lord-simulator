import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scoreTlinkOutcomeCategories } from './engineBTlinkOutcomeCategories.mjs';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { runOutcomeGate } from './engineBOutcomeRun.mjs';
import { outcomeSha256 as sha, requireOutcome as requireProof } from './engineBOutcomeArchive.mjs';

const exclusions = ['history', 'trace.decisions', 'trace.answers'];
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));
function contained(root, name) {
  requireProof(typeof name === 'string' && name.length > 0 && name === name.replaceAll('\\', '/') && !name.split('/').includes('..'), 'artifact path traversal');
  const base = realpathSync(root), path = realpathSync(resolve(base, name)), rel = relative(base, path);
  requireProof(rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep), 'artifact outside root');
  return path;
}
function canonical(value) {
  if (value === null || typeof value !== 'object') {
    requireProof(value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value)), 'unsupported canonical value');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export function tlinkImmediateDifferences(before, after, path = '') {
  if (Object.is(before, after)) return [];
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) !== Array.isArray(after))
    return [{ path: path || '/', beforePresent: true, afterPresent: true, before, after }];
  const result = [];
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const next = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    const beforePresent = Object.hasOwn(before, key), afterPresent = Object.hasOwn(after, key);
    if (!beforePresent || !afterPresent) result.push({ path: next, beforePresent, afterPresent, ...(beforePresent ? { before: before[key] } : {}), ...(afterPresent ? { after: after[key] } : {}) });
    else result.push(...tlinkImmediateDifferences(before[key], after[key], next));
  }
  return result;
}

/** Authenticates retained observer artifacts against original replay archives; never runs the engine or assigns gameplay categories. */
export function loadTlinkCategoryInputs(configPath, scorePath, replayRoot, expectedHelperSha) {
  requireProof(hash(expectedHelperSha), 'explicit helper SHA required');
  const configBytes = readFileSync(configPath), config = parse(configBytes), scoreBytes = readFileSync(scorePath), originalScore = parse(scoreBytes);
  const temporary = mkdtempSync(join(tmpdir(), 'tlink-category-loader-'));
  let recomputedScore;
  try { recomputedScore = runOutcomeGate(configPath, join(temporary, 'score.json')); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
  requireProof(isDeepStrictEqual(originalScore, recomputedScore), 'score differs from authenticated original archives');
  const base = dirname(resolve(configPath)), originalRoot = resolve(base, config.replayDirectory);
  const seedDirectories = readdirSync(replayRoot, { withFileTypes: true }).filter(entry => entry.name.startsWith('seed-')).map(entry => entry.name).sort();
  requireProof(isDeepStrictEqual(seedDirectories, config.seeds.map(seed => `seed-${seed}`).sort()), 'observer seed set mismatch');
  const rows = [], unclassified = [], manifests = [];
  let cohort;
  for (const seed of config.seeds) {
    const directory = contained(replayRoot, `seed-${seed}`), originalDirectory = contained(originalRoot, `seed-${seed}`);
    requireProof(!existsSync(join(directory, 'failure.json')), 'failed/incomplete observer capture');
    const manifestBytes = readFileSync(contained(directory, 'manifest.json')), manifest = parse(manifestBytes);
    const originalManifestBytes = readFileSync(contained(originalDirectory, 'manifest.json')), original = parse(originalManifestBytes);
    requireProof(manifest.schemaVersion === 1 && manifest.status === 'verified_original_replay_observer_capture' && manifest.seed === seed
      && manifest.years === 125 && manifest.tick === original.final.tick && manifest.commandCount === original.commandCount
      && manifest.originalManifestSha256 === sha(originalManifestBytes) && manifest.helperSha256 === expectedHelperSha
      && manifest.sourceRevision === original.sourceRevision && /^[a-f0-9]{40}$/.test(manifest.executionHead ?? '')
      && manifest.node === original.source.node && manifest.lockSha256 === original.source.lock
      && isDeepStrictEqual(manifest.sourceFiles, original.sourceFiles) && isDeepStrictEqual(original.sourceFiles, original.raw.provenance.sourceFiles)
      && isDeepStrictEqual(manifest.toolHashes, original.toolHashes)
      && manifest.commandStreamMatched === true && manifest.collectParityMatched === true && manifest.fullFinalStateMatched === true
      && manifest.categoriesAssigned === false && isDeepStrictEqual(manifest.exclusions, exclusions), 'observer manifest provenance/status mismatch');
    const expectedInputs = ['manifest.json', 'preflight.json', 'original-contexts.json.gz', 'answer-classification.json', 'collect-parity.json', 'original-final-state.json.gz'];
    requireProof(isDeepStrictEqual(Object.keys(manifest.inputHashes ?? {}).sort(), [...expectedInputs].sort()), 'observer input set mismatch');
    const inputs = Object.fromEntries(expectedInputs.map(name => {
      const bytes = readFileSync(contained(originalDirectory, name));
      requireProof(hash(manifest.inputHashes[name]) && sha(bytes) === manifest.inputHashes[name], `observer original input hash mismatch: ${name}`);
      return [name, bytes];
    }));
    const preflight = parse(inputs['preflight.json']), contexts = parse(gunzipSync(inputs['original-contexts.json.gz']));
    const classification = parse(inputs['answer-classification.json']), parity = parse(inputs['collect-parity.json']);
    const finalBytes = gunzipSync(inputs['original-final-state.json.gz']);
    requireProof(preflight.sourceRevision === original.sourceRevision && isDeepStrictEqual(preflight.sourceFiles, original.sourceFiles)
      && isDeepStrictEqual(preflight.toolHashes, original.toolHashes) && preflight.source.node === original.source.node
      && preflight.source.lock === original.source.lock && sha(inputs['original-contexts.json.gz']) === original.contextSha256
      && isDeepStrictEqual(classification, original.classification) && sha(finalBytes) === original.finalComparison.expectedSha256
      && sha(finalBytes) === original.finalComparison.actualSha256 && sha(finalBytes) === original.final.stateSha
      && manifest.originalFullFinalSha256 === sha(finalBytes), 'original source/context/final mismatch');
    requireProof(original.tlinkParity?.enabled === true && original.tlinkParity.artifacts?.['collect-parity.json'] === sha(inputs['collect-parity.json'])
      && parity.finalized === true && parity.commandCount === original.commandCount && parity.lastTick === original.final.tick
      && isDeepStrictEqual(parity.exclusions, exclusions) && Array.isArray(parity.checkpoints), 'original parity incomplete');
    const thisCohort = { sourceRevision: manifest.sourceRevision, sourceFiles: manifest.sourceFiles, toolHashes: manifest.toolHashes, node: manifest.node, lockSha256: manifest.lockSha256, helperSha256: manifest.helperSha256 };
    if (cohort) requireProof(isDeepStrictEqual(cohort, thisCohort), 'observer cross-seed cohort mismatch'); else cohort = thisCohort;
    requireProof(Array.isArray(contexts) && contexts.length === original.commandCount, 'original context count mismatch');
    const selected = new Map(), stream = [];
    for (let index = 0; index < contexts.length; index++) {
      const context = contexts[index], classified = classification.rows[index];
      requireProof(context.ordinal === index + 1 && classified.ordinal === context.ordinal && classified.tick === context.tick
        && classified.command === context.command?.type && classified.historyId === (context.history?.id ?? null), 'original context identity mismatch');
      stream.push(`${JSON.stringify({ ordinal: context.ordinal, tick: context.tick, command: context.command })}\n`);
      if (classified.status === 'unclassified' || classified.status === 'classified' && classified.cameHeavyToLord === true) selected.set(context.ordinal, { context, classified });
    }
    requireProof(sha(stream.join('')) === original.commandStreamSha256, 'original command stream mismatch');
    requireProof(Array.isArray(manifest.files) && manifest.files.length === selected.size, 'observer selected answer count mismatch');
    const used = new Set(), names = new Set();
    for (const file of manifest.files) {
      requireProof(Number.isSafeInteger(file.ordinal) && !used.has(file.ordinal) && !names.has(file.file)
        && file.file === `answer-${String(file.ordinal).padStart(6, '0')}.json.gz` && hash(file.sha256) && hash(file.rawSha256), 'duplicate/invalid observer file');
      used.add(file.ordinal); names.add(file.file);
      const selection = selected.get(file.ordinal); requireProof(selection, 'unexpected observer ordinal');
      const { context, classified } = selection;
      const compressed = readFileSync(contained(directory, file.file)); requireProof(sha(compressed) === file.sha256, 'observer compressed hash mismatch');
      const bytes = gunzipSync(compressed); requireProof(sha(bytes) === file.rawSha256, 'observer raw hash mismatch');
      const row = parse(bytes);
      requireProof(row.schemaVersion === 1 && row.seed === seed && row.ordinal === context.ordinal && row.tick === context.tick
        && row.historyId === classified.historyId && file.historyId === row.historyId && isDeepStrictEqual(row.command, context.command)
        && row.classificationStatus === classified.status && row.cameHeavyToLord === classified.cameHeavyToLord
        && row.mature === (row.tick + config.horizonTicks <= original.final.tick) && row.observerStateHashesStable === true
        && row.categoriesAssigned === false && isDeepStrictEqual(row.exclusions, exclusions)
        && hash(row.rawBeforeSha256) && hash(row.rawAfterSha256), 'observer answer identity/status mismatch');
      requireProof(row.before?.seed === seed && row.after?.seed === seed && row.before.tick === row.tick && row.after.tick === row.tick
        && !Object.hasOwn(row.before, 'history') && !Object.hasOwn(row.after, 'history')
        && !Object.hasOwn(row.before.trace ?? {}, 'decisions') && !Object.hasOwn(row.after.trace ?? {}, 'decisions')
        && !Object.hasOwn(row.before.trace ?? {}, 'answers') && !Object.hasOwn(row.after.trace ?? {}, 'answers')
        && sha(canonical(row.before)) === row.beforeRuleSha256 && sha(canonical(row.after)) === row.afterRuleSha256, 'observer canonical state hash mismatch');
      const checkpoint = parity.checkpoints.filter(point => point.phase === 'command' && point.commandOrdinal === row.ordinal);
      requireProof(checkpoint.length === 1 && checkpoint[0].tick === row.tick && checkpoint[0].hash === row.afterRuleSha256, 'observer after state differs from original checkpoint');
      const beforeCheckpoints = parity.checkpoints.filter(point => point.tick === row.tick && point.commandOrdinal === row.ordinal - 1);
      requireProof(beforeCheckpoints.every(point => point.hash === row.beforeRuleSha256), 'observer before state differs from original checkpoint');
      const differences = tlinkImmediateDifferences(row.before, row.after);
      requireProof(isDeepStrictEqual(differences, row.differences), 'observer differences incomplete/altered');
      const item = { ...row, source: classified.source, differences, deltaPaths: differences.map(delta => ({ ...delta,
        path: delta.path === '/' ? [] : delta.path.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~')) })),
        artifact: { file: file.file, compressedSha256: file.sha256, rawSha256: file.rawSha256 } };
      if (classified.status === 'unclassified') unclassified.push(item); else rows.push(item);
    }
    requireProof(manifest.selectedHeavy === [...selected.values()].filter(item => item.classified.status === 'classified').length
      && manifest.unclassified === [...selected.values()].filter(item => item.classified.status === 'unclassified').length, 'observer class counts mismatch');
    manifests.push({ seed, sha256: sha(manifestBytes), originalManifestSha256: sha(originalManifestBytes) });
  }
  const byAnswer = new Map(rows.map(row => [`${row.seed}:${row.historyId}`, row]));
  requireProof(byAnswer.size === rows.length && rows.length === originalScore.answers.length && originalScore.answers.every(answer => {
    const row = byAnswer.get(`${answer.seed}:${answer.historyId}`);
    return row && ['ordinal', 'tick', 'source', 'mature'].every(key => row[key] === answer[key]) && row.command.type === answer.command;
  }), 'observer/legacy heavy answer set mismatch');
  return { scoreBytes, recomputedScore, rows, unclassified, provenance: { ...cohort, manifests, configSha256: sha(configBytes), originalScoreSha256: sha(scoreBytes) },
    limitations: ['Pinned observer code and original replay inputs establish capture provenance; flags alone are not verification.',
      'The new official observer run is the measurement authority for before states absent from original checkpoints. Publication must retain the external terminal run receipt and exact per-seed observer manifests matching provenance.manifests hashes.',
      'Canonical after states are checked against original command checkpoints. Before states are checkpoint-checked only where an original same-tick checkpoint exists.',
      'Raw before/after hash fields have no retained raw mid-state bytes here; only their format is checked. Canonical projections and exhaustive differences are independently recomputed.',
      'This loader performs no engine replay and makes no gameplay-versus-bookkeeping or outcome category judgment.'] };
}

/** Writes only after archive verification, source-reviewed mapping and score conservation have all succeeded. */
export async function runTlinkOutcomeCategories({ configPath, scorePath, replayRoot, expectedHelperSha, outputPath }) {
  requireProof(typeof outputPath === 'string' && outputPath.length > 0 && !existsSync(outputPath), 'new report output required');
  const loaded = loadTlinkCategoryInputs(configPath, scorePath, replayRoot, expectedHelperSha);
  const { buildTlinkOutcomeEvidence } = await import('./engineBTlinkOutcomeEvidence.mjs');
  const evidence = buildTlinkOutcomeEvidence(loaded);
  const report = scoreTlinkOutcomeCategories({ scoreBytes: loaded.scoreBytes, recomputedScore: loaded.recomputedScore,
    evidence, expectedProvenance: loaded.provenance });
  report.capture = { heavyAnswers: loaded.rows.length, unclassifiedOutsideOriginalDenominator: loaded.unclassified.map(row => ({
    seed: row.seed, ordinal: row.ordinal, tick: row.tick, historyId: row.historyId, command: row.command, artifact: row.artifact })),
    artifacts: loaded.rows.map(row => ({ seed: row.seed, historyId: row.historyId, ordinal: row.ordinal, artifact: row.artifact })) };
  report.semanticEvidence = evidence;
  report.limitations = [...loaded.limitations, ...report.limitations, ...(evidence.limitations ?? [])];
  report.toolHashes = Object.fromEntries(['engineBTlinkOutcomeCategoriesRun.mjs', 'engineBTlinkOutcomeCategories.mjs', 'engineBTlinkOutcomeEvidence.mjs']
    .map(name => [name, sha(readFileSync(new URL(name, import.meta.url)))]));
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [configPath, scorePath, replayRoot, expectedHelperSha, outputPath, ...extra] = process.argv.slice(2);
  requireProof(configPath && scorePath && replayRoot && expectedHelperSha && outputPath && extra.length === 0,
    'usage: node scripts/engineBTlinkOutcomeCategoriesRun.mjs CONFIG SCORE OBSERVER_ROOT EXPECTED_HELPER_SHA NEW_OUTPUT');
  const report = await runTlinkOutcomeCategories({ configPath, scorePath, replayRoot, expectedHelperSha, outputPath });
  console.log(JSON.stringify({ originalFuture: report.originalPrimaryMetric, summary: report.summary, bySeed: report.bySeed }));
  process.exitCode = report.summary.prototypeGate.pass ? 0 : 1;
}
