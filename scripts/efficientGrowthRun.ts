import { createHash } from 'node:crypto';
import type { AdvisorDiagnosticReceipt } from './economyHarnessAutoplay';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGrowthOptions } from './phase19GrowthMetrics';
import { runPhase19NaturalGrowth } from './phase19NaturalGrowth';
import { efficientGrowthMetrics } from './efficientGrowthMetrics';
import { growthGuardrail } from './growthGuardrail';
import { createMillZeroWheatObservation, millWheatSamples } from './efficientGrowthMillContinuity';
import { moneyPeriodSample, type MoneyPeriodSample } from './moneyPeriodRecord';
import { treasuryBalance } from '../src/ledger/ledger';
import { foodPeriodSample } from './arableFoodPeriods';

export function runEfficientGrowth(args: readonly string[]) {
  const options = parseGrowthOptions(args);
  const output = args[2];
  if (output === undefined) throw new RangeError('Usage: efficientGrowthRun.ts 24 1200000 outputDirectory seed');
  if (existsSync(output) && readdirSync(output).length > 0) throw new RangeError('Output directory must be empty');
  mkdirSync(output, { recursive: true });
  let finalStateSha256 = '';
  const diagnostics: { last: AdvisorDiagnosticReceipt | null } = { last: null };
  const checkpoint = args.includes('--checkpoint');
  const millObservation = createMillZeroWheatObservation();
  let efficiency: ReturnType<typeof efficientGrowthMetrics> | null = null;
  const moneyPeriods: (MoneyPeriodSample & { readonly stableSince: number | null })[] = [];
  // C1c-2 gate ③: food flow per 2,400-tick window, so the stable interval's bread and raw-wheat ratios are measured.
  const foodPeriods: Record<string, number | null>[] = [];
  // C3 gate ③: idle adults ÷ population (LB-9), sampled every 100 ticks over the stable interval.
  const labourSamples: { tick: number; idle: number; population: number; fieldHands: number; hauling: number; mills: number; wheatlessMills: number }[] = [];
  let money200Tick: number | null = null;
  let stoneProclaimedTick: number | null = null;
  const report = runPhase19NaturalGrowth({ ...options,
    onDiagnostic: receipt => { diagnostics.last = receipt; },
    onTick: (state, stableSince) => {
      millObservation.observe(state.tick, stableSince, millWheatSamples(state));
      if (money200Tick === null && treasuryBalance(state) >= 200) money200Tick = state.tick;
      if (stoneProclaimedTick === null && state.era === 'stone_town') stoneProclaimedTick = state.eraProclaimedTick;
      const period = moneyPeriodSample(state);
      if (period !== null) moneyPeriods.push({ ...period, stableSince });
      if (state.tick % 2400 === 0) foodPeriods.push(foodPeriodSample(state, stableSince));
      if (stableSince !== null && state.tick % 100 === 0 && state.labour !== undefined && state.population > 0) {
        const mills = state.buildings.filter(building => building.kind === 'mill');
        labourSamples.push({ tick: state.tick, idle: state.labour.idle, population: state.population,
          fieldHands: state.labour.fieldHands, hauling: state.labour.hauling,
          mills: mills.length, wheatlessMills: mills.filter(mill => (mill.inventory.wheat ?? 0) === 0).length });
      }
      if (checkpoint && state.tick % 12_000 === 0) {
        writeFileSync(resolve(output, 'last-observed-state.json'), JSON.stringify(state));
        writeFileSync(resolve(output, 'last-diagnostic.json'), JSON.stringify(diagnostics.last, null, 2));
      }
    },
    additionalAcceptance: state => efficientGrowthMetrics(state, millObservation.report()).passed,
    onState: (label, state) => {
      if (label !== 'final') return;
      efficiency = efficientGrowthMetrics(state, millObservation.report());
      const raw = JSON.stringify(state);
      finalStateSha256 = createHash('sha256').update(raw).digest('hex');
      writeFileSync(resolve(output, 'final-state.json'), raw);
    },
    onProgress: state => process.stderr.write(`${JSON.stringify({ tick: state.tick, lots: state.lots, l4: state.l4Houses })}\n`),
  });
  if (efficiency === null) throw new Error('Final growth state was not recorded');
  const gaps = (service: 'water' | 'market' | 'church') => Object.entries(report.final.services[service])
    .reduce((sum, [kind, count]) => sum + (kind === 'served' ? 0 : count), 0);
  const guardrail = growthGuardrail({ seed: report.seed, stopReason: report.stopReason,
    lots: report.final.lots, l4Houses: report.final.l4Houses,
    serviceGaps: { water: gaps('water'), market: gaps('market'), church: gaps('church') },
    diagnosticResult: diagnostics.last?.result ?? null }, efficiency);
  const summary = { source: report.source, seed: report.seed, opening: report.opening,
    status: 'capture-pending', simulationPassed: report.status === 'passed' && guardrail.passed,
    acceptance: { ...report.acceptance, guardrail: guardrail.passed, capture: false },
    efficiency, guardrail, lastDiagnostic: diagnostics.last, finalStateSha256,
    targetLots: options.targetLots, maxTicks: report.maxTicks, final: report.final,
    strict: { stableSince: report.stableSince, sustainedTicks: report.sustainedTicks, interruptions: report.stabilityInterruptions },
    stableLabour: stableLabourSummary(labourSamples, report.stableSince),
    victoryTick: report.victoryTick, money200Tick, stoneProclaimedTick, stopReason: report.stopReason, failures: report.failures,
    elapsedSeconds: report.elapsedSeconds };
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(resolve(output, 'money-periods.jsonl'), moneyPeriods.map(period => JSON.stringify(period)).join('\n') + '\n');
  writeFileSync(resolve(output, 'food-periods.jsonl'), foodPeriods.map(period => JSON.stringify(period)).join('\n') + '\n');
  return summary;
}

/** C3 gate ③: mean idle ÷ population over the samples taken since the final stable interval began. */
function stableLabourSummary(samples: readonly { tick: number; idle: number; population: number; fieldHands: number; hauling: number; mills: number; wheatlessMills: number }[], stableSince: number | null) {
  const stable = stableSince === null ? [] : samples.filter(sample => sample.tick >= stableSince);
  if (stable.length === 0) return { samples: 0, meanIdleRatio: null, maxIdleRatio: null, minIdleRatio: null, meanFieldHands: null, meanHauling: null, wheatlessMillShare: null };
  const ratios = stable.map(sample => sample.idle / sample.population);
  const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return { samples: stable.length, meanIdleRatio: Number(mean(ratios).toFixed(4)),
    maxIdleRatio: Number(Math.max(...ratios).toFixed(4)), minIdleRatio: Number(Math.min(...ratios).toFixed(4)),
    meanFieldHands: Number(mean(stable.map(sample => sample.fieldHands)).toFixed(1)),
    meanHauling: Number(mean(stable.map(sample => sample.hauling)).toFixed(1)),
    // L7: share of mill samples holding no wheat at all (whatever their bread), comparable across the rule change.
    wheatlessMillShare: Number((stable.reduce((sum, sample) => sum + sample.wheatlessMills, 0)
      / Math.max(1, stable.reduce((sum, sample) => sum + sample.mills, 0))).toFixed(4)) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runEfficientGrowth(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.simulationPassed) process.exitCode = 1;
}
