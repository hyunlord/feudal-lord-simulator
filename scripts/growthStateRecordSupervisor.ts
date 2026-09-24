import { gzipSync } from 'node:zlib';
import { fork } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sampleGrowthDecisionStack } from './growthStateRecordInspector';

export interface GrowthRecordMessage {
  readonly kind: 'decision-start' | 'decision-end' | 'final';
  readonly tick: number;
  readonly stateJson: string;
  readonly metricsJson: string;
  readonly diagnosticJson: string;
  readonly stopReason?: string;
}
function isRecordMessage(value: unknown): value is GrowthRecordMessage {
  return typeof value === 'object' && value !== null && 'kind' in value && ['decision-start', 'decision-end', 'final'].includes(String(value.kind)) &&
    'tick' in value && typeof value.tick === 'number' && 'stateJson' in value && typeof value.stateJson === 'string' &&
    'metricsJson' in value && typeof value.metricsJson === 'string' && 'diagnosticJson' in value && typeof value.diagnosticJson === 'string' &&
    (!('stopReason' in value) || typeof value.stopReason === 'string');
}
interface SlowDecision {
  readonly tick: number;
  readonly inputFile: string;
  readonly thresholdMs: number;
  elapsedMs: number;
  finished: boolean;
  stack: readonly string[];
}
export interface GrowthRecordingOptions {
  readonly worker: string;
  readonly output: string;
  readonly seed: number;
  readonly targetLots: number;
  readonly maxTicks: number;
  readonly wallTimeMs: number;
  readonly slowDecisionMs?: number;
}
export async function superviseGrowthRecording(options: GrowthRecordingOptions) {
  if (existsSync(options.output) && readdirSync(options.output).length > 0) throw new RangeError('Recording output must be empty');
  mkdirSync(options.output, { recursive: true });
  const started = performance.now();
  const slowThreshold = options.slowDecisionMs ?? 10_000;
  const child = fork(options.worker, [String(options.seed), String(options.targetLots), String(options.maxTicks)], { execArgv: ['--import', 'tsx', '--inspect=0'], silent: true });
  let latest: GrowthRecordMessage | null = null;
  let diagnosticJson = 'null';
  let stopReason = 'worker-exited';
  let pendingTick: number | null = null;
  let decisionStarted = 0;
  let decisionTimer: ReturnType<typeof setTimeout> | undefined;
  let inspectorUrl: string | null = null;
  let stderr = '';
  const slowDecisions: SlowDecision[] = [];
  const stackSamples: Promise<void>[] = [];
  const budget = setTimeout(() => { stopReason = 'wall-time-budget'; child.kill('SIGKILL'); }, options.wallTimeMs);
  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr = (stderr + text).slice(-32_000);
    inspectorUrl ??= /ws:\/\/[^\s]+/.exec(text)?.[0] ?? null;
  });
  child.on('message', (value: unknown) => {
    if (!isRecordMessage(value)) { stopReason = 'invalid-worker-message'; child.kill('SIGKILL'); return; }
    diagnosticJson = value.diagnosticJson;
    switch (value.kind) {
      case 'decision-start': {
        latest = value;
        pendingTick = value.tick;
        decisionStarted = performance.now();
        decisionTimer = setTimeout(() => {
          const inputFile = `slow-decision-${value.tick}-input.json.gz`;
          writeFileSync(join(options.output, inputFile), gzipSync(value.stateJson));
          const record: SlowDecision = { tick: value.tick, inputFile, thresholdMs: slowThreshold, elapsedMs: performance.now() - decisionStarted, finished: false, stack: ['src/engine/autoplay.ts:decideNextAction (entry; stack sampling pending)'] };
          slowDecisions.push(record);
          if (inspectorUrl !== null) stackSamples.push(sampleGrowthDecisionStack(inspectorUrl).then(stack => { record.stack = stack; }));
          process.stderr.write(`${JSON.stringify({ seed: options.seed, lots: options.targetLots, slowDecisionTick: value.tick, inputFile })}\n`);
        }, slowThreshold);
        break;
      }
      case 'decision-end': {
        clearTimeout(decisionTimer);
        const slow = slowDecisions.find(item => item.tick === value.tick);
        if (slow !== undefined) { slow.finished = true; slow.elapsedMs = performance.now() - decisionStarted; }
        pendingTick = null;
        break;
      }
      case 'final': latest = value; stopReason = value.stopReason ?? 'tick-budget'; break;
      default: { const unreachable: never = value.kind; throw new Error(`Unknown growth record event ${unreachable}`); }
    }
  });
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(budget);
  clearTimeout(decisionTimer);
  await Promise.all(stackSamples);
  // Node callbacks assign latest; the getter avoids TypeScript treating it as constant null.
  const readLatest = (): GrowthRecordMessage | null => latest;
  const final = readLatest();
  if (final !== null) writeFileSync(join(options.output, 'final-state.json'), final.stateJson);
  const pending = slowDecisions.find(item => item.tick === pendingTick && !item.finished);
  if (pending !== undefined) pending.elapsedMs = performance.now() - decisionStarted;
  writeFileSync(join(options.output, 'worker-stderr.txt'), stderr);
  const result = {
    classification: 'state-record-only-no-acceptance-judgment', seed: options.seed, targetLots: options.targetLots,
    maxTicks: options.maxTicks, wallTimeLimitMs: options.wallTimeMs, elapsedMs: performance.now() - started,
    stopReason, exit, finalTick: final?.tick ?? null,
    stateSemantics: final?.kind === 'final' ? 'completed-tick' : pendingTick === null ? 'last-decision-input' : 'before-pending-decision',
    metrics: final === null ? null : JSON.parse(final.metricsJson), lastDiagnostic: JSON.parse(diagnosticJson),
    slowDecisions, inputContract: 'Unmodified createGrowthOpening(seed), original createAutoplayTraceDriver and advanceTick. Parent watchdog preserves last received pre-decision input if interrupted; in-progress changes are not presented as completed ticks.',
  };
  writeFileSync(join(options.output, 'summary.json'), JSON.stringify(result, null, 2));
  return result;
}
