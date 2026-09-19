import { BUILD_CATEGORIES } from "../src/ui/buildMenuPresentation";

import { browserMeasurementAssertionsExpression } from "./phase13Part7BuildMenuProofProbeAssertions.js";
import { browserMeasurementMetricsExpression } from "./phase13Part7BuildMenuProofProbeMetrics.js";
import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";
import type { Viewport } from "./phase13Part7BuildMenuProofTypes.js";

export function browserMeasurementExpression(
  viewport: Viewport,
  scenario: ProofScenario,
): string {
  const groupLabels = BUILD_CATEGORIES.map((group) => group.label);
  return `${browserMeasurementMetricsExpression(groupLabels)}${browserMeasurementAssertionsExpression(viewport, scenario)}`;
}
