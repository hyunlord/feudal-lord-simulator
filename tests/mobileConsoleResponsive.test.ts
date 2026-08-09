import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

function mediaBlocks(css: string, query: string): string {
  const condition = query.startsWith("(") ? query : `(${query})`;
  const marker = `@media ${condition} {`;
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

function cssRule(block: string, selector: string): string {
  const start = block.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule exists`);

  let depth = 0;
  let opened = false;
  for (let index = start; index < block.length; index += 1) {
    const character = block[index];
    if (character === "{") {
      depth += 1;
      opened = true;
    }
    if (character === "}") depth -= 1;
    if (opened && depth === 0) return block.slice(start, index + 1);
  }

  assert.fail(`${selector} rule closes`);
}

function pxDeclaration(rule: string, property: string): number {
  const match = rule.match(new RegExp(`${property}:\\s*(\\d+)px;`));
  assert.notEqual(match, null, `${property} px declaration exists`);
  return Number(match?.[1]);
}

test("Given 375px console CSS When compact overrides apply Then build seals use the four-column design matrix", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const compactRules = mediaBlocks(css, "max-width: 600px");
  const buildSealsRule = cssRule(compactRules, ".build-seals");
  const buildSealRule = cssRule(compactRules, ".build-seal");

  // When / Then
  assert.match(buildSealsRule, /--seal-size:\s*46px;/);
  assert.match(buildSealsRule, /display:\s*grid;/);
  assert.match(buildSealsRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(buildSealsRule, /grid-auto-rows:\s*46px;/);
  assert.match(buildSealsRule, /align-content:\s*flex-start;/);
  assert.match(buildSealsRule, /overflow-x:\s*hidden;/);
  assert.match(buildSealsRule, /overflow-y:\s*hidden;/);
  assert.match(buildSealsRule, /justify-content:\s*flex-start;/);
  assert.match(buildSealRule, /min-width:\s*0;/);
  assert.match(buildSealRule, /min-height:\s*0;/);
  assert.match(cssRule(compactRules, ".build-seal-label"), /max-width:\s*100%;/);
  assert.match(cssRule(compactRules, ".build-group-label"), /display:\s*none;/);
});

test("Given tablet console CSS When build controls wrap Then groups and road controls can shrink inside the recess", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const tabletRules = mediaBlocks(css, "max-width: 900px");
  const buildSealsRule = cssRule(tabletRules, ".build-seals");
  const buildGroupRule = cssRule(tabletRules, ".build-group,\n  .road-tool");
  const groupSealsRule = cssRule(tabletRules, ".build-group-seals");
  const sealRecessRule = cssRule(tabletRules, ".seal-recess");

  // When / Then
  assert.match(sealRecessRule, /align-items:\s*stretch;/);
  assert.match(buildSealsRule, /height:\s*100%;/);
  assert.match(buildSealsRule, /display:\s*grid;/);
  assert.match(buildSealsRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(buildSealsRule, /justify-items:\s*center;/);
  assert.match(buildSealsRule, /overflow-x:\s*hidden;/);
  assert.match(buildSealsRule, /overflow-y:\s*hidden;/);
  assert.match(buildGroupRule, /display:\s*contents;/);
  assert.match(groupSealsRule, /display:\s*contents;/);
  assert.match(cssRule(tabletRules, ".build-group-label"), /display:\s*none;/);
  assert.match(cssRule(tabletRules, ".build-seal,\n  .build-seal--road"), /width:\s*min\(var\(--seal-size\),\s*100%\);/);
});

test("Given max420 CSS When compact overrides apply Then no duplicate build-menu matrix rules are reintroduced", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const narrowRules = mediaBlocks(css, "max-width: 420px");

  // When / Then
  assert.doesNotMatch(narrowRules, /\.build-seals\s*\{/);
  assert.doesNotMatch(narrowRules, /\.build-seal(?:--road)?\s*\{/);
  assert.doesNotMatch(narrowRules, /\.build-group-label\s*\{/);
});

test("Given 375px portrait CSS When compact overrides apply Then settlement status clears the court console by eight pixels", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const compactRules = mediaBlocks(css, "max-width: 420px");
  const consoleRule = cssRule(mediaBlocks(css, "max-width: 600px"), ".court-console");
  const statusRule = cssRule(compactRules, ".settlement-status");

  // When
  const consoleHeight = pxDeclaration(consoleRule, "height");
  const statusBottom = pxDeclaration(statusRule, "bottom");

  // Then
  assert.equal(consoleHeight, 224);
  assert.ok(statusBottom >= consoleHeight + 8);
});

test("Given 640px low-height landscape CSS When responsive overrides apply Then rails do not overlap the court console", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const landscapeRules = mediaBlocks(css, "(max-width: 900px) and (max-height: 420px)");
  const consoleRule = cssRule(mediaBlocks(css, "max-width: 900px"), ".court-console");
  const statusRule = cssRule(landscapeRules, ".settlement-status");
  const railRule = cssRule(landscapeRules, ".right-info-rail");

  // When
  const consoleHeight = pxDeclaration(consoleRule, "height");
  const statusBottom = pxDeclaration(statusRule, "bottom");

  // Then
  assert.equal(consoleHeight, 276);
  assert.ok(statusBottom >= consoleHeight + 8);
  assert.match(railRule, /display:\s*none;/);
});

test("Given mobile era rail CSS When content wraps Then the top console does not self-clip actions or guidance text", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const mobileRules = mediaBlocks(css, "max-width: 600px");
  const eraConsoleRule = cssRule(mobileRules, ".era-console");
  const eraActionsRule = cssRule(mobileRules, ".era-actions");
  const eraActionRule = cssRule(mobileRules, ".era-action");

  // When / Then
  assert.match(eraConsoleRule, /max-height:\s*none;/);
  assert.match(eraConsoleRule, /overflow:\s*visible;/);
  assert.match(eraActionsRule, /flex-wrap:\s*wrap;/);
  assert.match(eraActionRule, /min-height:\s*24px;/);
});
