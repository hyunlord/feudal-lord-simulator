import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";
import type { Viewport } from "./phase13Part7BuildMenuProofTypes.js";

export function browserMeasurementAssertionsExpression(viewport: Viewport, scenario: ProofScenario): string {
  return `    const actualGroupLabels = groupSemantics.map((group) => group.ariaLabel?.replace(/ 도구$/, "") ?? "");
    const columnCount = getComputedStyle(buildSeals).gridTemplateColumns.split(" ").filter(Boolean).length;
    const buildRect = rectOf(buildSeals);
    const recessRect = rectOf(sealRecess);
    const mapRect = rectOf(minimap);

    const prefix = "${scenario.name} ${viewport.width}px: ";
    if (document.documentElement.scrollWidth > window.innerWidth + tolerance) failures.push(prefix + "document has horizontal overflow");
    if (document.documentElement.scrollHeight > window.innerHeight + tolerance) failures.push(prefix + "document has vertical overflow");
    if (html.scrollWidth > html.clientWidth + tolerance) failures.push(prefix + "html has horizontal overflow");
    if (body.scrollWidth > body.clientWidth + tolerance) failures.push(prefix + "body has horizontal overflow");
    if (mapRect.width > 140 || mapRect.height > 140) failures.push(prefix + "minimap exceeds 140px square");
    if (buildSeals.scrollHeight > buildSeals.clientHeight + 1) failures.push(prefix + "build menu has vertical scroll");
    if (buildSeals.scrollWidth > buildSeals.clientWidth + 1) failures.push(prefix + "build menu has horizontal scroll");
    if (buildRect.top < recessRect.top - 1 || buildRect.bottom > recessRect.bottom + 1) failures.push(prefix + "build menu clips outside seal recess");
    for (const surface of internalSurfaces) {
      if (!surface.horizontalFits) failures.push(prefix + "internal surface horizontally overflows: " + surface.selector + " " + surface.text);
      if (!surface.verticalFits) failures.push(prefix + "internal surface vertically overflows: " + surface.selector + " " + surface.text);
    }
    for (const button of buttonMetrics) {
      if (!button.withinBuildSeals) failures.push(prefix + "build seal outside build-seals: " + button.label);
    }
    for (const metric of [...labelMetrics, ...groupMetrics]) {
      if (${viewport.width} > 900 && !metric.visible) failures.push(prefix + "desktop text is hidden: " + metric.text);
      if (${viewport.width} <= 900 && groupMetrics.includes(metric) && metric.visible) failures.push(prefix + "compact group label is visible: " + metric.text);
      if (!metric.visible) continue;
      if (!metric.domFits) failures.push(prefix + "DOM text overflows: " + metric.text);
      if (!metric.canvasFits) failures.push(prefix + "canvas text overflows: " + metric.text);
    }
    if (buttonMetrics.length !== ${scenario.expectedButtons}) {
      failures.push(prefix + "expected ${scenario.expectedButtons} buttons, got " + buttonMetrics.length);
    }
    if (${viewport.width} <= 900 && columnCount !== 4) {
      failures.push(prefix + "expected compact four-column matrix, got " + columnCount);
    }
    if (${viewport.width} <= 900 && visualRows.length > ${scenario.maxCompactRows}) {
      failures.push(prefix + "build seals use " + visualRows.length + " visual rows, expected at most ${scenario.maxCompactRows}");
    }
    if (actualGroupLabels.join("|") !== expectedGroupLabels.join("|")) {
      failures.push(prefix + "semantic group labels mismatch: " + actualGroupLabels.join("|"));
    }
    for (const group of groupSemantics) {
      if (group.role !== "group") failures.push(prefix + "build section lacks role=group: " + group.ariaLabel);
      if (typeof group.ariaLabel !== "string" || group.ariaLabel.length === 0) {
        failures.push(prefix + "build section lacks aria-label");
      }
    }
    if (${viewport.width} > 900) {
      for (const layout of groupLayouts) {
        if (!rectFitsWithin(layout.label, layout.group)) {
          failures.push(prefix + "desktop group header escapes its section");
        }
        for (const sealRect of layout.sealRects) {
          if (!rectFitsWithin(sealRect, layout.group)) {
            failures.push(prefix + "desktop group button escapes its section");
          }
        }
      }
    }

    return {
      verdict: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      measurements: {
        viewport: ${JSON.stringify(viewport)},
        scenario: "${scenario.name}",
        console: rectOf(consolePanel),
        sealRecess: recessRect,
        internalSurfaces,
        buildSeals: {
          ...buildRect,
          clientWidth: buildSeals.clientWidth,
          clientHeight: buildSeals.clientHeight,
          scrollWidth: buildSeals.scrollWidth,
          scrollHeight: buildSeals.scrollHeight,
          overflowY: getComputedStyle(buildSeals).overflowY,
        },
        minimap: mapRect,
        buttons: buttonMetrics,
        columnCount,
        visualRows,
        labels: labelMetrics,
        groupLabels: groupMetrics,
        groupSemantics,
        groupLayouts,
      },
    };
  })()`;
}
