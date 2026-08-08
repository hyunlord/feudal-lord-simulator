import {
  formatEconomyHarnessReport,
  runPhase9EconomyHarness,
  runStage3EconomyHarness,
} from "./economyHarnessMetrics";

export { createConstructionEconomyHarnessScenario } from "./economyHarnessConstructionScenario";
export { createEconomyHarnessScenario } from "./economyHarnessScenario";
export { createPhase9EconomyHarnessScenario } from "./economyHarnessPhase9Scenario";
export { createStage3EconomyHarnessScenario } from "./economyHarnessStage3Scenario";
export {
  formatEconomyHarnessReport,
  hashEconomyState,
  phase9Metrics,
  runEconomyHarness,
  runPhase9EconomyHarness,
  runStage3EconomyHarness,
  stage3Metrics,
} from "./economyHarnessMetrics";
export { trackPhase9Run } from "./economyHarnessPhase9Trace";
export type {
  EconomyHarnessReport,
  HarnessMetric,
  Phase9EconomyHarnessReport,
  RunEconomyHarnessInput,
  RunPhase9EconomyHarnessInput,
  Stage3EconomyHarnessReport,
} from "./economyHarnessMetrics";

function isCliEntry(): boolean {
  return process.argv[1]?.endsWith("economyHarness.ts") === true;
}

export function parsePhase9WorkerCount(args: readonly string[]): { readonly workers: number } {
  const workerArg = args.find((arg) => arg.startsWith("--workers="));
  if (workerArg === undefined) return { workers: 1 };
  const raw = workerArg.slice("--workers=".length);
  const workers = Number(raw);
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error("--workers must be an integer from 1 to 8");
  }
  if (workers > 8) {
    throw new Error("--workers safety ceiling is 8");
  }
  return { workers };
}

if (isCliEntry()) {
  try {
    const args = process.argv.slice(2);
    const report = args.includes("--phase9")
      ? runPhase9EconomyHarness(parsePhase9WorkerCount(args))
      : runStage3EconomyHarness();
    console.log(formatEconomyHarnessReport(report));
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
