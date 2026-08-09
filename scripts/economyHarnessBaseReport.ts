import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";
import { harnessMetric } from "./economyHarnessMetric";
import { trackRun } from "./economyHarnessTrace";
import type { EconomyHarnessReport, RunEconomyHarnessInput } from "./economyHarnessReportTypes";

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
