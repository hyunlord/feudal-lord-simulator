import {
  formatEconomyHarnessReport,
  runEconomyHarness,
} from "./economyHarnessMetrics";
import { createConstructionEconomyHarnessScenario } from "./economyHarnessConstructionScenario";

export { createConstructionEconomyHarnessScenario } from "./economyHarnessConstructionScenario";
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
    scenario: createConstructionEconomyHarnessScenario({ seed: 3 }),
    ticks: 4000,
    warmupTicks: 800,
  });
  console.log(formatEconomyHarnessReport(report));
}
