import { BALANCE } from '../src/content/balanceConfig';
import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import { lordMattersDue, type LordMatterDue } from '../src/engine/lordDue';
import { stewardReport } from '../src/engine/decisionReads';
import { createRegistryOccurrenceCollector } from './registryDecisionOccurrences';
import { createRegistryPresentationCollector } from './registryDecisionPresentations';

/** Observer-owned archives. Array identity skips unchanged stores; IDs deduplicate retained entries. */
export function createWeightAuditCollector() {
  const occurrences = createRegistryOccurrenceCollector();
  const presentations = createRegistryPresentationCollector();
  const decisions = new Map<string, TracedDecision>();
  const history = new Map<string, HistoryRecord>();
  type ReportLine = ReturnType<typeof stewardReport>['handled'][number] | ReturnType<typeof stewardReport>['events'][number];
  const reportLines = new Map<string, { readonly line: ReportLine; readonly reportFrom: number; readonly reportTo: number; readonly collectedAt: number }>();
  let previousTrace: GameState['trace'];
  let previousHistory: GameState['history'];
  let previousPetitions: NonNullable<GameState['stewardship']>['petitions'] | undefined;
  let previousOccurrences: NonNullable<GameState['registry']>['occurrences'] | undefined;
  const matters = new Map<string, LordMatterDue & { readonly firstObservedTick: number }>();
  let observations = 0;
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  let previousSeason = -1;
  let maxGap = 0;
  let reversals = 0;
  const seenHistoryObjects = new WeakSet<HistoryRecord>();
  return {
    observe(state: GameState): void {
      observations += 1;
      firstTick ??= state.tick;
      if (lastTick !== null) { maxGap = Math.max(maxGap, state.tick - lastTick); if (state.tick < lastTick) reversals += 1; }
      lastTick = state.tick;
      occurrences.observe(state.registry?.occurrences ?? []);
      presentations.observe(state);
      for (const matter of lordMattersDue(state)) {
        const key = `${matter.kind}:${matter.id}`;
        if (!matters.has(key)) matters.set(key, { ...matter, firstObservedTick: state.tick });
      }
      if (previousTrace !== state.trace) {
        for (const decision of state.trace?.decisions ?? []) decisions.set(decision.id, decision);
        previousTrace = state.trace;
      }
      if (previousHistory !== state.history) {
        for (const record of state.history?.records ?? []) {
          if (seenHistoryObjects.has(record)) continue;
          seenHistoryObjects.add(record);
          if (record.because !== undefined || record.kind === 'decision') {
            const old = history.get(record.id);
            if (old?.kind !== 'decision' || record.kind === 'decision') history.set(record.id, record);
          }
        }
        previousHistory = state.history;
      }
      const seasonTicks = BALANCE.TICKS_PER_YEAR / 4;
      const seasonStart = Math.floor(state.tick / seasonTicks) * seasonTicks;
      if (previousPetitions !== state.stewardship?.petitions || previousOccurrences !== state.registry?.occurrences || previousSeason !== seasonStart) {
        const windows = [{ from: seasonStart, to: state.tick + 1 }];
        if (previousSeason >= 0 && previousSeason !== seasonStart) windows.push({ from: seasonStart - seasonTicks, to: seasonStart });
        for (const window of windows) {
          const report = stewardReport(state, window.from, window.to);
          const witness = (key: string, line: ReportLine) => {
            if (!reportLines.has(key)) reportLines.set(key, { line, reportFrom: window.from, reportTo: window.to, collectedAt: state.tick });
          };
          for (const row of report.handled) witness(`petition:${row.petitionId}`, row);
          for (const row of report.events) witness(`registry:${row.occurrenceId}`, row);
        }
        previousSeason = seasonStart;
        previousPetitions = state.stewardship?.petitions;
        previousOccurrences = state.registry?.occurrences;
      }
    },
    snapshot() {
      return { lordDueArrivals: [...matters.values()], decisions: [...decisions.values()], history: [...history.values()], reportKeys: [...reportLines.keys()],
        reportLines: [...reportLines].map(([key, witness]) => ({ key, ...witness })), occurrences: occurrences.snapshot(), presentations: presentations.snapshot(),
        observation: { observations, firstTick, lastTick, maxGap, reversals, cadence: 'initial_and_every_command_attempt_and_tick',
          retention: 'runner_owned_id_maps_before_engine_retention' } };
    },
  };
}
