import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// NAT-2 (QA-013): an open panel slot (the goal log above all) no longer covers the crisis icons and the event chips —
// they step left of it by the panel's own width. The browser check (scripts/slotChipOverlapCheck.ts) measures the boxes;
// this keeps the widths in step: every mode that fills the slot marks the shell, and each clearance uses its panel's width.
const app = readFileSync("src/App.tsx", "utf8");
const css = readFileSync("src/styles/hudShell.css", "utf8");
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no rule ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("NAT-2 QA-013: every mode with a panel in the slot marks the shell", () => {
  // Given
  const mark = app.slice(app.indexOf("data-slot={"), app.indexOf("\n", app.indexOf("data-slot={")));

  // Then
  for (const mode of ["goals", "population", "selection", "ledger"]) assert.ok(mark.includes(`ui.mode === "${mode}"`), `${mode} is not marked`);
});

test("NAT-2 QA-013: the chip column clears each panel by its own width", () => {
  // Given
  const slotWidth = rule(".app-shell .slot-panel").match(/width: (min\([^;]+\));/)?.[1];
  const ledgerWidth = rule(".app-shell .ledger-drawer").match(/width: (min\([^;]+\));/)?.[1];

  // Then
  assert.equal(slotWidth, "min(340px, calc(100% - 16px))");
  assert.equal(ledgerWidth, "min(var(--box-w-wide), calc(100% - 16px))");
  assert.match(rule(".app-shell [data-slot]"), /--slot-clear: calc\(min\(340px, 100% - 16px\) \+ 8px\)/);
  assert.match(rule(`.app-shell [data-slot="ledger"]`), /--slot-clear: calc\(min\(var\(--box-w-wide\), 100% - 16px\) \+ 8px\)/);
  assert.match(rule(".app-shell [data-slot] :is(.crisis-icons, .event-cards)"), /right: calc\(8px \+ var\(--slot-clear\)\)/);
});
