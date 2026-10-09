import { isDeepStrictEqual } from 'node:util';
import { requireOutcome } from './engineBOutcomeArchive.mjs';

const positive = value => Number.isSafeInteger(value) && value > 0;
const nonempty = value => typeof value === 'string' && value.length > 0;
const scalar = value => value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
function readPath(record, path) {
  requireOutcome(Array.isArray(path) && path.length > 0 && path.every(key => nonempty(key) && !['__proto__', 'prototype', 'constructor'].includes(key)), 'invalid evidence path');
  let value = record;
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return scalar(value) ? value : undefined;
}
function contractMap(contract) {
  requireOutcome(contract?.schemaVersion === 1 && Array.isArray(contract.events), 'contract schema missing');
  requireOutcome(/^[a-f0-9]{40}$/.test(contract.provenance?.sourceRevision ?? '') && Array.isArray(contract.provenance.sourceFiles)
    && contract.provenance.sourceFiles.length > 0 && contract.provenance.sourceFiles.every(row => nonempty(row.path) && /^[a-f0-9]{64}$/.test(row.sha256)), 'contract provenance missing');
  const map = new Map(), events = new Set();
  for (const event of contract.events) {
    requireOutcome(nonempty(event.id) && !events.has(event.id) && Array.isArray(event.choices), 'duplicate/invalid contract event'); events.add(event.id);
    for (const choice of event.choices) {
      const key = `registry:${event.id}:${choice.id}`;
      requireOutcome(nonempty(choice.id) && !map.has(key) && Array.isArray(choice.outcomes), 'duplicate/invalid contract choice');
      const ids = new Set();
      for (const outcome of choice.outcomes) {
        requireOutcome(nonempty(outcome.id) && !ids.has(outcome.id), 'duplicate/invalid outcome'); ids.add(outcome.id);
        const matcher = outcome.evidenceMatcher;
        if (!matcher) continue;
        requireOutcome(['decision', 'occurrence'].includes(matcher.answerTarget?.record) && Array.isArray(matcher.conditions)
          && matcher.conditions.length > 0 && matcher.conditions.every(condition => ['decision', 'occurrence', 'result'].includes(condition.record) && scalar(condition.equals)), 'invalid condition/target matcher');
        readPath({}, matcher.answerTarget.path); readPath({}, matcher.resultTarget?.path);
        for (const path of matcher.resultTarget.alternatives ?? []) readPath({}, path);
        if (matcher.resultKey) {
          requireOutcome(['result', 'ownCause'].includes(matcher.resultKey.record), 'invalid result key source');
          readPath({}, matcher.resultKey.path);
        }
        for (const condition of matcher.conditions) readPath({}, condition.path);
        requireOutcome(Array.isArray(outcome.expectedResultTemplates) && outcome.expectedResultTemplates.length > 0
          && outcome.expectedResultTemplates.every(nonempty) && !outcome.expectedResultTemplates.includes('decision.card')
          && Array.isArray(outcome.expectedResultKeys) && outcome.expectedResultKeys.length > 0 && outcome.expectedResultKeys.every(nonempty), 'specific result template/key required');
        requireOutcome(outcome.primaryDirectDecisionLink?.required === true && outcome.primaryDirectDecisionLink.identity === 'successful_answer_history_id', 'exact answer identity contract required');
      }
      map.set(key, choice);
    }
  }
  return map;
}
function assessStrict(answer, decision, occurrence, receipts, choice, compatible, options) {
  if (!compatible) return { status: 'unlinked', reason: 'contract_source_mismatch' };
  if (!choice) return { status: 'unlinked', reason: 'contract_uncovered' };
  let conditional = null;
  for (const outcome of choice.outcomes) {
    const matcher = outcome.evidenceMatcher;
    if (!matcher || !positive(outcome.withinSeasons)) continue;
    const context = { decision, occurrence };
    const expectedTarget = readPath(context[matcher.answerTarget.record], matcher.answerTarget.path);
    if (expectedTarget === undefined || expectedTarget === null) continue;
    const candidates = receipts.filter(receipt => receipt.tick <= answer.tick + outcome.withinSeasons * options.ticksPerSeason
      && outcome.expectedResultTemplates.includes(receipt.template));
    for (const result of candidates) {
      const ownCause = result.because?.find(cause => cause.decisionId === answer.historyId);
      const resultKey = readPath(matcher.resultKey?.record === 'ownCause' ? ownCause : result, matcher.resultKey?.path ?? ['params', 'key']);
      if (!outcome.expectedResultKeys.includes(resultKey)) continue;
      const resultTargetPath = [matcher.resultTarget.path, ...(matcher.resultTarget.alternatives ?? [])].find(path => readPath(result, path) === expectedTarget);
      if (!resultTargetPath) continue;
      const actualTarget = readPath(result, resultTargetPath);
      const evidence = matcher.conditions.map(condition => ({ ...condition, actual: readPath({ ...context, result }[condition.record], condition.path) }));
      if (evidence.some(row => row.actual === undefined)) continue;
      const row = { outcomeId: outcome.id, receiptId: result.id, resultKey, resultTargetPath, expectedTarget, actualTarget, conditionEvidence: evidence };
      if (evidence.some(value => value.actual !== value.equals)) { conditional = row; continue; }
      if (result.because?.[0]?.decisionId === answer.historyId && result.because[0].key === resultKey)
        return { status: 'direct', reason: 'primary_exact_answer_target_condition_match', ...row };
    }
    const answerConditions = matcher.conditions.filter(condition => condition.record !== 'result');
    if (answerConditions.length === matcher.conditions.length) {
      const evidence = answerConditions.map(condition => ({ ...condition, actual: readPath(context[condition.record], condition.path) }));
      if (evidence.every(row => row.actual !== undefined) && evidence.some(row => row.actual !== row.equals))
        conditional = { outcomeId: outcome.id, conditionEvidence: evidence, expectedTarget };
    }
  }
  return conditional ? { status: 'conditional', reason: 'condition_observed_not_met', ...conditional }
    : { status: 'unlinked', reason: 'no_proven_primary_target_condition_result' };
}
const counts = rows => Object.fromEntries(['direct', 'conditional', 'insufficient-observation', 'unlinked'].map(status => [status, rows.filter(row => row.status === status).length]));
const fraction = (numerator, denominator) => ({ numerator, denominator, ratio: denominator ? numerator / denominator : null,
  threshold: 0.8, thresholdMet: denominator > 0 && numerator * 5 >= denominator * 4 });

/** Primary gate preserves the historical exact-own-answer future receipt metric; stricter contract audit is separate. */
export function scoreOutcomeGate(runs, contract, options) {
  requireOutcome(Array.isArray(runs) && runs.length > 0 && positive(options?.horizonTicks) && positive(options.ticksPerSeason), 'runs/horizon missing');
  requireOutcome(options.horizonTicks === 12 * options.ticksPerSeason, 'three-year horizon requires twelve seasons');
  const contracts = contractMap(contract), seeds = new Set(), answers = [], inputs = [];
  const reference = runs[0].manifest;
  let unclassified = 0;
  for (const run of runs) {
    requireOutcome(!seeds.has(run.raw.seed), 'duplicate seed'); seeds.add(run.raw.seed);
    requireOutcome(run.manifest.sourceRevision === reference.sourceRevision && run.manifest.source.lock === reference.source.lock
      && run.manifest.source.node === reference.source.node && run.manifest.source.platform === reference.source.platform
      && isDeepStrictEqual(run.manifest.toolHashes, reference.toolHashes), 'cross-run provenance mismatch');
    requireOutcome(run.raw.endTick === runs[0].raw.endTick && run.raw.startYear === runs[0].raw.startYear, 'cross-run interval mismatch');
    requireOutcome(run.raw.endTick === 125 * 4 * options.ticksPerSeason, 'calendar tick interval mismatch');
    unclassified += run.classification.unclassified.length;
    const productPins = new Map((run.raw.provenance.sourceFiles ?? []).map(row => [row.path, row.sha256]));
    const contractCompatible = productPins.size > 0 ? contract.provenance.sourceFiles.every(row => productPins.get(row.path) === row.sha256)
      : contract.provenance.sourceRevision === run.pins.sourceRevision;
    inputs.push({ ...run.pins, contractSourceCompatible: contractCompatible });
    const byCause = new Map();
    for (const history of run.history.values()) {
      if (history.kind === 'decision') continue;
      for (const cause of new Set((history.because ?? []).map(row => row.decisionId))) {
        if (!byCause.has(cause)) byCause.set(cause, []);
        byCause.get(cause).push(history);
      }
    }
    for (const answer of run.classification.rows.filter(row => row.status === 'classified' && row.cameHeavyToLord === true)) {
      const decision = run.history.get(answer.historyId);
      const receipts = (byCause.get(answer.historyId) ?? []).filter(row => row.tick > answer.tick && row.tick <= Math.min(run.raw.endTick, answer.tick + options.horizonTicks))
        .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
      const occurrence = run.occurrences.get(decision.params?.subjectId);
      if (answer.kind === 'registry') requireOutcome(occurrence?.status === 'answered' && occurrence.settledTick === answer.tick
        && answer.source === `registry:${occurrence.entryId}:${occurrence.choiceId}`, 'registry occurrence mismatch');
      const mature = answer.tick + options.horizonTicks <= run.raw.endTick;
      const strictAudit = assessStrict(answer, decision, occurrence, receipts, contracts.get(answer.source), contractCompatible, options);
      const ownRoot = run.roots.get(answer.historyId);
      const inferred = ownRoot ? [] : [...run.roots.values()].filter(root => root.tick <= answer.tick && answer.tick <= (root.lastTick ?? root.tick)
        && (root.source === answer.source || (root.also ?? []).includes(answer.source))).map(root => ({ id: root.id, tick: root.tick, lastTick: root.lastTick ?? root.tick }));
      answers.push({ seed: run.raw.seed, ordinal: answer.ordinal, historyId: answer.historyId, tick: answer.tick, command: answer.command, source: answer.source,
        mature, conditionalExpectations: (contracts.get(answer.source)?.outcomes ?? []).filter(row => row.effectKind === 'conditional').map(row => ({ outcomeId: row.id, condition: row.explicitCondition ?? null, conditionEvidence: 'unknown' })),
        status: !mature ? 'insufficient-observation' : receipts.length ? 'direct' : strictAudit.status === 'conditional' ? 'conditional' : 'unlinked',
        directReceipts: receipts.map(row => ({ id: row.id, tick: row.tick, template: row.template, key: row.params?.key ?? null,
          primaryOrderedCause: row.because?.[0]?.decisionId === answer.historyId, target: row.params?.target ?? null })),
        sameTickOwnLinks: (byCause.get(answer.historyId) ?? []).filter(row => row.tick === answer.tick && row.template !== 'decision.card').map(row => ({ id: row.id, tick: row.tick, template: row.template })),
        ownRootId: ownRoot?.id ?? null, inferredRootCandidates: inferred, inferredMembershipVerified: false,
        strictAudit: mature ? strictAudit : { ...strictAudit, status: 'insufficient-observation', observedStatus: strictAudit.status } });
    }
  }
  const mature = answers.filter(row => row.mature), summary = counts(answers);
  const legacyDirectRatio = fraction(mature.filter(row => row.directReceipts.length > 0).length, mature.length);
  const strictContractDirectRatio = fraction(mature.filter(row => row.strictAudit.status === 'direct').length, mature.length);
  return { schemaVersion: 1, criterion: 'exact_own_answer_future_receipt_at_least_80_percent', pass: legacyDirectRatio.thresholdMet && unclassified === 0, counts: summary, legacyDirectRatio,
    strictContractDirectRatio, strictCounts: counts(answers.map(row => row.strictAudit)),
    scope: { yearsPerSeed: 125, seeds: [...seeds].sort((a, b) => a - b), startYear: runs[0].raw.startYear,
      endYearExclusive: runs[0].raw.endYearExclusive, endTick: runs[0].raw.endTick, ...options },
    coverage: { classifiedHeavyAnswers: answers.length, matureAnswers: mature.length, unclassifiedCommands: unclassified,
      unclassified: runs.flatMap(run => run.classification.unclassified.map(row => ({ seed: run.raw.seed, ...row }))),
      answersWithConditionalExpectations: answers.filter(row => row.conditionalExpectations.length > 0).length,
      unlinkedWithConditionalExpectations: answers.filter(row => row.status === 'unlinked' && row.conditionalExpectations.length > 0).length,
      contractCoveredAnswers: answers.filter(row => contracts.has(row.source)).length },
    inputs, contractSourceRevision: contract.provenance.sourceRevision, answers,
    limitations: ['Same-tick links are observations only, not proven immediate state effects and not part of the historical future ratio.',
      'Primary80% is exact own-answer future because identity, not validated primary cause, target, rendered visibility or gameplay effect.',
      'Conditional-not-met remains in the mature denominator. Censored rows retain observed receipts but are outside that denominator.',
      'Strict audit requires source-compatible executable target/condition evidence; unsupported immediate state outcomes are not scored as future receipts.',
      'Ordered first because is primary attribution, not independent proof of causal sufficiency. Inferred roots are not canonical membership.',
      'Replay validity assertions and byte pins are checked offline; this command does not rerun engines or reclassify original contexts.'] };
}
