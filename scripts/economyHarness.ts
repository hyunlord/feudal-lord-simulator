import {
  formatEconomyHarnessReport,
  runEconomyHarness,
} from "./economyHarnessMetrics";
import { createEconomyHarnessScenario } from "./economyHarnessScenario";

export { createEconomyHarnessScenario } from "./economyHarnessScenario";
export {
  formatEconomyHarnessReport,
  hashEconomyState,
  runEconomyHarness,
} from "./economyHarnessMetrics";
export type {
  EconomyHarnessReport,
  HarnessMetric,
  RunEconomyHarnessInput,
} from "./economyHarnessMetrics";

function isCliEntry(): boolean {
  return process.argv[1]?.endsWith("economyHarness.ts") === true;
}

if (isCliEntry()) {
  const report = runEconomyHarness({
    scenario: createEconomyHarnessScenario({ seed: 3 }),
    ticks: 4000,
    warmupTicks: 800,
  });
  console.log(formatEconomyHarnessReport(report));
}
