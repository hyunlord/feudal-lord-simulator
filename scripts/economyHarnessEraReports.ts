import { trackAutoplayRun } from "./economyHarnessAutoplay";
import { phase9Metrics, stage3Metrics } from "./economyHarnessEraMetrics";
import { createAdvisorMetricScenario } from "./economyHarnessAdvisorScenario";
import { createPhase9EconomyHarnessScenario } from "./economyHarnessPhase9Scenario";
import { trackPhase9Run } from "./economyHarnessPhase9Trace";
import { runEconomyHarness } from "./economyHarnessBaseReport";
import { createStage3EconomyHarnessScenario, STAGE3_LEGACY_HASH } from "./economyHarnessStage3Scenario";
import { trackStage3Run } from "./economyHarnessStage3Trace";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Phase9EconomyHarnessReport, RunPhase9EconomyHarnessInput, Stage3EconomyHarnessReport } from "./economyHarnessReportTypes";

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
