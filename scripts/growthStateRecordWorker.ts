import { createGrowthOpening } from './phase21OpeningTranslation';
import { createAutoplayTraceDriver, type AdvisorDiagnosticReceipt } from './economyHarnessAutoplay';
import { advanceTick } from '../src/engine/tick';
import { AUTOPLAY_TICK_CADENCE } from '../src/engine/autoplay.types';
import { growthSnapshot, invalidGrowthResources } from './phase19GrowthMetrics';
import { createGrowthStability } from './phase19GrowthRunControl';
import { fullServicePopulation } from './phase19GrowthMetrics';
import { timingSummary } from './phase19GrowthObservations';
import { growthDensityMetrics } from './growthStateRecordMetrics';
import type { GrowthRecordMessage } from './growthStateRecordSupervisor';

const seed = Number(process.argv[2]);
const targetLots = Number(process.argv[3]);
const maxTicks = Number(process.argv[4]);
if (![seed, targetLots, maxTicks].every(Number.isInteger)) throw new RangeError('Expected integer seed, targetLots, maxTicks');
const opening = createGrowthOpening(seed);
let diagnostic: AdvisorDiagnosticReceipt | null = null;
const driver = createAutoplayTraceDriver({ id: `state-record-${seed}-${targetLots}`, source: JSON.stringify(opening.provenance), policy: { maxHousingLots: targetLots }, onDiagnostic: value => { diagnostic = value; } });
let state = opening.state;
const stability = createGrowthStability(targetLots);
const tickSamples: number[] = [];
const advisorSamples: number[] = [];
let tickCount = 0;
let decisionCount = 0;
let tickTotalMs = 0;
let lastDecisionTick = -AUTOPLAY_TICK_CADENCE;
function send(message: GrowthRecordMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.send === undefined) return reject(new Error('Run growthStateRecord.ts, not the worker directly'));
    process.send(message, error => error === null ? resolve() : reject(error));
  });
}
function snapshot(kind: 'decision-start' | 'final'): GrowthRecordMessage {
  return { kind, tick: state.tick, stateJson: JSON.stringify(state), diagnosticJson: JSON.stringify(diagnostic), metricsJson: JSON.stringify({
    opening: opening.provenance, snapshot: growthSnapshot(state), density: growthDensityMetrics(state),
    stability: stability.report(), timing: { tickCount, meanTickMs: tickCount === 0 ? null : tickTotalMs / tickCount, recentTicks: timingSummary(tickSamples), recentDecisions: timingSummary(advisorSamples), note: 'Instrumentation and concurrent host load included; not a performance gate.' },
  }) };
}
let stopReason = 'tick-budget';
for (let step = 0; step < maxTicks; step += 1) {
  if (state.tick - lastDecisionTick >= AUTOPLAY_TICK_CADENCE) {
    // Parent receives immutable input before the synchronous decision, so its independent
    // watchdog can preserve an exact input even when this process never yields again.
    await send(snapshot('decision-start'));
    lastDecisionTick = state.tick;
    const started = performance.now();
    state = driver.apply(state);
    advisorSamples[decisionCount % 240] = performance.now() - started;
    decisionCount += 1;
    await send({ kind: 'decision-end', tick: state.tick, stateJson: '', metricsJson: '', diagnosticJson: JSON.stringify(diagnostic) });
  }
  const started = performance.now();
  const previousTick = state.tick;
  state = advanceTick(state);
  const duration = performance.now() - started;
  tickSamples[step % 240] = duration;
  tickTotalMs += duration;
  tickCount += 1;
  if (state.tick !== previousTick + 1 || state.settlement?.outcome === 'abandoned' || invalidGrowthResources(state)) { stopReason = 'stopped-or-invalid-state'; break; }
  // Sampling every tick intentionally mirrors the existing natural-growth stability definition.
  stability.observe({ tick: state.tick, lots: growthSnapshot(state).lots, victory: state.settlement?.outcome === 'victory', fullService: fullServicePopulation(state) });
}
await send({ ...snapshot('final'), stopReason });
process.disconnect?.();
