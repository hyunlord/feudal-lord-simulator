import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";
import type { Viewport } from "./phase13Part7BuildMenuProofTypes.js";

export function browserMeasurementAssertionsExpression(viewport: Viewport, scenario: ProofScenario): string {
  return `
    const actualLabels = categories.map((category) => category.textContent.trim());
    if (actualLabels.join('|') !== expectedGroupLabels.join('|')) failures.push('category labels mismatch');
    if (seen.size !== ${scenario.expectedButtons}) failures.push('expected ${scenario.expectedButtons} distinct reachable tools, got ' + seen.size);
    if (required('.map-overview').getBoundingClientRect().width > 160) failures.push('minimap exceeds160px');
    return {
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
      failures: failures.map((failure) => '${scenario.name} ${viewport.width}px: ' + failure),
      measurements: {
        viewport: ${JSON.stringify(viewport)},
        scenario: '${scenario.name}',
        method: 'SSR open catalogue geometry; browser reveals the real drawer and each category, scrolls every tool into view, and reads Chrome AX groups',
        categories: actualLabels,
        buttons: measurements,
        distinctTools: seen.size,
        buildMenu: rectOf(menu),
        sealRecess: rectOf(recess),
      },
    };
  })()`;
}
