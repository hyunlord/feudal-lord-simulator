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

test("numeric ledger text is monospace right-aligned and darker than labels", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const dtRule = selectorRuleBodies(css, ".court-ledger dt");
  const ddRule = selectorRuleBodies(css, ".court-ledger dd");

  // Then
  assert.match(dtRule, /color:\s*var\(--palette-ink-muted\);/);
  assert.match(ddRule, /color:\s*var\(--palette-ink\);/);
  assert.match(ddRule, /font-family:\s*Georgia, "Times New Roman", serif;/);
  assert.match(ddRule, /font-variant-numeric:\s*tabular-nums;/);
  assert.match(ddRule, /text-align:\s*right;/);
});
