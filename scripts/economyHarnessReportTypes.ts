import type { hashEconomyState } from "./economyHarnessSerializer";
import type { HarnessMetric } from "./economyHarnessMetric";
import type { AdvisorRunsProvenance } from "./economyHarnessAutoplay";

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
