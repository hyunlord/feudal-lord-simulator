/** Offline occurrence answers; deliberately separate from the engine's root-matter statistics. */
const YEAR_TICKS = 4000;
const FUTURE_TICKS = 12000;
function unique(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`Missing ${label} array`);
  const result = new Map();
  for (const row of rows) {
    if (typeof row.id !== 'string') throw new Error(`Missing ${label} identity`);
    const prior = result.get(row.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error(`Conflicting ${label} identity: ${row.id}`);
    result.set(row.id, row);
  }
  return [...result.values()];
}
function statistics(counts) {
  const sorted = [...counts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { total: counts.reduce((sum, count) => sum + count, 0), countedYears: counts.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    maximum: sorted.at(-1), zeroYears: counts.filter(count => count === 0).length,
    aboveFourYears: counts.filter(count => count > 4).length };
}
function coverage(rows) {
  return { counted: rows.length, directWithFuture: rows.filter(row => row.directFuture.length > 0).length,
    inferredRootWithFuture: rows.filter(row => row.indirectFuture.length > 0).length,
    ambiguousRootCandidates: rows.filter(row => row.rootInference.status === 'ambiguous').length };
}

export function summarizeRegistryAnswers(run) {
  if (!Number.isSafeInteger(run.years) || run.years < 1 || !Number.isSafeInteger(run.startYear)
    || !Number.isSafeInteger(run.endTick) || run.endTick < 0) throw new Error('Invalid audit interval');
  const endExclusive = run.years * YEAR_TICKS;
  const history = unique(run.history, 'history');
  const decisions = unique(run.decisions, 'decision');
  const occurrences = unique(run.occurrences, 'occurrence').filter(row => row.offeredTick >= 0 && row.offeredTick < endExclusive);
  const answers = [], unresolved = [];
  let excludedAnsweredSettlements = 0;
  const future = (id, settledTick) => history.filter(row => row.kind !== 'decision' && row.tick > settledTick
    && row.tick <= settledTick + FUTURE_TICKS && row.tick <= run.endTick
    && row.because?.some(cause => cause.decisionId === id)).sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id))
    .map(row => ({ id: row.id, tick: row.tick, template: row.template ?? null, because: row.because }));
  for (const occurrence of occurrences) {
    if (occurrence.status !== 'answered') continue;
    if (!Number.isSafeInteger(occurrence.settledTick) || occurrence.settledTick < occurrence.offeredTick) {
      unresolved.push({ occurrenceId: occurrence.id, reason: 'invalid_settlement_tick' }); continue;
    }
    if (occurrence.settledTick >= endExclusive || occurrence.settledTick > run.endTick) { excludedAnsweredSettlements += 1; continue; }
    if (typeof occurrence.entryId !== 'string' || typeof occurrence.choiceId !== 'string'
      || !Array.isArray(occurrence.weights) || !occurrence.weights.every(weight => typeof weight === 'string')) {
      unresolved.push({ occurrenceId: occurrence.id, reason: 'invalid_answer_shape' }); continue;
    }
    const matches = history.filter(row => row.kind === 'decision' && row.params?.subjectId === occurrence.id
      && row.params?.decisionKind === 'registry'
      && (row.params?.command === 'answer_registry_offer' || row.template === 'decision.steward'));
    if (matches.length !== 1) {
      unresolved.push({ occurrenceId: occurrence.id, reason: matches.length ? 'ambiguous_answer_history' : 'missing_answer_history',
        historyIds: matches.map(row => row.id) }); continue;
    }
    const own = matches[0];
    const by = own.template === 'decision.steward' ? 'steward' : 'lord';
    if (own.tick !== occurrence.settledTick || own.params.chosen !== occurrence.choiceId
      || (by === 'steward') !== (occurrence.decidedBy === 'steward')) {
      unresolved.push({ occurrenceId: occurrence.id, reason: 'answer_identity_mismatch', historyIds: [own.id] }); continue;
    }
    const source = `registry:${occurrence.entryId}:${occurrence.choiceId}`;
    const ownRoot = decisions.find(row => row.id === own.id);
    // This is an inference from final retained aliases and targets, never canonical occurrence membership.
    const candidates = ownRoot || by !== 'lord' ? [] : decisions.filter(row => row.kind === 'registry' && row.by === 'lord'
      && row.lapsed !== true && row.tick < own.tick && own.tick - row.tick <= 2 * FUTURE_TICKS
      && row.lastTick >= own.tick && row.also?.includes(source)
      && occurrence.boundId && row.targets?.some(target => /^(suit|estate|negotiation):/.test(target)
        && target.slice(target.indexOf(':') + 1) === occurrence.boundId));
    const rootInference = { status: ownRoot ? 'own_trace_identity' : candidates.length > 1 ? 'ambiguous'
      : candidates.length === 1 ? 'unique_candidate_not_canonical_membership' : 'none',
      candidateIds: candidates.map(row => row.id).sort(), ownRootId: ownRoot?.id ?? null };
    answers.push({ occurrenceId: occurrence.id, entryId: occurrence.entryId, choiceId: occurrence.choiceId,
      by, weights: [...(occurrence.weights ?? [])], offeredTick: occurrence.offeredTick, settledTick: own.tick,
      answerHistoryId: own.id, year: run.startYear + Math.floor(own.tick / YEAR_TICKS), mature: run.endTick - own.tick >= FUTURE_TICKS,
      directFuture: future(own.id, own.tick), rootInference,
      indirectFuture: candidates.length === 1 ? future(candidates[0].id, own.tick) : [] });
  }
  const lord = answers.filter(row => row.by === 'lord');
  const annual = Array.from({ length: run.years }, (_, offset) => ({ year: run.startYear + offset,
    weightedLordAnswers: lord.filter(row => row.year === run.startYear + offset && row.weights.length > 0).length }));
  const enabledIds = [...new Set([...(run.support?.enabledIds ?? []), ...occurrences.map(row => row.entryId)])].sort();
  return { schemaVersion: 1, unit: 'unique_registry_occurrence_with_exact_answer_history_join',
    interval: { fromInclusive: 0, toExclusive: endExclusive, observedThrough: run.endTick, futureWindowTicks: FUTURE_TICKS },
    counts: { occurrences: occurrences.length, answeredOccurrences: occurrences.filter(row => row.status === 'answered').length,
      lordAnswered: lord.length, stewardAnswered: answers.length - lord.length,
      invalid: occurrences.filter(row => row.status === 'invalid').length, lapsed: occurrences.filter(row => row.status === 'lapsed').length,
      unresolvedAnswers: unresolved.length, excludedAnsweredSettlements },
    annual, annualWeightedLordAnswers: statistics(annual.map(row => row.weightedLordAnswers)),
    coverage: { matureLord: coverage(lord.filter(row => row.mature)), censoredLord: coverage(lord.filter(row => !row.mature)) },
    perEntry: enabledIds.map(entryId => ({ entryId, occurrences: occurrences.filter(row => row.entryId === entryId).length,
      lordAnswered: lord.filter(row => row.entryId === entryId).length,
      stewardAnswered: answers.filter(row => row.entryId === entryId && row.by === 'steward').length,
      matureLord: coverage(lord.filter(row => row.entryId === entryId && row.mature)),
      censoredLord: coverage(lord.filter(row => row.entryId === entryId && !row.mature)) })),
    answers, unresolved, limits: ['Primary root-thread statistics are unchanged and are not occurrence-answer counts.',
      'Unique merged-root candidates are inferred from final aliases, timing and bound targets; not canonical membership or causal proof.',
      'Indirect receipts are strictly after this answer, never earlier root receipts. Direct and indirect counts must not be conflated.',
      'Missing or ambiguous exact answer-history joins are unresolved, not counted as verified lord or steward answers.'] };
}
