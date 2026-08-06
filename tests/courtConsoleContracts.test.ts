import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "../src/App";
import { BALANCE } from "../src/content/balanceConfig";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { PALETTE_CSS_VARIABLES } from "../src/styles/paletteVariables";
import { BuildSeals } from "../src/ui/BuildMenu";
import { MapShield, sampleMinimapTiles } from "../src/ui/OverlayControls";
import { speedToIntervalMs } from "../src/ui/SpeedControls";
import type { Tile } from "../src/world/world.types";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);
const INDEX_HTML = new URL("../index.html", import.meta.url);

function tile(tx: number, ty: number, terrain: Tile["terrain"]): Tile {
  return { tx, ty, terrain, buildingId: null, hasRoad: false };
}

test("palette CSS variables expose every semantic compatibility colour", () => {
  // Given / When
  const variableValues = Object.values(PALETTE_CSS_VARIABLES);

  // Then
  assert.equal(Object.keys(PALETTE_CSS_VARIABLES).length, Object.keys(SEMANTIC_PALETTE).length);
  assert.deepEqual([...variableValues].sort(), [...Object.values(SEMANTIC_PALETTE)].sort());
  assert.equal(Object.keys(PALETTE_CSS_VARIABLES).every((key) => key.startsWith("--palette-")), true);
});

test("game speed multiplies the locked simulation tick rate", () => {
  assert.equal(speedToIntervalMs(0), null);
  assert.equal(speedToIntervalMs(1), 1_000 / BALANCE.TICKS_PER_SECOND);
  assert.equal(speedToIntervalMs(3), 1_000 / (BALANCE.TICKS_PER_SECOND * 3));
  assert.equal(speedToIntervalMs(5), 1_000 / (BALANCE.TICKS_PER_SECOND * 5));
});

test("minimap sampling is bounded deterministic and terrain-derived", () => {
  // Given
  const grid = {
    width: 2,
    height: 2,
    tiles: [
      tile(0, 0, "grass"),
      tile(1, 0, "water"),
      tile(0, 1, "forest"),
      tile(1, 1, "rock"),
    ],
  };

  // When
  const first = sampleMinimapTiles(grid, 2, 2);
  const second = sampleMinimapTiles(grid, 2, 2);

  // Then
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((sample) => sample.terrain), ["grass", "water", "forest", "rock"]);
  assert.equal(sampleMinimapTiles(grid).length <= 12 * 12, true);
});

test("the actual app renders one continuous accessible court console", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(App)),
  );

  // Then
  assert.equal(markup.match(/class="court-console"/g)?.length, 1);
  assert.match(markup, /aria-label="Court console"/);
  assert.equal(markup.match(/class="court-recess /g)?.length, 3);
  assert.match(markup, /class="map-shield"/);
  assert.match(markup, /class="build-seals"/);
  assert.match(markup, /class="court-ledger"/);
  assert.match(markup, /aria-label="Pause"/);
  assert.match(markup, /aria-label="Fivefold speed"/);
});

test("reusable console controls create unique referenced DOM and SVG ids", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement("div", null,
      createElement(MapShield, { grid: DEFAULT_GAME_STATE }),
      createElement(MapShield, { grid: DEFAULT_GAME_STATE }),
      createElement(BuildSeals, { selectedTool: "house", onSelect: () => undefined }),
      createElement(BuildSeals, { selectedTool: "house", onSelect: () => undefined }),
    ),
  );
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const references = [...markup.matchAll(/(?:aria-describedby|aria-labelledby)="([^"]+)"|clip-path="url\(#([^)]+)\)"/g)]
    .map((match) => match[1] ?? match[2]);

  // Then
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(references.every((reference) => ids.includes(reference)), true);
});

test("build seals surface the road and armed styling states for the console layout", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: "road",
      highlightedTools: ["road", "house"],
      onSelect: () => undefined,
    }),
  );

  // Then
  assert.match(
    markup,
    /class="build-seal build-seal--selected build-seal--highlighted build-seal--road"/,
  );
  assert.match(markup, /class="road-tool"/);
});

test("console CSS uses every generated surface and rejects web-dashboard styling", async () => {
  // Given
  const css = await readFile(STYLESHEET, "utf8");
  const assets = [
    "wood_console.png",
    "seal_slot.png",
    "parchment_texture.png",
    "scroll_frame.png",
  ];

  // Then
  for (const asset of assets) assert.match(css, new RegExp(asset));
  assert.doesNotMatch(
    css,
    /#[0-9a-f]{3,8}|\b(?:rgb|hsl)a?\(|(?:linear|radial|conic)-gradient|box-shadow|backdrop-filter|blur\(|system-ui|sans-serif|overflow\s*:\s*(?:auto|scroll)|ui-panel|title-panel/i,
  );

  const consoleRule = css.match(/\.court-console\s*\{([^}]*)\}/)?.[1] ?? "";
  const buildSealsRule = css.match(/\.build-seals\s*\{([^}]*)\}/)?.[1] ?? "";
  const mobileRules = css.match(/@media \(max-width: 600px\) \{([\s\S]+)\}\s*$/)?.[1] ?? "";
  assert.match(consoleRule, /background-size:\s*103% 100%;/);
  assert.match(buildSealsRule, /--seal-size:\s*30px;/);
  assert.match(buildSealsRule, /grid-template-columns:\s*repeat\(4, calc\(var\(--seal-size\) \* 2 \+ 2px\)\);/);
  assert.match(buildSealsRule, /gap:\s*3px 5px;/);
  assert.match(buildSealsRule, /width:\s*max-content;/);
  assert.match(buildSealsRule, /padding:\s*4px 6px;/);
  assert.match(buildSealsRule, /background-color:\s*var\(--palette-ink\);/);
  assert.match(css, /\.welcome-parchment\s*\{[\s\S]*?left:\s*50%;[\s\S]*?bottom:\s*clamp\(/);
  assert.match(css, /\.welcome-parchment h2\s*\{[\s\S]*?text-align:\s*center;/);
  assert.match(css, /\.onboarding-tasks\[data-onboarding-state="ordered"\]\s*\{/);
  assert.match(css, /\.onboarding-task--current\s*\{[\s\S]*?background-color:\s*var\(--palette-parchment\);/);
  assert.match(css, /\.onboarding-task--next\s*\{[\s\S]*?background-color:\s*var\(--palette-vellum\);/);
  assert.match(css, /\.onboarding-task-flourish\s*\{[\s\S]*?color:\s*var\(--palette-gold-dark\);/);
  assert.match(css, /\.onboarding-tasks\[data-onboarding-state="open-goal"\]\s*\{/);
  assert.match(css, /\.road-tool\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/);
  assert.match(css, /\.build-seal--road\s*\{[\s\S]*?clip-path:/);
  assert.match(css, /\.build-seal--selected::before\s*\{/);
  assert.match(css, /\.build-seal--selected::after\s*\{/);
  assert.match(css, /\.build-seal--highlighted\s*\{[\s\S]*?animation:/);
  assert.equal(
    css.match(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/g)?.length,
    1,
  );
  assert.doesNotMatch(
    css,
    /grid-template-columns:\s*(?:clamp\(122px|108px|54px)/,
  );
  assert.match(mobileRules, /\.court-console\s*\{[\s\S]*?height:\s*188px;/);
  assert.match(mobileRules, /--seal-size:\s*clamp\(24px, 5vw, 30px\);/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, calc\(var\(--seal-size\) \* 2 \+ 2px\)\);/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?gap:\s*2px;/);
  assert.match(mobileRules, /\.ledger-recess\s*\{[\s\S]*?padding:\s*6px clamp\(4px, 1\.2vw, 7px\);/);
  assert.match(mobileRules, /\.court-ledger dl\s*\{[\s\S]*?font-size:\s*clamp\(9px, 1\.7vw, 10px\);/);
  assert.match(mobileRules, /\.speed-seals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, clamp\(18px, 3\.5vw, 21px\)\);/);
  assert.match(mobileRules, /\.speed-seals\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.match(mobileRules, /\.settlement-status\s*\{[\s\S]*?right:\s*calc\(33\.333% \+ 4px\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation:\s*none;/);
  assert.doesNotMatch(css, /\.court-console::(?:before|after)/);
  assert.doesNotMatch(css, /\.court-recess::(?:before|after)/);
  assert.doesNotMatch(css, /illumination_corner\.png/);
  assert.match(css, /\.court-ledger::after\s*\{[\s\S]*?background-color:\s*var\(--palette-parchment\);[\s\S]*?opacity:\s*0\.86;/);
  assert.match(css, /\.court-ledger\s*>\s*\*\s*\{[\s\S]*?z-index:\s*1;/);
  assert.match(css, /\.shield-caption\s*\{[\s\S]*?bottom:\s*10px;/);
});

test("app shell cannot scroll focused console controls out of the viewport", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const appShellRule = css.match(/\.app-shell\s*\{([^}]*)\}/)?.[1] ?? "";

  // Then
  assert.match(appShellRule, /overflow:\s*clip;/);
  assert.doesNotMatch(appShellRule, /overflow:\s*hidden;/);
});

test("the browser shell declares a request-free favicon for clean fresh-load QA", async () => {
  // Given / When
  const html = await readFile(INDEX_HTML, "utf8");

  // Then
  assert.match(html, /<link rel="icon" href="data:," \/>/);
});
