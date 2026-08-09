import { hashEconomyState } from "./economyHarnessSerializer";
import { phase9Metrics, stage3Metrics } from "./economyHarnessEraMetrics";
import { harnessMetric, type HarnessMetric } from "./economyHarnessMetric";
import { trackRun } from "./economyHarnessTrace";
import { createPhase9EconomyHarnessScenario } from "./economyHarnessPhase9Scenario";
import { trackPhase9Run } from "./economyHarnessPhase9Trace";
import { createStage3EconomyHarnessScenario, STAGE3_LEGACY_HASH } from "./economyHarnessStage3Scenario";
import { trackStage3Run } from "./economyHarnessStage3Trace";
import { createAutoplayTraceDriver, trackAutoplayRun, type AdvisorRunsProvenance } from "./economyHarnessAutoplay";
import { createAdvisorMetricScenario } from "./economyHarnessAdvisorScenario";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

export { hashEconomyState } from "./economyHarnessSerializer";
export { phase9Metrics, stage3Metrics } from "./economyHarnessEraMetrics";
export type { HarnessMetric } from "./economyHarnessMetric";

export interface EconomyHarnessReport {
  readonly determinism: {
    readonly hashA: string;
    readonly hashB: string;
  };
  readonly metrics: readonly HarnessMetric[];
  readonly assumptions: readonly string[];
  readonly runtimeMs: number;
  readonly autoplay?: AutoplayHarnessBalanceResult;
  readonly advisorProvenance?: AdvisorRunsProvenance;
  readonly metricTraceSources?: readonly MetricTraceSource[];
}

export interface AutoplayHarnessBalanceResult {
  readonly hashA: string;
  readonly hashB: string;
  readonly actionCount: number;
}

export interface MetricTraceSource {
  readonly label: string;
  readonly traceId: string;
  readonly source: string;
}

export interface Stage3EconomyHarnessReport extends EconomyHarnessReport {
  readonly autoplay: AutoplayHarnessBalanceResult;
  readonly stage3: {
    readonly legacyHash: string;
    readonly hashA: string;
    readonly hashB: string;
    readonly requirementsMetTick: number | null;
    readonly proclamationTick: number | null;
    readonly wallCompleteTick: number | null;
    readonly wallCompletionElapsedTicks: number | null;
    readonly maxNonWallProductionStall: number;
  };
}

export interface Phase9EconomyHarnessReport extends Stage3EconomyHarnessReport {
  readonly phase9: {
    readonly hashA: string;
    readonly hashB: string;
    readonly workersRequested: number;
    readonly workersUsed: number;
    readonly initialTick: number;
    readonly coinReachedTick: number | null;
    readonly coin200ReachedTick: number | null;
    readonly spendableStone400ReachedTick: number | null;
    readonly era3ConditionsMetTick: number | null;
    readonly proclamationTick: number | null;
    readonly stoneWallCompleteTick: number | null;
    readonly stoneWallCompletionElapsedTicks: number | null;
    readonly maxStoneChainStallWithAccess: number;
    readonly segmentMaterialGapTicks: number;
  };
  readonly phase9Metrics: readonly HarnessMetric[];
}

export interface RunEconomyHarnessInput {
  readonly scenario: Parameters<typeof hashEconomyState>[0];
  readonly ticks: number;
  readonly warmupTicks: number;
  readonly advisorDriven?: boolean;
  readonly advisorTraceSource?: string;
}

export interface RunPhase9EconomyHarnessInput {
  readonly workers: number;
}

const assumptions = [
  "Three houses start at 14 residents each, level 2, with one bread stock to avoid a cold-start hunger false failure.",
  "Two granaries start with 36 bread each so distributors can run before the first harvested wheat becomes bread.",
  "The 205-timber opening grant remains treasury and does not occupy building storage.",
  "No fake workers are injected after initialization; labour is recomputed from population each tick.",
  "Cargo thrashing counts non-manual cancellation states returned by advanceTick; no-road recovery remains observable for one tick before logical recovery.",
  "Stage 2 construction metrics use advisor-requested construction sites, tagged Carter reservations, and derived builder walkers.",
] as const;

function rollingMax(values: readonly number[], window: number): number {
  let max = 0;
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index] ?? 0;
    if (index >= window) sum -= values[index - window] ?? 0;
    max = Math.max(max, sum);
  }
  return max;
}

function maxCancellations(events: readonly { readonly tick: number; readonly key: string }[]): number {
  let max = 0;
  for (const event of events) {
    const count = events.filter((candidate) =>
      candidate.key === event.key &&
      candidate.tick >= event.tick &&
      candidate.tick < event.tick + 1200,
    ).length;
    max = Math.max(max, count);
  }
  return max;
}

function maxChangesInWindow(ticks: readonly number[], window: number): number {
  let max = 0;
  for (const tick of ticks) {
    const count = ticks.filter((candidate) => candidate >= tick && candidate < tick + window).length;
    max = Math.max(max, count);
  }
  return max;
}

function maxLevelChanges(changes: Readonly<Record<string, readonly number[]>>): number {
  return Object.values(changes).reduce((max, ticks) => Math.max(max, maxChangesInWindow(ticks, 2000)), 0);
}

function completionValue(completed: number, requested: number): string {
  if (requested === 0) return "0/0 advisor-requested sites";
  const rate = Math.round((completed / requested) * 1000) / 10;
  return `${completed}/${requested} advisor-requested sites (${rate}%)`;
}

export function runEconomyHarness(input: RunEconomyHarnessInput): EconomyHarnessReport {
  const started = performance.now();
  const traceSource = input.advisorTraceSource ?? "input scenario";
  const firstDriver = input.advisorDriven === true ? createAutoplayTraceDriver({ id: "default", source: traceSource }) : undefined;
  const secondDriver = input.advisorDriven === true ? createAutoplayTraceDriver({ id: "default-check", source: traceSource }) : undefined;
  const first = trackRun(input.scenario, input.ticks, input.warmupTicks, firstDriver);
  const second = trackRun(input.scenario, input.ticks, input.warmupTicks, secondDriver);
  const averageFood = first.foodRatios.reduce((total, ratio) => total + ratio, 0) / Math.max(1, first.foodRatios.length);
  const rollingFood = rollingMax(first.foodRatios, 1200) / 1200;
  const foodStability = Math.max(averageFood, rollingFood);
  const cancellationMax = maxCancellations(first.cancellationEvents);
  const oscillationMax = maxLevelChanges(first.levelChanges);
  const materialDeadlockPassing = first.maxMaterialDeadlock < 600 && !first.impossibleConstructionCommitment;
  const completionPassing = !materialDeadlockPassing ||
    first.requestedConstruction === 0 ||
    first.completedConstruction === first.requestedConstruction;
  const report = {
    determinism: { hashA: first.hash, hashB: second.hash },
    assumptions,
    runtimeMs: Math.round(performance.now() - started),
    metrics: [
      harnessMetric("Determinism hash", `${first.hash} == ${second.hash}`, first.hash === second.hash),
      harnessMetric(
        "Food stability",
        first.breadProduced ? `${Math.round(foodStability * 1000) / 10}% starving` : "no bread produced",
        first.breadProduced && averageFood <= 0.2 && rollingFood <= 0.2,
      ),
      harnessMetric("Cargo thrashing", `${cancellationMax} cancellations/1200`, cancellationMax < 5),
      harnessMetric("Labour deadlock", `${first.maxLabourDeadlock} consecutive ticks`, first.maxLabourDeadlock < 600),
      harnessMetric("Housing oscillation", `${oscillationMax} changes/2000`, oscillationMax < 4),
      harnessMetric("Stall duration", `${first.maxStallDuration} consecutive ticks`, first.maxStallDuration < 1800),
      harnessMetric("Builder starvation", `${first.maxBuilderStarvation} consecutive ticks`, first.maxBuilderStarvation < 600),
      harnessMetric(
        "Material deadlock",
        `${first.maxMaterialDeadlock} consecutive ticks`,
        materialDeadlockPassing,
      ),
      harnessMetric("Completion rate", completionValue(first.completedConstruction, first.requestedConstruction), completionPassing),
    ],
  };
  if (first.advisorProvenance === undefined) return report;

  return {
    ...report,
    advisorProvenance: { kind: "advisor-runs", traces: [first.advisorProvenance] },
    metricTraceSources: report.metrics.map((metric) => ({
      label: metric.label,
      traceId: "default",
      source: traceSource,
    })),
  };
}

export function runStage3EconomyHarness(): Stage3EconomyHarnessReport {
  const baseReport = runEconomyHarness({
    scenario: createAdvisorMetricScenario(),
    ticks: 4_000,
    warmupTicks: 800,
    advisorDriven: true,
    advisorTraceSource: "createAdvisorMetricScenario",
  });
  const first = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  const second = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  const stage3Rows = stage3Metrics(first, second);
  const autoplayFirst = trackAutoplayRun({ initialState: DEFAULT_GAME_STATE, ticks: 480 });
  const autoplaySecond = trackAutoplayRun({ initialState: DEFAULT_GAME_STATE, ticks: 480 });
  return {
    ...baseReport,
    metrics: [...baseReport.metrics, ...stage3Rows],
    advisorProvenance: {
      kind: "advisor-runs",
      traces: [...(baseReport.advisorProvenance?.traces ?? []), first.advisorProvenance],
    },
    metricTraceSources: [
      ...(baseReport.metricTraceSources ?? []),
      ...stage3Rows.map((metric) => ({
        label: metric.label,
        traceId: "stage3-seeded",
        source: "createStage3EconomyHarnessScenario",
      })),
    ],
    autoplay: {
      hashA: autoplayFirst.hash,
      hashB: autoplaySecond.hash,
      actionCount: autoplayFirst.appliedActions.length,
    },
    stage3: {
      legacyHash: STAGE3_LEGACY_HASH,
      hashA: first.hash,
      hashB: second.hash,
      requirementsMetTick: first.requirementsMetTick,
      proclamationTick: first.proclamationTick,
      wallCompleteTick: first.wallCompleteTick,
      wallCompletionElapsedTicks: first.wallCompletionElapsedTicks,
      maxNonWallProductionStall: first.maxNonWallProductionStall,
    },
  };
}

export function runPhase9EconomyHarness(input: RunPhase9EconomyHarnessInput): Phase9EconomyHarnessReport {
  const stage3Report = runStage3EconomyHarness();
  const first = trackPhase9Run(createPhase9EconomyHarnessScenario({ seed: 9 }));
  const second = trackPhase9Run(createPhase9EconomyHarnessScenario({ seed: 9 }));
  const phase9Rows = phase9Metrics(first, second);
  return {
    ...stage3Report,
    metrics: [...stage3Report.metrics, ...phase9Rows],
    phase9Metrics: phase9Rows,
    phase9: {
      hashA: first.hash,
      hashB: second.hash,
      workersRequested: input.workers,
      workersUsed: Math.min(input.workers, 2),
      initialTick: first.initialTick,
      coinReachedTick: first.coinReachedTick,
      coin200ReachedTick: first.coin200ReachedTick,
      spendableStone400ReachedTick: first.spendableStone400ReachedTick,
      era3ConditionsMetTick: first.era3ConditionsMetTick,
      proclamationTick: first.proclamationTick,
      stoneWallCompleteTick: first.stoneWallCompleteTick,
      stoneWallCompletionElapsedTicks: first.stoneWallCompletionElapsedTicks,
      maxStoneChainStallWithAccess: first.maxStoneChainStallWithAccess,
      segmentMaterialGapTicks: first.segmentMaterialGapTicks,
    },
  };
}

export function formatEconomyHarnessReport(report: EconomyHarnessReport): string {
  const rows = [
    ["Metric", "Value", "Status"],
    ...report.metrics.map((metricRow) => [metricRow.label, metricRow.value, metricRow.status]),
  ];
  const metricWidth = Math.max(...rows.map((row) => row[0]?.length ?? 0)) + 2;
  const valueWidth = Math.max(...rows.map((row) => row[1]?.length ?? 0)) + 2;
  const metricTable = rows
    .map((row) => `${(row[0] ?? "").padEnd(metricWidth)}${(row[1] ?? "").padEnd(valueWidth)}${row[2] ?? ""}`)
    .join("\n");
  if (report.autoplay === undefined) return metricTable;
  const autoplay = report.autoplay;
  const status = autoplay.hashA === autoplay.hashB && autoplay.actionCount > 0 ? "PASS" : "FAIL";
  const provenance = report.advisorProvenance;
  const provenanceLine = provenance === undefined
    ? ""
    : `\nAdvisor provenance  ${provenance.kind}: ${provenance.traces.map((trace) => `${trace.id}/${trace.source} cadence ${trace.cadenceTicks}, ${trace.actionCount} actions, ${trace.snapshotCount} snapshots`).join("; ")}  PASS`;
  return `${metricTable}${provenanceLine}\nAutoplay advisor  ${autoplay.actionCount} actions, ${autoplay.hashA} == ${autoplay.hashB}  ${status}`;
}
