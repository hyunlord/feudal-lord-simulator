import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const END = 500000;
const FIRST_YEAR = 1300;
const YEARS = 125;
const B11 = new Set(['061', '077', '083', '090', '092', '057', '058', '075', '076', '080', '147'].map(id => `ck_evt_${id}`));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const requireEvidence = (condition, message) => { if (!condition) throw new Error(`Audit report rejected: ${message}`); };
const count = value => Number.isSafeInteger(value) && value >= 0;
const inRange = tick => count(tick) && tick < END;
const sortedIds = values => [...values].sort();
const statistics = values => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return { countedYears: values.length, total: values.reduce((a, b) => a + b, 0),
    median: ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2,
    maximum: ordered.at(-1), zeroYears: values.filter(value => value === 0).length, aboveFourYears: values.filter(value => value > 4).length };
};
const coverage = rows => ({ denominator: rows.length, withFutureConsequence: rows.filter(row => row.futureConsequenceCount > 0).length,
  fraction: rows.length === 0 ? null : rows.filter(row => row.futureConsequenceCount > 0).length / rows.length,
  withoutOutcome: rows.filter(row => row.futureConsequenceCount === 0).map(row => ({ seed: row.seed, decisionId: row.id })) });

export function validateWeightAuditRuns(runs) {
  requireEvidence(runs.length === 3 && sortedIds(runs.map(run => run.seed)).join(',') === '1,2,3', 'exact seeds 1,2,3 required');
  const revision = runs[0]?.provenance?.sourceRevision;
  requireEvidence(typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision), 'full source revision required');
  const enabled = runs[0]?.support?.enabledIds;
  requireEvidence(Array.isArray(enabled) && enabled.length === 56 && enabled.every(id => typeof id === 'string' && /^ck_evt_\d{3}$/.test(id)) && new Set(enabled).size === 56, '56 unique support IDs required');
  for (const run of runs) {
    requireEvidence(run.provenance.sourceRevision === revision && run.provenance.dirtyPaths === '', `seed ${run.seed}: revision/clean tree`);
    requireEvidence(run.years === YEARS && run.startYear === FIRST_YEAR && run.endYearExclusive === 1425 && run.endTick === END, `seed ${run.seed}: exact period`);
    const observed = run.observation;
    requireEvidence(observed?.firstTick === 0 && observed.lastTick === END && count(observed.maxGap) && observed.maxGap <= 1 && observed.reversals === 0
      && count(observed.observations) && observed.observations >= END + 1
      && observed.cadence === 'initial_and_every_command_attempt_and_tick', `seed ${run.seed}: complete observation`);
    requireEvidence(run.candidateObservation?.observerFailures === 0, `seed ${run.seed}: candidate observer failures`);
    requireEvidence(JSON.stringify(sortedIds(run.support.enabledIds)) === JSON.stringify(sortedIds(enabled)), `seed ${run.seed}: support mismatch`);
    requireEvidence(run.summary?.annual?.length === YEARS && run.summary.annual.every((row, i) => row.year === FIRST_YEAR + i), 'annual years must be complete and ordered');
    requireEvidence(Array.isArray(run.summary.decisions) && new Set(run.summary.decisions.map(row => row.id)).size === run.summary.decisions.length, 'unique decision IDs');
    requireEvidence(run.summary.decisions.every(row => inRange(row.tick) && count(row.futureConsequenceCount)
      && Array.isArray(row.consequences) && row.futureConsequenceCount === row.consequences.length
      && row.year === FIRST_YEAR + Math.floor(row.tick / 4000) && row.mature === (END - row.tick >= 12000)
      && ['lord', 'steward'].includes(row.by)), 'decision range/consequences');
    for (const row of run.summary.decisions) {
      requireEvidence(Array.isArray(row.weights) && typeof row.source === 'string' && typeof row.heavyToLord === 'boolean', 'decision weight/source shape');
      const registryMatch = /^registry:(ck_evt_\d{3}):(.*)$/.exec(row.source);
      if (row.kind === 'registry') requireEvidence(registryMatch !== null && enabled.includes(registryMatch[1]), 'registry source must identify enabled catalog entry');
      requireEvidence(row.priorBatchB11 === (row.kind === 'registry' && B11.has(registryMatch?.[1])), 'B11 predicate matches source');
      if (row.by === 'steward') requireEvidence(typeof row.inStewardReport === 'boolean', 'steward witness boolean');
    }
    requireEvidence(Array.isArray(run.presentations) && new Set(run.presentations.map(row => row.key)).size === run.presentations.length
      && run.presentations.every(row => typeof row.key === 'string' && typeof row.kind === 'string' && count(row.firstObservedTick)), 'presentation identities required');
    requireEvidence(Array.isArray(run.occurrences) && new Set(run.occurrences.map(row => row.id)).size === run.occurrences.length, 'unique occurrences');
    const occurrences = run.occurrences.filter(row => inRange(row.offeredTick));
    requireEvidence(occurrences.every(row => enabled.includes(row.entryId) && (row.weights === undefined || Array.isArray(row.weights))), 'occurrence catalog and weight evidence');
    requireEvidence(JSON.stringify(sortedIds(new Set(occurrences.map(row => row.entryId)))) === JSON.stringify(sortedIds(run.support.observedIds)), 'support observed IDs match in-range archive');
    for (const cell of run.summary.annual) {
      const rows = run.summary.decisions.filter(row => row.year === cell.year && row.heavyToLord);
      requireEvidence(cell.wholeGameHeavyResolved === rows.length && cell.registryHeavyResolved === rows.filter(row => row.kind === 'registry').length
        && cell.priorBatchB11HeavyResolved === rows.filter(row => row.priorBatchB11).length, 'annual heavy totals match decisions');
    }
    requireEvidence(new Set(run.candidateObservation.groups.map(group => `${group.entryId}:${group.gate}`)).size === run.candidateObservation.groups.length, 'unique candidate groups');
    for (const group of run.candidateObservation.groups) {
      requireEvidence(count(group.count) && inRange(group.first.tick) && inRange(group.last.tick) && group.first.tick <= group.last.tick, 'candidate group interval');
      for (const key of ['combinations', 'contextFailures', 'conditionFailures', 'truncatedCount', 'enabledChoiceObservations', 'enabledChoicesTotal']) requireEvidence(count(group[key]), `candidate ${key}`);
    }
    requireEvidence(run.candidateObservation.observations === run.candidateObservation.groups.reduce((sum, row) => sum + row.count, 0), 'candidate group totals');
  }
  return { sourceRevision: revision, enabledIds: sortedIds(enabled) };
}

function candidateTotals(runs, id) {
  const groups = new Map();
  for (const run of runs) for (const row of run.candidateObservation.groups.filter(group => group.entryId === id)) {
    const previous = groups.get(row.gate) ?? { gate: row.gate, count: 0, combinations: 0, contextFailures: 0, conditionFailures: 0,
      truncatedCount: 0, enabledChoiceObservations: 0, enabledChoicesTotal: 0, missingBindings: {}, bySeed: [] };
    for (const field of ['count', 'combinations', 'contextFailures', 'conditionFailures', 'truncatedCount', 'enabledChoiceObservations', 'enabledChoicesTotal']) previous[field] += row[field];
    for (const [binding, amount] of Object.entries(row.missingBindings)) {
      requireEvidence(count(amount), 'missing binding count');
      previous.missingBindings[binding] = (previous.missingBindings[binding] ?? 0) + amount;
    }
    previous.bySeed.push({ seed: run.seed, count: row.count, firstTick: row.first.tick, lastTick: row.last.tick });
    groups.set(row.gate, previous);
  }
  return [...groups.values()].sort((a, b) => a.gate.localeCompare(b.gate));
}

function suggestion(evidence, historical) {
  if (evidence.occurrences > 0) return { category: 'observed', status: 'observed_in_current_three_runs' };
  const calendar = historical?.calendar;
  if (calendar && (calendar.yearMinInclusive >= 1425 || calendar.yearMaxInclusive < FIRST_YEAR)) return { category: 'era_outside_window', status: 'static_calendar_excludes_run' };
  if (evidence.acceptedEvaluations > 0) return { category: 'accepted_selection_conflict_candidate', status: 'accepted_evaluations_without_offer_not_exact_selection_attribution' };
  if (evidence.gates.some(row => ['binding', 'new_context', 'enabled_choices'].includes(row.gate) && row.count > 0)) return { category: 'binding_or_context_narrow_candidate', status: 'runtime_gate_observed_not_missing_engine_fact_proof' };
  if (evidence.gates.some(row => ['cooldown', 'dedup', 'annual_cap', 'pace'].includes(row.gate) && row.count > 0)) return { category: 'cooldown_or_conflict_candidate', status: 'runtime_gate_observed_not_exhaustive_cause' };
  return { category: 'unresolved', status: 'insufficient_runtime_attribution' };
}

function perSeedMetrics(run) {
  const rows = run.summary.decisions.map(row => ({ ...row, seed: run.seed }));
  const lord = rows.filter(row => row.by === 'lord');
  const steward = rows.filter(row => row.by === 'steward');
  const annualArrivals = run.summary.annual.map(({ year }) => {
    const ids = new Set(run.presentations.filter(row => row.kind === 'registry' && FIRST_YEAR + Math.floor(row.firstObservedTick / 4000) === year).map(row => row.key.slice('registry:'.length)));
    return run.occurrences.filter(row => inRange(row.offeredTick) && ids.has(row.id) && (row.weights?.length ?? 0) > 0).length;
  });
  return { seed: run.seed, wholeGame: statistics(run.summary.annual.map(row => row.wholeGameHeavyResolved)),
    registry: statistics(run.summary.annual.map(row => row.registryHeavyResolved)), priorBatchB11: statistics(run.summary.annual.map(row => row.priorBatchB11HeavyResolved)),
    trace: { ...answeredCoverage(lord), matureLord: coverage(lord.filter(row => row.mature)), censoredLord: coverage(lord.filter(row => !row.mature)),
      matureHeavyLord: coverage(lord.filter(row => row.mature && row.weights.length > 0)), censoredHeavyLord: coverage(lord.filter(row => !row.mature && row.weights.length > 0)),
      matureRegistryLord: coverage(lord.filter(row => row.mature && row.kind === 'registry')), maturePriorBatchB11Lord: coverage(lord.filter(row => row.mature && row.priorBatchB11)) },
    steward: { denominator: steward.length, witnessed: steward.filter(row => row.inStewardReport).length,
      fraction: steward.length === 0 ? null : steward.filter(row => row.inStewardReport).length / steward.length,
      missingDecisionIds: steward.filter(row => !row.inStewardReport).map(row => row.id) },
    registryHeavyArrivalDensity: statistics(annualArrivals), candidateObservations: run.candidateObservation.observations };
}

function answeredCoverage(lord) {
  const answered = lord.filter(row => row.lapsed !== true);
  return { lapsedLordCount: lord.filter(row => row.lapsed === true).length,
    matureAnsweredLord: coverage(answered.filter(row => row.mature)),
    censoredAnsweredLord: coverage(answered.filter(row => !row.mature)),
    matureAnsweredRegistryLord: coverage(answered.filter(row => row.mature && row.kind === 'registry')),
    matureAnsweredB11Lord: coverage(answered.filter(row => row.mature && row.priorBatchB11)) };
}

/** Offline report only; historical inventory identity is preserved independently of current observations. */
export function aggregateWeightAudits(runs, inventory) {
  const ordered = [...runs].sort((a, b) => a.seed - b.seed);
  const context = validateWeightAuditRuns(ordered);
  requireEvidence(Array.isArray(inventory.entries) && inventory.entries.length === 40 && new Set(inventory.entries.map(row => row.id)).size === 40, 'historical inventory must contain exactly 40 unique IDs');
  requireEvidence(inventory.entries.every(row => context.enabledIds.includes(row.id) && row.historicalObservedCount === 0), 'historical 40 must be unobserved supported IDs');
  const historical = new Map(inventory.entries.map(row => [row.id, row]));
  const decisions = ordered.flatMap(run => run.summary.decisions.map(row => ({ ...row, seed: run.seed })));
  const perEntry = context.enabledIds.map(id => {
    const rows = decisions.filter(row => row.kind === 'registry' && row.source.split(':')[1] === id);
    const lord = rows.filter(row => row.by === 'lord');
    const steward = rows.filter(row => row.by === 'steward');
    const occurrences = ordered.flatMap(run => run.occurrences.filter(row => row.entryId === id && inRange(row.offeredTick)).map(row => ({ ...row, seed: run.seed })));
    const gates = candidateTotals(ordered, id);
    const acceptedEvaluations = gates.find(row => row.gate === 'accepted')?.count ?? 0;
    const item = { id, historical40: historical.has(id), occurrences: occurrences.length,
      occurrencesBySeed: ordered.map(run => ({ seed: run.seed, count: occurrences.filter(row => row.seed === run.seed).length })),
      lord: lord.length, steward: steward.length, lapsed: rows.filter(row => row.lapsed === true).length,
      ...answeredCoverage(lord), matureLord: coverage(lord.filter(row => row.mature)), censoredLord: coverage(lord.filter(row => !row.mature)),
      stewardReport: { denominator: steward.length, witnessed: steward.filter(row => row.inStewardReport).length,
        missing: steward.filter(row => !row.inStewardReport).map(row => ({ seed: row.seed, decisionId: row.id, reportKey: row.reportKey })) },
      decisionEvidence: rows.map(row => ({ seed: row.seed, id: row.id, source: row.source, tick: row.tick, by: row.by, lapsed: row.lapsed === true,
        mature: row.mature, futureConsequenceCount: row.futureConsequenceCount, firstConsequence: row.firstConsequence,
        primaryAttribution: row.consequences.map(cause => ({ recordId: cause.id, mainDecisionId: cause.mainDecisionId,
          mainDecisionKnown: cause.mainDecisionKnown, thisDecisionIsMain: cause.thisDecisionIsMain, sharedCause: cause.sharedCause, uniqueCauseIds: cause.uniqueCauseIds })) })),
      gates, acceptedEvaluations, acceptedEvaluationsMinusOffers: acceptedEvaluations - occurrences.length,
      exactAcceptedButUnofferedCount: null };
    return { ...item, suggestedClassification: suggestion(item, historical.get(id)) };
  });
  requireEvidence(perEntry.reduce((sum, entry) => sum + entry.lord + entry.steward, 0) === decisions.filter(row => row.kind === 'registry').length, 'registry decision conservation');
  const annual = ordered.flatMap(run => run.summary.annual.map(row => ({ seed: run.seed, ...row })));
  const lord = decisions.filter(row => row.by === 'lord');
  const steward = decisions.filter(row => row.by === 'steward');
  return { schemaVersion: 1, ...context, seeds: [1, 2, 3], range: { startYear: FIRST_YEAR, endYearExclusive: 1425, endTickExclusive: END },
    annualMeaning: '375 seed-years pooled; resolved/lapsed trace matters, not all command responses or classified whole-game arrivals',
    pooled: { wholeGame: statistics(annual.map(row => row.wholeGameHeavyResolved)), registry: statistics(annual.map(row => row.registryHeavyResolved)),
      priorBatchB11: statistics(annual.map(row => row.priorBatchB11HeavyResolved)),
      ...answeredCoverage(lord), matureLord: coverage(lord.filter(row => row.mature)), censoredLord: coverage(lord.filter(row => !row.mature)),
      matureHeavyLord: coverage(lord.filter(row => row.mature && row.weights.length > 0)),
      stewardReport: { denominator: steward.length, witnessed: steward.filter(row => row.inStewardReport).length,
        fraction: steward.length === 0 ? null : steward.filter(row => row.inStewardReport).length / steward.length } },
    perSeed: ordered.map(perSeedMetrics),
    annual, perEntry, unobservedIds: perEntry.filter(row => row.occurrences === 0).map(row => row.id),
    historical40: { sourceRevision: inventory.historicalSourceRevision, ids: inventory.entries.map(row => row.id),
      entries: inventory.entries.map(row => ({ historical: row, current: perEntry.find(entry => entry.id === row.id) })) },
    limits: ['Legacy home-cycle registry definitions do not generate registry offers in this new-game harness; unknown registry source IDs are rejected rather than silently dropped.',
      'Answered-lord consequence denominators exclude lapsed decisions; heavy annual counts retain lapsed decisions separately from coverage.',
      'Ordered first because attribution is not independent causal validity or proof of rendered visibility.',
      'Accepted evaluation counts lack per-attempt identity; subtraction from offers is a diagnostic difference, not an exact accepted-but-unoffered count.',
      'Candidate observations exclude outer registry budget and legacy-path skips; classifications are suggestions, not proven engine fact absence or adapter defects.',
      'Archive endpoint history is retained for preceding decision consequences; decisions and offers use the exclusive 1425 boundary.'] };
}

export function writeWeightAuditReport(directory, outputPath, inventoryPath = 'docs/verification/eb-freq/inventory.json') {
  const paths = readdirSync(directory).filter(name => name.endsWith('.json') && resolve(directory, name) !== resolve(outputPath)).sort().map(name => resolve(directory, name));
  const inputs = paths.map(path => ({ path, bytes: readFileSync(path) }));
  const selected = inputs.map(input => ({ ...input, run: JSON.parse(input.bytes.toString('utf8')) })).filter(input => input.run.schemaVersion === 1 && input.run.summary?.decisions);
  const inventoryBytes = readFileSync(inventoryPath);
  const report = aggregateWeightAudits(selected.map(input => input.run), JSON.parse(inventoryBytes.toString('utf8')));
  requireEvidence(!paths.includes(resolve(outputPath)) && resolve(outputPath) !== resolve(inventoryPath), 'output cannot replace input');
  const result = { ...report, provenance: { rawInputs: selected.sort((a, b) => a.run.seed - b.run.seed).map(input => ({ seed: input.run.seed, file: basename(input.path), sha256: sha256(input.bytes) })),
    inventory: { path: inventoryPath, sha256: sha256(inventoryBytes) } } };
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, output, inventory, extra] = process.argv.slice(2);
  requireEvidence(directory && output && !extra, 'usage: engineBWeightAuditReport.mjs input-directory output.json [inventory.json]');
  writeWeightAuditReport(directory, output, inventory);
}
