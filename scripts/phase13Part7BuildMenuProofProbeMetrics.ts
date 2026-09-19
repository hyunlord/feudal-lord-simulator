export function browserMeasurementMetricsExpression(groupLabels: readonly string[]): string {
  return `(() => {
    const failures = [];
    const tolerance = 1;
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const fits = (inner, outer) => inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance && inner.top >= outer.top - tolerance && inner.bottom <= outer.bottom + tolerance;
    const required = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(selector + ' missing');
      return element;
    };
    const menu = required('.build-menu');
    const recess = required('.seal-recess');
    const catalog = required('.build-menu-catalog');
    const categories = Array.from(document.querySelectorAll('.build-menu-category'));
    const panels = Array.from(document.querySelectorAll('.build-menu-tools'));
    const originalHidden = panels.map((panel) => panel.hidden);
    const measurements = [];
    const seen = new Set();
    const expectedGroupLabels = ${JSON.stringify(groupLabels)};
    for (const category of categories) {
      const targetId = category.getAttribute('aria-controls');
      const panel = document.getElementById(targetId);
      if (!panel) { failures.push('category target missing: ' + targetId); continue; }
      // Static SSR geometry fixture: reveal each real component panel to measure
      // every category. Actual React click behavior is covered by live game QA.
      panels.forEach((candidate) => { candidate.hidden = candidate !== panel; });
      catalog.scrollLeft = 0;
      const buttons = Array.from(panel.querySelectorAll('.build-tool'));
      for (const button of buttons) {
        button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const label = button.querySelector('.build-seal-label');
        const cost = button.querySelector('.build-tool-cost');
        const rectangle = rectOf(button);
        const name = button.getAttribute('aria-label');
        seen.add(name);
        if (!label || !cost) { failures.push('tool lacks name/cost: ' + name); continue; }
        const labelRect = rectOf(label);
        const costRect = rectOf(cost);
        if (rectangle.width < 44 || rectangle.height < 44) failures.push('small target: ' + name);
        if (!fits(rectangle, rectOf(catalog))) failures.push('tool unreachable in scroll strip: ' + name);
        if (!fits(labelRect, rectangle) || label.scrollWidth > label.clientWidth + tolerance) failures.push('label clips: ' + name);
        if (!fits(costRect, rectangle) || cost.scrollWidth > cost.clientWidth + tolerance) failures.push('cost clips: ' + name);
        if (parseFloat(getComputedStyle(label).fontSize) < 12) failures.push('label below12px: ' + name);
        if (label.textContent.trim() !== name) failures.push('visible and accessible labels differ: ' + name);
        measurements.push({ category: category.textContent.trim(), name, rect: rectangle, label: labelRect, cost: costRect });
      }
      const rowTops = new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
      if (rowTops.size > 1) failures.push('category tool strip unexpectedly wraps');
      if (!fits(rectOf(menu), rectOf(recess))) failures.push('menu outside assigned recess: ' + category.textContent);
      for (const selector of ['html', 'body', '.app-shell', '.court-console', '.seal-recess', '.build-menu']) {
        const surface = required(selector);
        if (surface.scrollWidth > surface.clientWidth + tolerance) failures.push('horizontal overflow: ' + selector);
        if (surface.scrollHeight > surface.clientHeight + tolerance) failures.push('vertical overflow: ' + selector);
      }
    }
    panels.forEach((panel, index) => { panel.hidden = originalHidden[index]; });
    catalog.scrollLeft = 0;
    const road = required('.build-menu-quick-road .build-tool');
    if (!fits(rectOf(road), rectOf(menu))) failures.push('quick road outside menu');
    seen.add(road.getAttribute('aria-label'));
`;
}
