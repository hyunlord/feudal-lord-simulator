import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

function selectorRuleBodies(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorSource = match[1];
    const body = match[2];
    if (selectorSource === undefined || body === undefined) continue;
    const selectorGroup = selectorSource.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const selectors = selectorGroup.split(",").map((item) => item.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  return bodies.join("\n");
}

test("release contrast gate exists and reports audited selector ratios", () => {
  // Given / When
  const result = spawnSync("npx", ["tsx", "scripts/checkContrast.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });

  // Then
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /selector\s+foreground\s+background\s+size\s+ratio\s+floor/);
  assert.match(result.stdout, /\.court-ledger dd\s+--palette-ink\s+--palette-parchment\s+13px\s+/);
});

test("text-bearing CSS zones use flat audited backgrounds", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const forbiddenRepeatedTextSurfaces = [
    ".welcome-parchment",
    ".population-event-panel",
    ".court-ledger",
    ".economy-overlays",
    ".onboarding-task",
    ".seal-tooltip",
  ];

  // When
  const repeated = forbiddenRepeatedTextSurfaces.filter((selector) => {
    const rule = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    return /background-image:\s*url\("\/assets\/ui\/parchment_texture\.png"\)/.test(rule)
      || /background-repeat:\s*repeat;/.test(rule);
  });

  // Then
  assert.deepEqual(repeated, []);
});

test("numeric ledger and era gauges use monospace right-aligned darker digits", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const ledgerLabelRule = selectorRuleBodies(css, ".court-ledger dt");
  const ledgerNumericRule = selectorRuleBodies(css, ".court-ledger dd");
  const eraNumericRule = selectorRuleBodies(css, ".era-requirement dd");
  const monospaceStack = /font-family:\s*ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;/;

  // Then
  assert.match(ledgerLabelRule, /color:\s*var\(--palette-ink-muted\);/);
  for (const numericRule of [ledgerNumericRule, eraNumericRule]) {
    assert.match(numericRule, /color:\s*var\(--palette-ink\);/);
    assert.match(numericRule, monospaceStack);
    assert.match(numericRule, /font-variant-numeric:\s*tabular-nums;/);
    assert.match(numericRule, /text-align:\s*right;/);
  }
});
