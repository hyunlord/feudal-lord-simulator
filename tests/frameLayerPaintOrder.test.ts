import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// QA-034: a frame layer is an absolutely placed span before the surface's body, and its 9-slice fills the parchment
// centre (`fill`). A body left in normal flow paints UNDER it: the petition card showed its frame and nothing else on
// every decision (chapters 1-5 and the interlude). The body must be positioned so it paints after the layer.
// The browser check is the ui-geometry audit's content-presence rule (scripts/uiGeometryMeasure.ts); this pins the CSS.
const css = readFileSync(new URL("../src/styles/hudShell.css", import.meta.url), "utf8");
const rule = (selector: string): string => {
  const match = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(css);
  assert.ok(match, `${selector} has a rule in hudShell.css`);
  return match[2]!;
};

test("QA-034: the petition body paints above its frame layer", () => {
  assert.match(rule(".petition-frame"), /position: absolute/);
  assert.match(rule(".petition-body"), /position: (relative|absolute)/);
});

test("QA-034: the season close's body paints above its frame layer", () => {
  assert.match(rule(".season-ledger-frame"), /position: absolute/);
  assert.match(rule(".season-ledger-body"), /position: (relative|absolute)/);
});
