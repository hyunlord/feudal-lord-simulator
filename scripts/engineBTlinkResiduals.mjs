import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { verifyOutcomeReplay, outcomeSha256, requireOutcome } from './engineBOutcomeArchive.mjs';
import { scoreOutcomeGate } from './engineBOutcomeGate.mjs';

export const RESIDUAL_SOURCE_FILES = ['src/engine/history.ts', 'src/engine/estateSuits.ts', 'src/engine/stewardship.ts', 'src/engine/decisionTraceAnswerReceipts.ts'];
// The reviewed diff only adds card presentation params; both BIG decision branches are unchanged.
export const PHASE_HISTORY_SOURCES = [
  { revision: '64a16b5a6c1d91024415039db89bb88412528e15', sha256: 'f1872051959a546188109683e61a317d27c41ed8ea73443a5fe6e8b3c5452215' },
  { revision: 'f527d6856a21ddf5943fd8094bc24a06f54ade97', sha256: '133037b55d3c0c0c9f9147f0799053a47d0de7c07a5ddc8a28c8971172087429' },
];
const root = fileURLToPath(new URL('../', import.meta.url));
const categories = ['insufficient-observation', 'immediate-only-observed', 'conditional-unmet-observed', 'unexplained'];
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));
const sourcePins = () => RESIDUAL_SOURCE_FILES.map(path => ({ path, sha256: outcomeSha256(readFileSync(join(root, path))) }));
const scorerHashes = () => Object.fromEntries(['Archive', 'Gate', 'Run'].map(name => [`engineBOutcome${name}.mjs`, outcomeSha256(readFileSync(new URL(`engineBOutcome${name}.mjs`, import.meta.url)))]));
const futureReceipts = (run, answer, horizon) => [...run.history.values()].filter(record => record.kind !== 'decision'
  && record.tick > answer.tick && record.tick <= Math.min(run.raw.endTick, answer.tick + horizon)
  && record.because?.some(cause => cause.decisionId === answer.historyId)).map(record => ({ id: record.id, tick: record.tick, template: record.template }));

function observedEnforcement(run, answer, compatible) {
  if (!compatible || answer.command !== 'enforce_possession') return null;
  const decision = run.history.get(answer.historyId), target = decision.params?.subjectId;
  if (typeof target !== 'string' || !target) return null;
  const matches = [...run.history.values()].filter(record => record.id !== answer.historyId && record.kind === 'event'
    && record.template === 'estate.possession_enforced' && record.tick === answer.tick
    && record.params?.suit === target && Number.isSafeInteger(record.params.attempt) && record.params.attempt > 0
    && [0, 1].includes(record.params.succeeded)
    && record.because?.some(cause => cause.decisionId === answer.historyId && cause.key === 'decision_effect'));
  if (matches.length !== 1) return null;
  const record = matches[0], succeeded = record.params.succeeded === 1;
  return { category: succeeded ? 'immediate-only-observed' : 'conditional-unmet-observed',
    reason: succeeded ? 'possession_enforcement_succeeded_and_closed_at_answer' : 'possession_success_false_at_this_attempt_only',
    predicate: { name: 'possession_succeeded_at_answer', actual: record.params.succeeded, equals: 1, satisfied: succeeded, scope: 'answer_tick_only_not_entire_future_window' },
    evidence: [{ recordId: decision.id, path: ['params', 'subjectId'], value: target },
      { recordId: record.id, path: ['params', 'suit'], value: target },
      { recordId: record.id, path: ['params', 'succeeded'], value: record.params.succeeded },
      { recordId: record.id, path: ['because'], value: record.because }],
    source: ['src/engine/history.ts:1209', 'src/engine/estateSuits.ts:240-265', 'src/engine/decisionTraceAnswerReceipts.ts:62-75'] };
}

function verifiedContexts(run, bytes) {
  if (bytes === undefined) return null;
  requireOutcome(bytes instanceof Uint8Array && outcomeSha256(bytes) === run.manifest.contextSha256, 'context hash mismatch');
  const rows = parse(gunzipSync(bytes));
  requireOutcome(Array.isArray(rows) && rows.length === run.manifest.commandCount, 'context array/count invalid');
  const byOrdinal = new Map();
  for (const row of rows) {
    requireOutcome(row && Number.isSafeInteger(row.ordinal) && row.ordinal >= 1 && row.ordinal <= rows.length
      && !byOrdinal.has(row.ordinal) && Number.isSafeInteger(row.tick) && row.tick >= 0
      && row.command && typeof row.command.type === 'string' && typeof row.stateChanged === 'boolean'
      && typeof row.agencyPresent === 'boolean' && row.context && typeof row.context === 'object', 'context shape/ordinal invalid');
    byOrdinal.set(row.ordinal, row);
  }
  return byOrdinal;
}

function observedSettlement(run, answer, compatible, contexts) {
  if (!compatible || !['answer_estate_petition', 'answer_counter'].includes(answer.command)) return null;
  const decision = run.history.get(answer.historyId), target = decision.params?.subjectId, chosen = decision.params?.chosen;
  if (decision.params?.command !== answer.command || typeof target !== 'string' || !target) return null;
  let template, matchesTarget, contextEvidence = [];
  if (answer.command === 'answer_counter') {
    if (!['accepted', 'declined'].includes(chosen) || answer.source !== `answer_counter:${target}`) return null;
    template = chosen === 'accepted' ? 'negotiation.accepted' : 'negotiation.withdrawn';
    matchesTarget = record => record.params?.negotiation === target;
  } else {
    const context = contexts?.get(answer.ordinal), before = context?.context.estateBefore, after = context?.context.estateAfter;
    if (!context || context.tick !== answer.tick || context.command.type !== answer.command || context.command.petitionId !== target
      || typeof context.command.grant !== 'boolean' || !context.stateChanged || !context.agencyPresent
      || !isDeepStrictEqual(context.history, decision) || !Number.isSafeInteger(context.beforeHistoryLength)
      || context.beforeHistoryLength < 0 || !Number.isSafeInteger(context.afterHistoryLength) || context.afterHistoryLength <= context.beforeHistoryLength
      || !before || !after || before.id !== target || after.id !== target || before.status !== 'open'
      || after.status !== (context.command.grant ? 'granted' : 'refused') || chosen !== after.status || after.decidedBy !== 'lord'
      || typeof after.estateId !== 'string' || !after.estateId || after.estateId !== before.estateId || after.kind !== before.kind
      || !Number.isSafeInteger(after.amount) || after.amount <= 0 || after.amount !== before.amount
      || !Number.isSafeInteger(before.tick) || before.tick > answer.tick || before.tick < 0
      || !Number.isSafeInteger(before.deadline) || before.deadline < answer.tick
      || !['repair:granted', 'rent_relief:granted', 'charter_request:refused'].includes(`${after.kind}:${after.status}`)
      || answer.source !== `estate_petition:${after.estateId}:${after.kind}:${after.status}`) return null;
    template = 'stewardship.lord_decided';
    matchesTarget = record => record.params?.kind === after.kind && record.params?.granted === (context.command.grant ? 1 : 0);
    contextEvidence = [{ contextOrdinal: context.ordinal, path: ['command'], value: context.command },
      { contextOrdinal: context.ordinal, path: ['context', 'estateBefore'], value: before },
      { contextOrdinal: context.ordinal, path: ['context', 'estateAfter'], value: after }];
  }
  const matches = [...run.history.values()].filter(record => record.id !== answer.historyId && record.kind === 'event'
    && record.tick === answer.tick && record.template === template && matchesTarget(record)
    && record.because?.some(cause => cause.decisionId === answer.historyId && cause.key === 'decision_effect'));
  if (matches.length !== 1) return null;
  const record = matches[0];
  return { category: 'immediate-only-observed', reason: answer.command === 'answer_counter' ? 'negotiation_status_settled' : 'estate_petition_status_settled',
    evidence: [{ recordId: decision.id, path: ['params'], value: decision.params }, ...contextEvidence,
      { recordId: record.id, path: ['params'], value: record.params }, { recordId: record.id, path: ['because'], value: record.because }],
    source: answer.command === 'answer_counter' ? ['src/engine/history.ts:1143-1151', 'src/engine/decisionTraceAnswerReceipts.ts:62-75']
      : ['src/engine/stewardship.ts:471-499', 'src/engine/history.ts:1104-1105', 'src/engine/decisionTraceAnswerReceipts.ts:62-75'] };
}

/** Offline only: revalidate all archives and recompute the unchanged scorer before annotating residuals. */
export function auditTlinkResiduals({ configBytes, contractBytes, scoreBytes, inputs }) {
  const config = parse(configBytes), contract = parse(contractBytes), score = parse(scoreBytes);
  requireOutcome(config.schemaVersion === 1 && Array.isArray(config.seeds) && config.seeds.length > 0
    && config.seeds.every(seed => Number.isSafeInteger(seed) && seed > 0) && new Set(config.seeds).size === config.seeds.length, 'config seeds invalid');
  requireOutcome(config.contractSha256 === outcomeSha256(contractBytes), 'contract pin mismatch');
  requireOutcome(Array.isArray(inputs) && inputs.length === config.seeds.length && Array.isArray(config.replayPins)
    && config.replayPins.length === inputs.length, 'input/pin count mismatch');
  const runs = inputs.map((input, index) => {
    requireOutcome(input.format === config.replayFormat, 'replay format mismatch');
    const seed = config.seeds[index], pins = config.replayPins.filter(pin => pin.seed === seed);
    requireOutcome(pins.length === 1 && pins[0].manifestSha256 === outcomeSha256(input.manifestBytes)
      && pins[0].rawSha256 === outcomeSha256(input.rawBytes), 'external replay pin mismatch');
    const run = verifyOutcomeReplay(input);
    requireOutcome(run.raw.seed === seed, 'requested seed mismatch');
    return { ...run, contexts: verifiedContexts(run, input.contextBytes), contextSha256: input.contextBytes === undefined ? null : outcomeSha256(input.contextBytes) };
  });
  const recomputed = scoreOutcomeGate(runs, contract, { horizonTicks: config.horizonTicks, ticksPerSeason: config.ticksPerSeason });
  Object.assign(recomputed, { configSha256: outcomeSha256(configBytes), contractSha256: outcomeSha256(contractBytes), scorerHashes: scorerHashes() });
  requireOutcome(isDeepStrictEqual(score, recomputed), 'score does not match pinned archives/current scorer');
  const sources = sourcePins(), residuals = [], phaseAnswers = [], unresolvedUnclassified = [];
  for (const run of runs) {
    const pins = new Map((run.raw.provenance.sourceFiles ?? []).map(row => [row.path, row.sha256]));
    const phaseSource = PHASE_HISTORY_SOURCES.find(row => row.sha256 === pins.get('src/engine/history.ts'));
    const compatible = sources.every(row => pins.get(row.path) === row.sha256);
    for (const answer of score.answers.filter(row => row.seed === run.raw.seed && row.status !== 'direct')) {
      const observed = answer.mature ? observedEnforcement(run, answer, compatible) ?? observedSettlement(run, answer, compatible, run.contexts) : null;
      residuals.push({ seed: run.raw.seed, historyId: answer.historyId, ordinal: answer.ordinal, tick: answer.tick, command: answer.command,
        observedFutureReceipts: answer.directReceipts, category: answer.mature ? 'unexplained' : 'insufficient-observation',
        reason: answer.mature ? (compatible ? 'no_supported_retained_domain_proof' : 'matcher_source_mismatch') : 'three_year_window_not_complete',
        evidence: [{ recordId: answer.historyId, path: ['tick'], value: answer.tick }, { rawPath: ['endTick'], value: run.raw.endTick }],
        source: ['scripts/engineBOutcomeGate.mjs:115-144'], ...observed,
        provenance: { ...run.pins, contextSha256: run.contextSha256, matcherSourceCompatible: compatible, matcherSourceFiles: sources } });
    }
    for (const answer of run.classification.unclassified) {
      const kind = { confirm_palisade_proclamation: 'market_town', confirm_stone_town_proclamation: 'stone_town' }[answer.command];
      const record = run.history.get(answer.historyId);
      if (!phaseSource || !kind || record?.kind !== 'decision' || record.template !== `decision.${kind}` || record.params?.decisionKind !== kind) {
        unresolvedUnclassified.push({ seed: run.raw.seed, ...answer, reason: 'no_supported_source_and_phase_history_proof', provenance: run.pins });
        continue;
      }
      const mature = answer.tick + config.horizonTicks <= run.raw.endTick;
      const receipts = futureReceipts(run, answer, config.horizonTicks);
      phaseAnswers.push({ seed: run.raw.seed, historyId: answer.historyId, tick: answer.tick, command: answer.command, classification: 'phase_big',
        mature, futureReceipts: receipts, status: !mature ? 'insufficient-observation' : receipts.length > 0 ? 'direct' : 'unlinked',
        evidence: { recordId: record.id, kind: record.kind, template: record.template, decisionKind: record.params.decisionKind },
        source: ['src/engine/history.ts:89-97', 'src/engine/history.ts:289-314'], provenance: { ...run.pins, matcherSourceFiles: [{ path: 'src/engine/history.ts', ...phaseSource }] } });
    }
  }
  const direct = score.answers.filter(answer => answer.status === 'direct').length;
  requireOutcome(direct + residuals.length === score.answers.length && new Set(residuals.map(row => `${row.seed}:${row.historyId}`)).size === residuals.length, 'answer conservation failed');
  const maturePhase = phaseAnswers.filter(answer => answer.mature);
  const numerator = score.legacyDirectRatio.numerator + maturePhase.filter(answer => answer.futureReceipts.length > 0).length;
  const denominator = score.legacyDirectRatio.denominator + maturePhase.length;
  return { schemaVersion: 1, evidenceStage: 'offline_residual_annotations', originalScoreSha256: outcomeSha256(scoreBytes),
    originalPrimaryMetric: score.legacyDirectRatio, originalPass: score.pass, originalScoreUnmodified: true,
    conservation: { allOriginalAnswers: score.answers.length, originalDirect: direct, residuals: residuals.length,
      byCategory: Object.fromEntries(categories.map(category => [category, residuals.filter(row => row.category === category).length])) }, residuals,
    supplemental: { phaseAnswers, unresolvedUnclassified, expandedHeavyRatio: { numerator, denominator, ratio: denominator ? numerator / denominator : null, threshold: 0.8, thresholdMet: denominator > 0 && numerator * 5 >= denominator * 4 },
      allUnclassifiedResolved: unresolvedUnclassified.length === 0,
      originalUnclassifiedCount: score.coverage.unclassifiedCommands },
    provenance: { configSha256: outcomeSha256(configBytes), contractSha256: outcomeSha256(contractBytes), inputs: runs.map(run => run.pins),
      toolSha256: outcomeSha256(readFileSync(fileURLToPath(import.meta.url))) },
    limitations: ['Annotations never change the original scorer, denominator, pass flag or receipt sets.',
      'Immediate matchers cover enforcement, counters and three pinned-context estate settlements only; audit/registry and other unsupported outcomes remain unexplained. Estate settlement does not prove completed repairs or actual relation/treasury deltas.',
      'A failed enforcement observes failure at that attempt, not proof that all later eligibility conditions stayed false.',
      'Supplemental phase_big is history-based classification, not reconstructed answer-time weights; same-tick results do not count as future receipts.',
      'No missing receipt proves an unmet condition. This audit proves neither rendered visibility nor complete causality nor gameplay acceptance.'] };
}

export function runTlinkResiduals(configPath, scorePath, outputPath) {
  const configBytes = readFileSync(configPath), config = parse(configBytes), base = dirname(resolve(configPath));
  requireOutcome(Array.isArray(config.seeds) && typeof config.replayDirectory === 'string' && typeof config.rawDirectory === 'string'
    && typeof config.contractFile === 'string', 'config paths/seeds missing');
  const inputs = config.seeds.map(seed => {
    const directory = join(resolve(base, config.replayDirectory), `seed-${seed}`);
    const contextFile = ['original-contexts.json.gz', 'answer-contexts.json.gz'].map(name => join(directory, name)).find(path => existsSync(path));
    return { ...(contextFile ? { contextBytes: readFileSync(contextFile) } : {}), format: config.replayFormat, rawBytes: readFileSync(join(resolve(base, config.rawDirectory), `seed-${seed}.json`)),
      manifestBytes: readFileSync(join(directory, 'manifest.json')), validityBytes: readFileSync(join(directory, 'validity.json')),
      classificationBytes: readFileSync(join(directory, 'answer-classification.json')) };
  });
  const report = auditTlinkResiduals({ configBytes, contractBytes: readFileSync(resolve(base, config.contractFile)), scoreBytes: readFileSync(scorePath), inputs });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  requireOutcome(process.argv.length === 5, 'usage: node scripts/engineBTlinkResiduals.mjs CONFIG SCORE OUTPUT');
  runTlinkResiduals(...process.argv.slice(2));
}
