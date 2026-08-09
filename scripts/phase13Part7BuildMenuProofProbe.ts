import { buildMenuGroups } from "../src/ui/buildMenuModel";

import { browserMeasurementAssertionsExpression } from "./phase13Part7BuildMenuProofProbeAssertions.js";
import { browserMeasurementMetricsExpression } from "./phase13Part7BuildMenuProofProbeMetrics.js";
import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";
import type { Viewport } from "./phase13Part7BuildMenuProofTypes.js";

export function browserMeasurementExpression(
  viewport: Viewport,
  scenario: ProofScenario,
): string {
  const groupLabels = buildMenuGroups(scenario.state).map((group) => group.label);
  return `${browserMeasurementMetricsExpression(groupLabels)}${browserMeasurementAssertionsExpression(viewport, scenario)}`;
}
