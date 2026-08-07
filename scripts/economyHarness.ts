import {
  formatEconomyHarnessReport,
  runStage3EconomyHarness,
} from "./economyHarnessMetrics";

export { createConstructionEconomyHarnessScenario } from "./economyHarnessConstructionScenario";
export { createEconomyHarnessScenario } from "./economyHarnessScenario";
export { createStage3EconomyHarnessScenario } from "./economyHarnessStage3Scenario";
export {
  formatEconomyHarnessReport,
  hashEconomyState,
  runEconomyHarness,
  runStage3EconomyHarness,
} from "./economyHarnessMetrics";
export type {
  EconomyHarnessReport,
  HarnessMetric,
  RunEconomyHarnessInput,
  Stage3EconomyHarnessReport,
} from "./economyHarnessMetrics";

function isCliEntry(): boolean {
  return process.argv[1]?.endsWith("economyHarness.ts") === true;
}

if (isCliEntry()) {
  const report = runStage3EconomyHarness();
  console.log(formatEconomyHarnessReport(report));
}
