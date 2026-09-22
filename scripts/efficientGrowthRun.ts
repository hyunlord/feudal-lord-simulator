import { createHash } from 'node:crypto';
import type { AdvisorDiagnosticReceipt } from './economyHarnessAutoplay';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGrowthOptions } from './phase19GrowthMetrics';
import { runPhase19NaturalGrowth } from './phase19NaturalGrowth';
import { efficientGrowthMetrics } from './efficientGrowthMetrics';

export function runEfficientGrowth(args: readonly string[]) {
  const options = parseGrowthOptions(args);
  const output = args[2];
  if (output === undefined) throw new RangeError('Usage: efficientGrowthRun.ts 24 1200000 outputDirectory seed');
  if (existsSync(output) && readdirSync(output).length > 0) throw new RangeError('Output directory must be empty');
  mkdirSync(output, { recursive: true });
  let finalStateSha256 = '';
  let lastDiagnostic: AdvisorDiagnosticReceipt | null = null;
  let efficiency: ReturnType<typeof efficientGrowthMetrics> | null = null;
  const report = runPhase19NaturalGrowth({ ...options,
    onDiagnostic: receipt => { lastDiagnostic = receipt; },
    additionalAcceptance: state => efficientGrowthMetrics(state).passed,
    onState: (label, state) => {
      if (label !== 'final') return;
      efficiency = efficientGrowthMetrics(state);
      const raw = JSON.stringify(state);
      finalStateSha256 = createHash('sha256').update(raw).digest('hex');
      writeFileSync(resolve(output, 'final-state.json'), raw);
    },
    onProgress: state => process.stderr.write(`${JSON.stringify({ tick: state.tick, lots: state.lots, l4: state.l4Houses })}\n`),
  });
  const summary = { source: report.source, seed: report.seed, opening: report.opening,
    status: 'capture-pending', simulationPassed: report.status === 'passed', acceptance: { ...report.acceptance, capture: false },
    efficiency, lastDiagnostic, finalStateSha256, targetLots: options.targetLots, maxTicks: report.maxTicks, final: report.final,
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
