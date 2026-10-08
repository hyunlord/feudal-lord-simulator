import { BALANCE } from '../src/content/balanceConfig';
import { cameHeavyToLord } from '../src/engine/decisionLayer';
import { TRACE_LIVE_TICKS } from '../src/engine/decisionTrace';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import type { RegistryOccurrence } from '../src/engine/registry.types';
import type { HistoryRecord } from '../src/engine/history.types';
import { calendar } from '../src/engine/scenarioState';

export const ENGINE_B_PRIOR_BATCH_IDS: ReadonlySet<string> = new Set([
  'ck_evt_061', 'ck_evt_077', 'ck_evt_083', 'ck_evt_090', 'ck_evt_092', 'ck_evt_057',
  'ck_evt_058', 'ck_evt_075', 'ck_evt_076', 'ck_evt_080', 'ck_evt_147',
]);

export interface WeightAuditEvidence {
  readonly startYear: number;
  readonly years: number;
  readonly endTick: number;
  readonly decisions: readonly TracedDecision[];
  readonly history: readonly HistoryRecord[];
  readonly reportKeys: readonly string[];
}

export function weightAuditOccurrencesInRange(occurrences: readonly RegistryOccurrence[], endTickExclusive: number) {
  return occurrences.filter(occurrence => occurrence.offeredTick >= 0 && occurrence.offeredTick < endTickExclusive);
}

export function annualStatistics(counts: readonly number[]) {
  const sorted = [...counts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[middle] ?? null
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return { median, maximum: sorted.at(-1) ?? null, zeroYears: counts.filter(value => value === 0).length,
    aboveFourYears: counts.filter(value => value > 4).length, total: counts.reduce((sum, value) => sum + value, 0) };
}

/** Exact source ID join, never a count-based estimate of steward-report membership. */
export function stewardReportKey(decision: TracedDecision, record: HistoryRecord | undefined): string | null {
  const subject = record?.params?.subjectId;
  if (typeof subject !== 'string') return null;
  return `${decision.kind === 'registry' ? 'registry' : 'petition'}:${subject}`;
}

export function summarizeWeightAudit(input: WeightAuditEvidence) {
  const date = (tick: number) => calendar(tick, input.startYear);
  const history = new Map(input.history.map(record => [record.id, record]));
  const allDecisions = new Map(input.decisions.map(decision => [decision.id, decision]));
  const endTickExclusive = input.years * BALANCE.TICKS_PER_YEAR;
  const decisions = [...allDecisions.values()].filter(decision => decision.tick >= 0 && decision.tick < endTickExclusive);
  const reportKeys = new Set(input.reportKeys);
  const after = new Map<string, HistoryRecord[]>();
  for (const record of history.values()) {
    for (const id of new Set((record.because ?? []).map(cause => cause.decisionId))) {
      const rows = after.get(id) ?? [];
      rows.push(record);
      after.set(id, rows);
    }
  }
  const rows = decisions.map(decision => {
    const future = (after.get(decision.id) ?? []).filter(record => record.tick > decision.tick
      && record.tick <= decision.tick + TRACE_LIVE_TICKS && record.tick <= input.endTick && record.kind !== 'decision')
      .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
    const first = future[0];
    const reportKey = stewardReportKey(decision, history.get(decision.id));
    return { ...decision, year: date(decision.tick).year, priorBatchB11: decision.kind === 'registry' && ENGINE_B_PRIOR_BATCH_IDS.has(decision.source.split(':')[1] ?? ''), heavyToLord: cameHeavyToLord(decision),
      mature: input.endTick - decision.tick >= TRACE_LIVE_TICKS,
      futureConsequenceCount: future.length,
      firstConsequence: first === undefined ? null : { id: first.id, tick: first.tick, ...date(first.tick), template: first.template,
        params: first.params ?? {}, seasonsAfter: Math.ceil((first.tick - decision.tick) / (BALANCE.TICKS_PER_YEAR / 4)),
        mainBecause: first.because?.[0] ?? null },
      consequences: future.map(record => ({ id: record.id, tick: record.tick, key: record.because?.find(cause => cause.decisionId === decision.id)?.key ?? null,
        mainDecisionId: record.because?.[0]?.decisionId ?? null, mainDecisionKnown: allDecisions.has(record.because?.[0]?.decisionId ?? ''),
        sharedCause: record.because?.some(cause => cause.part === true) === true, thisDecisionIsMain: record.because?.[0]?.decisionId === decision.id,
        uniqueCauseIds: new Set(record.because?.map(cause => cause.decisionId)).size === record.because?.length })),
      reportKey, inStewardReport: decision.by === 'steward' && reportKey !== null && reportKeys.has(reportKey) };
  });
  const annual = Array.from({ length: input.years }, (_, offset) => {
    const year = input.startYear + offset;
    const heavy = rows.filter(row => row.year === year && row.heavyToLord);
    return { year, wholeGameHeavyResolved: heavy.length, registryHeavyResolved: heavy.filter(row => row.kind === 'registry').length,
      priorBatchB11HeavyResolved: heavy.filter(row => row.priorBatchB11).length,
      heavyAnswered: heavy.filter(row => row.lapsed !== true).length, heavyLapsed: heavy.filter(row => row.lapsed === true).length };
  });
  const coverage = (subset: typeof rows) => ({ counted: subset.length,
    withFutureConsequence: subset.filter(row => row.futureConsequenceCount > 0).length,
    fraction: subset.length === 0 ? null : subset.filter(row => row.futureConsequenceCount > 0).length / subset.length,
    withoutFutureConsequence: subset.filter(row => row.futureConsequenceCount === 0).map(row => row.id) });
  const lord = rows.filter(row => row.by === 'lord');
  const heavy = lord.filter(row => row.weights.length > 0);
  const steward = rows.filter(row => row.by === 'steward');
  const inReport = steward.filter(row => row.inStewardReport);
  return { annual, heavyDensityMeaning: 'cameHeavyToLord resolved_or_lapsed_trace_tick_not_offer_arrival',
    wholeGame: annualStatistics(annual.map(row => row.wholeGameHeavyResolved)),
    registry: annualStatistics(annual.map(row => row.registryHeavyResolved)),
    priorBatchB11: annualStatistics(annual.map(row => row.priorBatchB11HeavyResolved)),
    trace: { matureLord: coverage(lord.filter(row => row.mature)), censoredLord: coverage(lord.filter(row => !row.mature)),
      matureHeavyLord: coverage(heavy.filter(row => row.mature)), censoredHeavyLord: coverage(heavy.filter(row => !row.mature)),
      matureRegistryLord: coverage(lord.filter(row => row.mature && row.kind === 'registry')),
      maturePriorBatchB11Lord: coverage(lord.filter(row => row.mature && row.priorBatchB11)) },
    steward: { counted: steward.length, inReport: inReport.length, fraction: steward.length === 0 ? null : inReport.length / steward.length,
      registryCounted: steward.filter(row => row.kind === 'registry').length, registryInReport: inReport.filter(row => row.kind === 'registry').length,
      priorBatchB11Counted: steward.filter(row => row.priorBatchB11).length, priorBatchB11InReport: inReport.filter(row => row.priorBatchB11).length,
      missingDecisionIds: steward.filter(row => !row.inStewardReport).map(row => row.id) }, decisions: rows,
    limits: ['Future history because links are engine evidence, not renderer or human visibility proof.',
      'Main cause means first because entry per engine contract, not independently established causal dominance.',
      'Only consequences strictly after the decision and within its original three-year window count.'] };
}
