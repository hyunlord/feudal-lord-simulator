export function browserMeasurementMetricsExpression(groupLabels: readonly string[]): string {
  return `(() => {
    const failures = [];
    const round = (value) => Math.round(value * 100) / 100;
    const tolerance = 1;
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: round(rect.top),
        right: round(rect.right),
        bottom: round(rect.bottom),
        left: round(rect.left),
        width: round(rect.width),
        height: round(rect.height),
      };
    };
    const rectFitsWithin = (inner, outer) =>
      inner.left >= outer.left - tolerance &&
      inner.top >= outer.top - tolerance &&
      inner.right <= outer.right + tolerance &&
      inner.bottom <= outer.bottom + tolerance;
    const requireElement = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(selector + " missing");
      return element;
    };
    const surfaceMetrics = (selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error(selector + " yielded non-HTMLElement");
      const style = getComputedStyle(element);
      if (style.display === "contents") {
        return {
          selector,
          text: element.textContent?.trim().slice(0, 48) ?? "",
          display: style.display,
          skippedPhysicalSurface: true,
          horizontalFits: true,
          verticalFits: true,
        };
      }
      const text = element.matches("html, body") ? "" : (element.textContent?.trim() ?? "").slice(0, 48);
      return {
        selector,
        text,
        display: style.display,
        skippedPhysicalSurface: false,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        rect: rectOf(element),
        horizontalFits: element.scrollWidth <= element.clientWidth + tolerance,
        verticalFits: element.scrollHeight <= element.clientHeight + tolerance,
      };
    });
    const textMetrics = (selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error(selector + " yielded non-HTMLElement");
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("2d canvas unavailable");
      context.font = style.font;
      const measuredTextWidth = context.measureText(element.textContent?.trim() ?? "").width;
      return {
        text: element.textContent?.trim() ?? "",
        font: style.font,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        measuredTextWidth: round(measuredTextWidth),
        rect: rectOf(element),
        visible: style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0,
        canvasFits: measuredTextWidth <= element.clientWidth + 1,
        domFits: element.scrollWidth <= element.clientWidth + 1,
      };
    });

    const consolePanel = requireElement(".court-console");
    const sealRecess = requireElement(".seal-recess");
    const buildSeals = requireElement(".build-seals");
    const minimap = requireElement(".map-overview");
    const html = requireElement("html");
    const body = requireElement("body");
    const labelMetrics = textMetrics(".build-seal-label");
    const groupMetrics = textMetrics(".build-group-label");
    const buttonMetrics = Array.from(document.querySelectorAll(".build-seal")).map((element) => {
      if (!(element instanceof HTMLButtonElement)) throw new Error(".build-seal yielded non-button");
      const rect = rectOf(element);
      return {
        label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
        rect,
        withinBuildSeals: rectFitsWithin(rect, rectOf(buildSeals)),
      };
    });
    const rowTops = [...new Set(buttonMetrics.map((metric) => metric.rect.top))].sort((left, right) => left - right);
    const visualRows = rowTops.reduce((rows, top) => {
      const lastRow = rows.at(-1);
      if (lastRow === undefined || Math.abs(lastRow - top) > 2) rows.push(top);
      return rows;
    }, []);
    const internalSurfaces = [
      "html",
      "body",
      ".app-shell",
      ".court-console",
      ".court-recess",
      ".seal-recess",
      ".build-seals",
      ".build-group",
      ".build-group-seals",
      ".road-tool",
    ].flatMap((selector) => surfaceMetrics(selector));
    const groupSemantics = Array.from(document.querySelectorAll(".build-group")).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error(".build-group yielded non-HTMLElement");
      return {
        role: element.getAttribute("role"),
        ariaLabel: element.getAttribute("aria-label"),
      };
    });
    const groupLayouts = Array.from(document.querySelectorAll(".build-group")).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error(".build-group yielded non-HTMLElement");
      const groupRect = rectOf(element);
      const groupLabel = element.querySelector(".build-group-label");
      const seals = Array.from(element.querySelectorAll(".build-seal"));
      if (!(groupLabel instanceof HTMLElement)) throw new Error(".build-group-label missing");
      return {
        group: groupRect,
        label: rectOf(groupLabel),
        sealRects: seals.map((seal) => rectOf(seal)),
      };
    });
    const expectedGroupLabels = ${JSON.stringify(groupLabels)};
`;
}
