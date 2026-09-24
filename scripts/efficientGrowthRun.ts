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
  const report = runPhase19NaturalGrowth({ ...options,
    onDiagnostic: receipt => { diagnostics.last = receipt; },
    onTick: (state, stableSince) => {
      millObservation.observe(state.tick, stableSince, millWheatSamples(state));
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
    victoryTick: report.victoryTick, stopReason: report.stopReason, failures: report.failures,
    elapsedSeconds: report.elapsedSeconds };
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runEfficientGrowth(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.simulationPassed) process.exitCode = 1;
}
