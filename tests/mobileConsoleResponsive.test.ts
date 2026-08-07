import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

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

test("Given 375px console CSS When compact overrides apply Then build seals remain 48px horizontal scroll controls", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const compactRules = mediaBlocks(css, "max-width: 420px");
  const buildSealsRule = cssRule(compactRules, ".build-seals");
  const buildSealRule = cssRule(compactRules, ".build-seal");

  // When / Then
  assert.match(buildSealsRule, /--seal-size:\s*48px;/);
  assert.match(buildSealsRule, /display:\s*flex;/);
  assert.match(buildSealsRule, /flex-wrap:\s*nowrap;/);
  assert.match(buildSealsRule, /overflow-x:\s*auto;/);
  assert.match(buildSealsRule, /overflow-y:\s*hidden;/);
  assert.match(buildSealsRule, /justify-content:\s*flex-start;/);
  assert.doesNotMatch(buildSealsRule, /grid-template-columns:/);
  assert.doesNotMatch(buildSealsRule, /overflow:\s*hidden;/);
  assert.match(buildSealRule, /min-width:\s*48px;/);
  assert.match(buildSealRule, /min-height:\s*48px;/);
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
