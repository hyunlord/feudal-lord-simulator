import { BALANCE } from '../src/content/balanceConfig';
import { cameHeavyToLord } from '../src/engine/decisionLayer';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import { calendar as calendarDate, scenarioOf } from '../src/engine/scenarioState';

export type ChronicleExample = Pick<HistoryRecord, 'id' | 'tick' | 'kind' | 'template' | 'params' | 'subject' | 'because'>;
export interface ChronicleGroup {
  readonly year: number;
  readonly kind: HistoryRecord['kind'];
  readonly template: string;
  readonly count: number;
  readonly example: ChronicleExample;
}
export interface RegistryDecisionObservation {
  readonly schemaVersion: 1;
  readonly meaning: 'resolved_or_lapsed_trace_tick_not_offer_arrival';
  readonly calendar: { readonly startYear: number; readonly ticksPerYear: number } | null;
  readonly coverage: {
    readonly firstTick: number | null; readonly lastTick: number | null;
    readonly observations: number; readonly maxGap: number; readonly timeReversals: number;
  };
  readonly decisions: readonly (TracedDecision & { readonly year: number; readonly cameHeavyToLord: boolean })[];
  readonly chronicle: readonly ChronicleGroup[];
}

/** Runner-owned archive, sampled before retention. Never writes into the simulation state. */
export function createRegistryDecisionObservation() {
  const decisions = new Map<string, RegistryDecisionObservation['decisions'][number]>();
  const seenHistory = new Set<string>();
  const unchangedRecords = new WeakSet<HistoryRecord>();
  const groups = new Map<string, ChronicleGroup>();
  let previousDecisions: readonly TracedDecision[] | undefined;
  let previousHistory: readonly HistoryRecord[] | undefined;
  let calendar: RegistryDecisionObservation['calendar'] = null;
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  let observations = 0;
  let maxGap = 0;
  let timeReversals = 0;
  return {
    observe(state: GameState): void {
      calendar ??= { startYear: scenarioOf(state).startYear, ticksPerYear: BALANCE.TICKS_PER_YEAR };
      firstTick ??= state.tick;
      if (lastTick !== null) {
        maxGap = Math.max(maxGap, state.tick - lastTick);
        if (state.tick < lastTick) timeReversals += 1;
      }
      lastTick = state.tick;
      observations += 1;
      if (state.trace?.decisions !== previousDecisions) {
        previousDecisions = state.trace?.decisions;
        for (const decision of state.trace?.decisions ?? []) {
          decisions.set(decision.id, { ...decision, year: calendarDate(decision.tick, calendar.startYear, calendar.ticksPerYear).year,
            cameHeavyToLord: cameHeavyToLord(decision) });
        }
      }
      if (state.history?.records === previousHistory) return;
      previousHistory = state.history?.records;
      for (const record of state.history?.records ?? []) {
        if (unchangedRecords.has(record)) continue;
        unchangedRecords.add(record);
        const year = calendarDate(record.tick, calendar.startYear, calendar.ticksPerYear).year;
        const key = JSON.stringify([year, record.kind, record.template]);
        // compactHistory reuses an original ID for a rollup, potentially in the next calendar year.
        const representation = JSON.stringify([record.id, record.kind, record.template, year]);
        const group = groups.get(key);
        const example: ChronicleExample = { id: record.id, tick: record.tick, kind: record.kind, template: record.template,
          subject: record.subject, ...(record.params === undefined ? {} : { params: record.params }),
          ...(record.because === undefined ? {} : { because: record.because }) };
        if (seenHistory.has(representation)) {
          if (group?.example.id === record.id) groups.set(key, { ...group, example });
          continue;
        }
        seenHistory.add(representation);
        const first = group === undefined || record.tick < group.example.tick
          || (record.tick === group.example.tick && record.id < group.example.id);
        groups.set(key, { year, kind: record.kind, template: record.template, count: (group?.count ?? 0) + 1,
          example: first ? example : group.example });
      }
    },
    snapshot(): RegistryDecisionObservation {
      // Isolate nested arrays/params too: a consumer must not mutate this archive or the game through a snapshot.
      return structuredClone({ schemaVersion: 1, meaning: 'resolved_or_lapsed_trace_tick_not_offer_arrival', calendar,
        coverage: { firstTick, lastTick, observations, maxGap, timeReversals },
        decisions: [...decisions.values()].sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id)),
        chronicle: [...groups.values()].sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind) || a.template.localeCompare(b.template)),
      });
    },
  };
}
