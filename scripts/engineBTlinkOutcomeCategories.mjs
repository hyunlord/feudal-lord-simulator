import { isDeepStrictEqual } from 'node:util';
import { outcomeSha256, requireOutcome } from './engineBOutcomeArchive.mjs';

export const TLINK_OUTCOME_CATEGORIES = ['outcome-visible', 'inert', 'explanation-incomplete', 'insufficient-observation', 'condition-unmet'];
const kinds = ['money', 'relation', 'rights', 'land', 'person', 'command-state', 'bookkeeping'];
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const pathKey = path => JSON.stringify(path);
const validPath = path => Array.isArray(path) && path.length > 0 && path.every(part => typeof part === 'string' && part.length > 0 && !['__proto__', 'prototype', 'constructor'].includes(part));
const jsonValue = value => value === null || typeof value === 'string' || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value)) || (Array.isArray(value) && value.every(jsonValue))
  || (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(jsonValue));
const changed = effect => effect.beforePresent !== effect.afterPresent || !isDeepStrictEqual(effect.before, effect.after);
const pinsValid = pins => Array.isArray(pins) && pins.length > 0 && pins.every(pin => typeof pin.path === 'string' && pin.path.length > 0 && hash(pin.sha256))
  && new Set(pins.map(pin => pin.path)).size === pins.length;

function validateProof(row, answer, provenance) {
  requireOutcome(row && !Object.hasOwn(row, 'category') && ['seed', 'historyId', 'ordinal', 'tick', 'source'].every(key => row[key] === answer[key]), 'proof identity/category invalid');
  requireOutcome(typeof row.proofComplete === 'boolean' && Array.isArray(row.effects) && Array.isArray(row.scope?.relevantPaths)
    && pinsValid(row.scope.sourceFiles), 'proof scope missing');
  requireOutcome(row.scope.sourceFiles.every(pin => provenance.sourceFiles.some(source => source.path === pin.path && source.sha256 === pin.sha256)), 'proof source mismatch');
  const paths = row.scope.relevantPaths.map(path => { requireOutcome(validPath(path), 'scope path invalid'); return pathKey(path); });
  requireOutcome(new Set(paths).size === paths.length, 'duplicate scope path');
  const effects = new Set();
  for (const effect of row.effects) {
    requireOutcome(validPath(effect.path) && kinds.includes(effect.kind) && typeof effect.beforePresent === 'boolean'
      && typeof effect.afterPresent === 'boolean' && jsonValue(effect.before) && jsonValue(effect.after)
      && (effect.beforePresent || effect.before === null) && (effect.afterPresent || effect.after === null), 'effect shape invalid');
    const key = pathKey(effect.path);
    requireOutcome(!effects.has(key) && paths.includes(key), 'duplicate or out-of-scope effect'); effects.add(key);
  }
  if (row.proofComplete) requireOutcome(paths.length > 0 && paths.length === effects.size, 'complete proof has uncovered paths');
  if (row.condition != null) {
    const condition = row.condition;
    requireOutcome(typeof condition.outcomeId === 'string' && answer.conditionalExpectations?.some(item => item.outcomeId === condition.outcomeId)
      && condition.observed === false && condition.expected === true && condition.scope === 'entire_observation_window'
      && Array.isArray(condition.evidence) && condition.evidence.length > 0 && condition.evidence.every(item => validPath(item.path) && jsonValue(item.value))
      && pinsValid(condition.sourceFiles) && condition.sourceFiles.every(pin => provenance.sourceFiles.some(source => source.path === pin.path && source.sha256 === pin.sha256)), 'condition proof invalid');
  }
}

function summarize(rows) {
  const counts = Object.fromEntries(TLINK_OUTCOME_CATEGORIES.map(category => [category, rows.filter(row => row.category === category).length]));
  const mature = rows.filter(row => row.mature).length, censored = rows.length - mature;
  const fraction = numerator => ({ numerator, denominator: mature, ratio: mature ? numerator / mature : null, percent: mature ? numerator * 100 / mature : null });
  requireOutcome(Object.values(counts).reduce((sum, value) => sum + value, 0) === rows.length
    && counts['insufficient-observation'] === censored, 'category conservation failed');
  return { allAnswers: rows.length, matureAnswers: mature, censoredAnswers: censored, counts,
    fourCategories: { a: counts['outcome-visible'], b: counts.inert, c: counts['explanation-incomplete'],
      d: { total: counts['condition-unmet'] + censored, matureConditionUnmet: counts['condition-unmet'], outsideDenominatorInsufficientObservation: censored } },
    matureRatios: Object.fromEntries(TLINK_OUTCOME_CATEGORIES.filter(category => category !== 'insufficient-observation').map(category => [category, fraction(counts[category])])),
    prototypeGate: { ...fraction(counts['explanation-incomplete']), maximumRatio: 0.1, pass: mature > 0 && counts['explanation-incomplete'] * 10 <= mature },
    finalGate: { ...fraction(counts['outcome-visible']), minimumRatio: 0.8, pass: mature > 0 && counts['outcome-visible'] * 5 >= mature * 4 } };
}

/** Pure aggregation. The caller must replay and validate effect bytes, exhaustive scope and source-reviewed gameplay/bookkeeping mapping. */
export function scoreTlinkOutcomeCategories({ scoreBytes, recomputedScore, evidence, expectedProvenance }) {
  requireOutcome(scoreBytes instanceof Uint8Array, 'original score bytes missing');
  const originalScore = JSON.parse(Buffer.from(scoreBytes).toString('utf8'));
  requireOutcome(isDeepStrictEqual(originalScore, recomputedScore), 'original score differs from recomputed score');
  const originalScoreSha256 = outcomeSha256(scoreBytes);
  requireOutcome(evidence?.schemaVersion === 1 && evidence.originalScoreSha256 === originalScoreSha256
    && isDeepStrictEqual(evidence.provenance, expectedProvenance) && pinsValid(evidence.provenance?.sourceFiles)
    && /^[a-f0-9]{40}$/.test(evidence.provenance.sourceRevision ?? '') && Array.isArray(evidence.rows), 'evidence provenance invalid');
  const sourceRevisions = originalScore.inputs?.map(input => input.sourceRevision);
  requireOutcome(Array.isArray(sourceRevisions) && sourceRevisions.length > 0 && sourceRevisions.every(revision => revision === evidence.provenance.sourceRevision), 'original/effect source revision mismatch');
  requireOutcome(Array.isArray(originalScore.answers) && originalScore.answers.length === evidence.rows.length
    && Array.isArray(originalScore.scope?.seeds) && new Set(originalScore.scope.seeds).size === originalScore.scope.seeds.length, 'answer/seed count invalid');
  const proofs = new Map();
  for (const row of evidence.rows) {
    const key = `${row.seed}:${row.historyId}`;
    requireOutcome(!proofs.has(key), 'duplicate proof row'); proofs.set(key, row);
  }
  const seen = new Set();
  const answers = originalScore.answers.map(answer => {
    const key = `${answer.seed}:${answer.historyId}`;
    requireOutcome(!seen.has(key) && originalScore.scope.seeds.includes(answer.seed) && typeof answer.mature === 'boolean', 'duplicate/invalid original answer'); seen.add(key);
    const proof = proofs.get(key); validateProof(proof, answer, evidence.provenance);
    const gameplay = proof.effects.filter(effect => effect.kind !== 'bookkeeping');
    const actualEffects = gameplay.filter(changed), excludedBookkeepingChanges = proof.effects.filter(effect => effect.kind === 'bookkeeping' && changed(effect));
    const actualImmediateInert = proof.proofComplete && actualEffects.length === 0;
    const future = Array.isArray(answer.directReceipts) && answer.directReceipts.length > 0;
    let category, reason;
    if (!answer.mature) { category = 'insufficient-observation'; reason = 'three_year_window_not_complete'; }
    else if (future) { category = 'outcome-visible'; reason = 'legacy_exact_own_future_receipt'; }
    else if (actualEffects.length > 0) { category = 'outcome-visible'; reason = 'actual_immediate_gameplay_change'; }
    else if (proof.condition != null) { category = 'condition-unmet'; reason = 'explicit_entire_window_condition_unmet'; }
    else if (actualImmediateInert && !answer.conditionalExpectations?.length) { category = 'inert'; reason = 'all_gameplay_effects_unchanged'; }
    else { category = 'explanation-incomplete'; reason = answer.conditionalExpectations?.length > 0 ? 'expected_future_unlinked' : 'evidence_missing_not_proven_inert_or_conditional'; }
    return { seed: answer.seed, historyId: answer.historyId, ordinal: answer.ordinal, tick: answer.tick, source: answer.source,
      command: answer.command, mature: answer.mature, category, reason, actualImmediateInert, actualEffects, excludedBookkeepingChanges,
      condition: proof.condition ?? null, proofComplete: proof.proofComplete, scope: proof.scope, originalStatus: answer.status };
  });
  const summary = summarize(answers);
  requireOutcome(summary.matureAnswers === originalScore.legacyDirectRatio?.denominator
    && answers.filter(answer => answer.mature && answer.reason === 'legacy_exact_own_future_receipt').length === originalScore.legacyDirectRatio.numerator, 'original denominator/numerator mismatch');
  return { schemaVersion: 1, criterion: 'actual_immediate_or_exact_future_outcome_four_categories', originalScoreSha256, originalScore,
    originalScoreUnmodified: true, originalPrimaryMetric: originalScore.legacyDirectRatio, originalPass: originalScore.pass,
    summary, bySeed: originalScore.scope.seeds.map(seed => ({ seed, ...summarize(answers.filter(answer => answer.seed === seed)) })), answers,
    provenance: evidence.provenance,
    limitations: ['This pure aggregator requires upstream verification of replay artifacts, actual before/after values, exhaustive relevant paths and source-reviewed field kinds.',
      'Bookkeeping transitions never prove a visible gameplay effect. Unknown evidence remains explanation-incomplete conservatively.',
      'Immature answers remain outside the unchanged mature denominator even when immediate or future effects were observed.',
      'Outcome-visible retains the original future-receipt definition; it is not an independent rendered-screen acceptance test.'] };
}
