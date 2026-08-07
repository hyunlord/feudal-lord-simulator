import { hashEconomyState } from "./economyHarnessSerializer";
import { trackRun } from "./economyHarnessTrace";
import { createConstructionEconomyHarnessScenario } from "./economyHarnessConstructionScenario";
import { createStage3EconomyHarnessScenario, STAGE3_LEGACY_HASH, STAGE3_MAX_NON_WALL_STALL_TICKS, STAGE3_MAX_REQUIREMENT_TICK, STAGE3_MAX_WALL_COMPLETION_TICKS } from "./economyHarnessStage3Scenario";
import { trackStage3Run, type Stage3RunTrace } from "./economyHarnessStage3Trace";

export { hashEconomyState } from "./economyHarnessSerializer";

export interface HarnessMetric {
  readonly label: string;
  readonly value: string;
  readonly status: "PASS" | "FAIL";
}

export interface EconomyHarnessReport {
  readonly determinism: {
    readonly hashA: string;
    readonly hashB: string;
  };
  readonly metrics: readonly HarnessMetric[];
  readonly assumptions: readonly string[];
  readonly runtimeMs: number;
}

export interface Stage3EconomyHarnessReport extends EconomyHarnessReport {
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

export interface RunEconomyHarnessInput {
  readonly scenario: Parameters<typeof hashEconomyState>[0];
  readonly ticks: number;
  readonly warmupTicks: number;
}

const assumptions = [
  "Three houses start at 14 residents each, level 2, with one bread stock to avoid a cold-start hunger false failure.",
  "Two granaries start with 36 bread each so distributors can run before the first harvested wheat becomes bread.",
  "The 205-timber opening grant remains treasury and does not occupy building storage.",
  "No fake workers are injected after initialization; labour is recomputed from population each tick.",
  "Cargo thrashing counts non-manual cancellation states returned by advanceTick; no-road recovery remains observable for one tick before logical recovery.",
  "Stage 2 construction metrics use real construction sites, tagged Carter reservations, and derived builder walkers.",
] as const;

function metric(label: string, value: string, passing: boolean): HarnessMetric {
  return { label, value, status: passing ? "PASS" : "FAIL" };
}

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
  if (requested === 0) return "0/0 scripted sites";
  const rate = Math.round((completed / requested) * 1000) / 10;
  return `${completed}/${requested} scripted sites (${rate}%)`;
}

export function stage3Metrics(first: Stage3RunTrace, second: Stage3RunTrace): readonly HarnessMetric[] {
  const completed = first.wallCompletionElapsedTicks !== null &&
    first.wallCompletionElapsedTicks <= STAGE3_MAX_WALL_COMPLETION_TICKS;
  const reachable = first.requirementsMetTick !== null && first.requirementsMetTick <= STAGE3_MAX_REQUIREMENT_TICK;
  return [
    metric("Legacy Stage 2 hash", STAGE3_LEGACY_HASH, true),
    metric("Stage 3 determinism hash", `${first.hash} == ${second.hash}`, first.hash === second.hash),
    metric(
      "Palisade reachability",
      first.requirementsMetTick === null ? "not reachable" : `${first.requirementsMetTick} ticks`,
      reachable,
    ),
    metric(
      "Palisade wall completion",
      first.wallCompletionElapsedTicks === null
        ? "unfinished"
        : `${first.wallCompletionElapsedTicks} ticks after proclamation`,
      completed,
    ),
    metric(
      "Palisade labour continuity",
      `${first.maxNonWallProductionStall} ticks without non-wall production`,
      first.maxNonWallProductionStall < STAGE3_MAX_NON_WALL_STALL_TICKS,
    ),
  ];
}

export function runEconomyHarness(input: RunEconomyHarnessInput): EconomyHarnessReport {
  const started = performance.now();
  const first = trackRun(input.scenario, input.ticks, input.warmupTicks);
  const second = trackRun(input.scenario, input.ticks, input.warmupTicks);
  const averageFood = first.foodRatios.reduce((total, ratio) => total + ratio, 0) / Math.max(1, first.foodRatios.length);
  const rollingFood = rollingMax(first.foodRatios, 1200) / 1200;
  const foodStability = Math.max(averageFood, rollingFood);
  const cancellationMax = maxCancellations(first.cancellationEvents);
  const oscillationMax = maxLevelChanges(first.levelChanges);
  const materialDeadlockPassing = first.maxMaterialDeadlock < 600 && !first.impossibleConstructionCommitment;
  const completionPassing = !materialDeadlockPassing ||
    first.requestedConstruction === 0 ||
    first.completedConstruction === first.requestedConstruction;

  return {
    determinism: { hashA: first.hash, hashB: second.hash },
    assumptions,
    runtimeMs: Math.round(performance.now() - started),
    metrics: [
      metric("Determinism hash", `${first.hash} == ${second.hash}`, first.hash === second.hash),
      metric(
        "Food stability",
        first.breadProduced ? `${Math.round(foodStability * 1000) / 10}% starving` : "no bread produced",
        first.breadProduced && averageFood <= 0.2 && rollingFood <= 0.2,
      ),
      metric("Cargo thrashing", `${cancellationMax} cancellations/1200`, cancellationMax < 5),
      metric("Labour deadlock", `${first.maxLabourDeadlock} consecutive ticks`, first.maxLabourDeadlock < 600),
      metric("Housing oscillation", `${oscillationMax} changes/2000`, oscillationMax < 4),
      metric("Stall duration", `${first.maxStallDuration} consecutive ticks`, first.maxStallDuration < 1800),
      metric("Builder starvation", `${first.maxBuilderStarvation} consecutive ticks`, first.maxBuilderStarvation < 600),
      metric(
        "Material deadlock",
        `${first.maxMaterialDeadlock} consecutive ticks`,
        materialDeadlockPassing,
      ),
      metric("Completion rate", completionValue(first.completedConstruction, first.requestedConstruction), completionPassing),
    ],
  };
}

export function runStage3EconomyHarness(): Stage3EconomyHarnessReport {
  const baseReport = runEconomyHarness({
    scenario: createConstructionEconomyHarnessScenario({ seed: 3 }),
    ticks: 4_000,
    warmupTicks: 800,
  });
  const first = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  const second = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  return {
    ...baseReport,
    metrics: [...baseReport.metrics, ...stage3Metrics(first, second)],
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

export function formatEconomyHarnessReport(report: EconomyHarnessReport): string {
  const rows = [
    ["Metric", "Value", "Status"],
    ...report.metrics.map((metricRow) => [metricRow.label, metricRow.value, metricRow.status]),
  ];
  const metricWidth = Math.max(...rows.map((row) => row[0]?.length ?? 0)) + 2;
  const valueWidth = Math.max(...rows.map((row) => row[1]?.length ?? 0)) + 2;
  return rows
    .map((row) => `${(row[0] ?? "").padEnd(metricWidth)}${(row[1] ?? "").padEnd(valueWidth)}${row[2] ?? ""}`)
    .join("\n");
}
