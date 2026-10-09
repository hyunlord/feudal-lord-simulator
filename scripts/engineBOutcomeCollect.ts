import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import { createRegistryOccurrenceCollector } from './registryDecisionOccurrences';

/** Archive lives outside the engine; a ledger rollup must never erase an original answer identity. */
export function createOutcomeArchive() {
  const occurrences = createRegistryOccurrenceCollector();
  const history = new Map<string, HistoryRecord>(), decisions = new Map<string, TracedDecision>();
  const seen = new WeakSet<HistoryRecord>();
  let previousHistory: GameState['history'], previousTrace: GameState['trace'];
  let firstTick: number | null = null, lastTick: number | null = null, maxGap = 0, reversals = 0, observations = 0;
  return {
    observe(state: GameState): void {
      observations += 1; firstTick ??= state.tick;
      if (lastTick !== null) { maxGap = Math.max(maxGap, state.tick - lastTick); if (state.tick < lastTick) reversals += 1; }
      lastTick = state.tick;
      occurrences.observe(state.registry?.occurrences ?? []);
      if (state.trace !== previousTrace) {
        for (const row of state.trace?.decisions ?? []) decisions.set(row.id, row);
        previousTrace = state.trace;
      }
      if (state.history !== previousHistory) {
        for (const row of state.history?.records ?? []) {
          if (seen.has(row)) continue;
          seen.add(row);
          if (row.kind !== 'decision' && row.because === undefined) continue;
          if (history.get(row.id)?.kind !== 'decision' || row.kind === 'decision') history.set(row.id, row);
        }
        previousHistory = state.history;
      }
    },
    snapshot() {
      return { history: [...history.values()], decisions: [...decisions.values()], occurrences: occurrences.snapshot(),
        observation: { firstTick, lastTick, maxGap, reversals, observations, cadence: 'initial_and_every_command_attempt_and_tick', retention: 'runner_owned_id_maps_before_engine_retention' } };
    },
  };
}
