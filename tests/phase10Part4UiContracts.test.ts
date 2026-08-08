import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { App } from "../src/App";
import { buildMenuGroups } from "../src/ui/buildMenuModel";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);
const PANEL_SELECTORS = [
  ".court-console",
  ".welcome-parchment",
  ".era-ceremony__banner",
  ".building-inspector",
  ".diagnostic-card",
  ".population-event-panel",
  ".economy-overlays",
  ".settlement-status",
  ".settlement-objective",
  ".onboarding-tasks[data-onboarding-state=\"open-goal\"]",
  ".onboarding-task",
  ".shield-caption",
  ".seal-tooltip",
  ".era-console",
  ".court-ledger",
] as const;

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
  assert.ok(bodies.length > 0, `${selector} has CSS rules`);
  return bodies.join("\n");
}

function mediaBlocks(css: string, query: string): string {
  const marker = `@media (${query}) {`;
  const blocks: string[] = [];
  let searchStart = 0;
  while (searchStart < css.length) {
    const start = css.indexOf(marker, searchStart);
    if (start === -1) break;
    let depth = 0;
    let opened = false;
    for (let index = start; index < css.length; index += 1) {
      const character = css[index];
      if (character === "{") {
        depth += 1;
        opened = true;
      }
      if (character === "}") depth -= 1;
      if (opened && depth === 0) {
        blocks.push(css.slice(start, index + 1));
        searchStart = index + 1;
        break;
      }
    }
  }
  assert.ok(blocks.length > 0, `${query} media block exists`);
  return blocks.join("\n");
}

test("Phase10 panel surfaces use flat parchment rectangles with ink borders", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");

  // When / Then
  for (const selector of PANEL_SELECTORS) {
    const rule = selectorRuleBodies(css, selector);
    assert.match(rule, /background-color:\s*var\(--palette-(?:parchment|vellum)\);/, `${selector} uses a parchment token fill`);
    assert.match(rule, /border:\s*1px solid var\(--palette-ink\);/, `${selector} uses the ink border token`);
    assert.doesNotMatch(rule, /clip-path:/, `${selector} remains rectangular`);
    assert.doesNotMatch(rule, /border-radius:/, `${selector} keeps square corners`);
    assert.doesNotMatch(rule, /background-image:\s*url/, `${selector} has no texture ornament`);
  }
  assert.doesNotMatch(css, /\.court-ledger::(?:before|after)\s*\{[\s\S]*?content:\s*"";/);
});

test("Phase10 critical text wraps or scrolls instead of ellipsizing", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const criticalTextSelectors = [
    ".overlay-label",
    ".overlay-key",
    ".overlay-legend",
    ".settlement-target",
    ".settlement-priority",
    ".settlement-objective .settlement-target",
    ".settlement-complete",
    ".onboarding-task-title",
    ".onboarding-task-hint",
    ".onboarding-task-flourish",
    ".era-requirement dt",
    ".era-requirement dd",
    ".era-tooltip",
    ".era-proposal",
    ".era-draft-status",
    ".era-wall-progress",
    ".era-diagnostic",
    ".era-irrevocable",
    ".era-action-reason",
    ".court-ledger dt",
    ".court-ledger dd",
    ".build-seal-label",
    ".shield-caption",
  ] as const;

  // When / Then
  for (const selector of criticalTextSelectors) {
    const rule = selectorRuleBodies(css, selector);
    assert.doesNotMatch(rule, /text-overflow:\s*ellipsis;/, `${selector} must not truncate text`);
    assert.doesNotMatch(rule, /white-space:\s*nowrap;/, `${selector} must be allowed to wrap`);
  }
});

test("Phase10 build menu exposes readable grouped controls with road separated", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const menuRule = selectorRuleBodies(css, ".build-seals");
  const sealRule = selectorRuleBodies(css, ".build-seal");
  const labelRule = selectorRuleBodies(css, ".build-seal-label");
  const groupRule = selectorRuleBodies(css, ".build-group");
  const groupLabelRule = selectorRuleBodies(css, ".build-group-label");
  const mobileRule = selectorRuleBodies(mediaBlocks(css, "max-width: 420px"), ".build-seals");
  const markup = renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));
  const groups = buildMenuGroups(DEFAULT_GAME_STATE);

  // When / Then
  assert.match(menuRule, /--seal-size:\s*56px;/);
  assert.match(menuRule, /overflow-x:\s*auto;/);
  assert.match(sealRule, /min-width:\s*56px;/);
  assert.match(sealRule, /min-height:\s*56px;/);
  assert.match(labelRule, /font-size:\s*11px;/);
  assert.match(groupRule, /gap:\s*(?:6|8|10|12)px;/);
  assert.doesNotMatch(groupLabelRule, /display:\s*none;/);
  assert.match(mobileRule, /--seal-size:\s*56px;/);
  assert.match(mobileRule, /flex-wrap:\s*wrap;/);
  assert.match(mobileRule, /overflow-x:\s*hidden;/);
  assert.match(mobileRule, /overflow-y:\s*auto;/);
  assert.match(markup, /class="road-tool"/);
  for (const group of groups) {
    assert.match(markup, new RegExp(`<span class="build-group-label">${group.label}</span>`));
  }
});
