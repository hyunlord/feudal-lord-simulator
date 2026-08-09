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
import {
  MapOverview,
  minimapTileFromClientPoint,
  sampleMinimapTiles,
} from "../src/ui/OverlayControls";
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

test("game speed keeps a fixed frame interval while speed controls substeps", () => {
  assert.equal(speedToIntervalMs(0), null);
  assert.equal(speedToIntervalMs(1), 1_000 / BALANCE.TICKS_PER_SECOND);
  assert.equal(speedToIntervalMs(3), 1_000 / BALANCE.TICKS_PER_SECOND);
  assert.equal(speedToIntervalMs(5), 1_000 / BALANCE.TICKS_PER_SECOND);
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

test("minimap renders a compact rectangular click target without shield ornament or caption", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(MapOverview, {
      grid: DEFAULT_GAME_STATE,
      onJumpToTile: () => undefined,
      viewportRect: { x: 12, y: 18, width: 24, height: 30 },
    }),
  );

  // Then
  assert.match(markup, /class="map-overview"/);
  assert.match(markup, /<button[^>]+type="button"[^>]+aria-label="영지 지형 지도 이동"/);
  assert.match(markup, /<svg[^>]+viewBox="0 0 120 120"/);
  assert.match(markup, /class="map-overview-viewport"/);
  assert.match(markup, /x="12" y="18" width="24" height="30"/);
  assert.doesNotMatch(markup, /shield-caption|map-shield|clipPath|왕실 영지/);
  assert.doesNotMatch(markup, /M48 3 90 17v36/);
});

test("minimap pointer coordinates select the matching world tile", () => {
  // Given
  const grid = {
    width: 64,
    height: 64,
    tiles: [tile(0, 0, "grass")],
  };
  const rect = { left: 10, top: 20, width: 120, height: 120 };

  // When / Then
  assert.deepEqual(
    minimapTileFromClientPoint({ clientX: 70, clientY: 80 }, rect, grid),
    { tx: 32, ty: 32 },
  );
  assert.deepEqual(
    minimapTileFromClientPoint({ clientX: 129, clientY: 139 }, rect, grid),
    { tx: 63, ty: 63 },
  );
});

test("the actual app renders one continuous accessible court console", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(App)),
  );

  // Then
  assert.equal(markup.match(/class="court-console"/g)?.length, 1);
  assert.match(markup, /aria-label="영주 명령대"/);
  assert.equal(markup.match(/class="court-recess /g)?.length, 3);
  assert.match(markup, /class="map-overview"/);
  assert.match(markup, /class="build-seals"/);
  assert.match(markup, /class="build-seal-label" aria-hidden="true">오두막/);
  assert.match(markup, /class="build-seal-label" aria-hidden="true">우물/);
  assert.match(markup, /class="court-ledger"/);
  assert.match(markup, /aria-label="일시 정지"/);
  assert.match(markup, /aria-label="5배속"/);
});

test("reusable console controls create unique referenced DOM and SVG ids", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement("div", null,
      createElement(MapOverview, { grid: DEFAULT_GAME_STATE }),
      createElement(MapOverview, { grid: DEFAULT_GAME_STATE }),
      createElement(BuildSeals, { selectedTool: "house", onSelect: () => undefined }),
      createElement(BuildSeals, { selectedTool: "house", onSelect: () => undefined }),
    ),
  );
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const references = [...markup.matchAll(/(?:aria-describedby|aria-labelledby)="([^"]+)"/g)]
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
    "seal_slot.png",
  ];

  // Then
  for (const asset of assets) assert.match(css, new RegExp(asset));
  assert.doesNotMatch(
    css,
    /#[0-9a-f]{3,8}|\b(?:rgb|hsl)a?\(|(?:linear|radial|conic)-gradient|box-shadow|backdrop-filter|blur\(|system-ui|sans-serif|ui-panel|title-panel/i,
  );

  const consoleRule = css.match(/\.court-console\s*\{([^}]*)\}/)?.[1] ?? "";
  const buildSealsRule = css.match(/\.build-seals\s*\{([^}]*)\}/)?.[1] ?? "";
  const mobileRules = css.match(/@media \(max-width: 600px\) \{([\s\S]+)\}\s*$/)?.[1] ?? "";
  assert.match(consoleRule, /background-color:\s*var\(--palette-parchment\);/);
  assert.match(consoleRule, /background-image:\s*none;/);
  assert.match(consoleRule, /border:\s*1px solid var\(--palette-ink\);/);
  assert.match(buildSealsRule, /--seal-size:\s*64px;/);
  assert.match(buildSealsRule, /display:\s*flex;/);
  assert.match(buildSealsRule, /gap:\s*8px;/);
  assert.match(buildSealsRule, /width:\s*100%;/);
  assert.match(buildSealsRule, /padding:\s*4px;/);
  assert.match(buildSealsRule, /background-color:\s*var\(--palette-parchment\);/);
  assert.match(css, /\.welcome-parchment\s*\{[\s\S]*?left:\s*50%;[\s\S]*?bottom:\s*clamp\(/);
  assert.match(css, /\.welcome-parchment h2\s*\{[\s\S]*?text-align:\s*center;/);
  assert.match(css, /\.welcome-parchment p\s*\{[\s\S]*?word-break:\s*keep-all;/);
  assert.match(css, /\.onboarding-tasks\[data-onboarding-state="ordered"\]\s*\{/);
  assert.match(css, /\.onboarding-task--current\s*\{[\s\S]*?background-color:\s*var\(--palette-parchment\);/);
  assert.doesNotMatch(css, /\.onboarding-task--next/);
  assert.match(css, /\.onboarding-task-flourish\s*\{[\s\S]*?color:\s*var\(--palette-ink\);/);
  assert.match(css, /\.onboarding-tasks\[data-onboarding-state="open-goal"\]\s*\{/);
  assert.match(css, /\.road-tool\s*\{[\s\S]*?border-left:\s*1px solid var\(--palette-ink\);/);
  assert.doesNotMatch(css, /\.build-seal--road\s*\{[\s\S]*?clip-path:/);
  assert.match(css, /\.build-seal--selected::before\s*\{/);
  assert.match(css, /\.build-seal--selected::after\s*\{/);
  assert.match(css, /\.build-seal--highlighted\s*\{[\s\S]*?animation:/);
  assert.equal(
    css.match(/grid-template-columns:\s*140px minmax\(0, 1fr\) 300px;/g)?.length,
    1,
  );
  assert.doesNotMatch(
    css,
    /grid-template-columns:\s*(?:clamp\(122px|108px|54px)/,
  );
  const compactColumns = mobileRules.match(
    /\.court-console\s*\{[\s\S]*?grid-template-columns:\s*(\d+)px\s+minmax\(0,\s*1fr\)\s+96px;/,
  );
  assert.notEqual(compactColumns, null);
  assert.ok(Number(compactColumns?.[1]) > 0);
  assert.match(mobileRules, /\.court-console\s*\{[\s\S]*?grid-template-columns:\s*40px minmax\(0, 1fr\) 96px;/);
  assert.doesNotMatch(mobileRules, /\.court-console\s*\{[\s\S]*?grid-template-columns:\s*0\s+/);
  assert.match(mobileRules, /\.court-console\s*\{[\s\S]*?height:\s*224px;/);
  assert.match(mobileRules, /\.court-recess\s*\{[\s\S]*?height:\s*206px;/);
  assert.match(mobileRules, /\.diagnostic-card-position\s*\{[\s\S]*?bottom:\s*232px;/);
  assert.match(mobileRules, /--seal-size:\s*64px;/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?overflow-x:\s*hidden;/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(mobileRules, /\.build-seals\s*\{[\s\S]*?gap:\s*8px;/);
  assert.match(mobileRules, /\.build-group\s*\{[\s\S]*?display:\s*grid;[\s\S]*?flex:\s*0 1 calc\(100% - 8px\);/);
  assert.match(mobileRules, /\.build-group-seals\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(mobileRules, /\.ledger-recess\s*\{[\s\S]*?justify-content:\s*flex-start;/);
  assert.match(mobileRules, /\.ledger-recess\s*\{[\s\S]*?padding:\s*4px;/);
  assert.match(mobileRules, /\.ledger-stack\s*\{[\s\S]*?align-self:\s*stretch;/);
  assert.match(mobileRules, /\.ledger-stack\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(mobileRules, /\.era-console\s*\{[\s\S]*?max-height:\s*none;/);
  assert.match(mobileRules, /\.era-console\s*\{[\s\S]*?overflow:\s*visible;/);
  assert.match(mobileRules, /\.court-ledger\s*\{[\s\S]*?height:\s*48px;/);
  assert.match(mobileRules, /\.court-ledger dl\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, auto minmax\(0, 1fr\)\);/);
  assert.match(mobileRules, /\.court-ledger dl\s*\{[\s\S]*?font-size:\s*10px;/);
  assert.match(mobileRules, /\.ledger-label--full\s*\{[\s\S]*?display:\s*none;/);
  assert.match(mobileRules, /\.ledger-label--compact\s*\{[\s\S]*?display:\s*block;/);
  assert.match(mobileRules, /\.ledger-row--secondary\s*\{[\s\S]*?display:\s*none;/);
  assert.match(mobileRules, /\.ledger-stack \.overlay-seals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(mobileRules, /\.ledger-stack \.overlay-seal\s*\{[^}]*width:\s*100%;[^}]*overflow:\s*hidden;/);
  assert.match(mobileRules, /\.overlay-label--full\s*\{[\s\S]*?display:\s*none;/);
  assert.match(mobileRules, /\.overlay-label--compact\s*\{[\s\S]*?display:\s*inline;/);
  assert.match(mobileRules, /\.ledger-stack \.overlay-key,[\s\S]*?\.ledger-stack \.overlay-legend\s*\{[\s\S]*?display:\s*none;/);
  assert.match(mobileRules, /\.speed-seals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, clamp\(18px, 3\.5vw, 21px\)\);/);
  assert.match(mobileRules, /\.speed-seals\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.match(mobileRules, /\.settlement-status\s*\{[\s\S]*?right:\s*calc\(33\.333% \+ 4px\);/);
  assert.match(mobileRules, /\.settlement-status\s*\{[\s\S]*?bottom:\s*232px;/);
  assert.match(mobileRules, /\.welcome-parchment\s*\{[\s\S]*?bottom:\s*266px;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation:\s*none;/);
  assert.doesNotMatch(css, /\.court-console::(?:before|after)/);
  assert.doesNotMatch(css, /\.court-recess::(?:before|after)/);
  assert.doesNotMatch(css, /illumination_corner\.png/);
  assert.doesNotMatch(css, /\.court-ledger::(?:before|after)\s*\{/);
  assert.match(css, /\.court-ledger\s*\{[\s\S]*?background-color:\s*var\(--palette-parchment\);[\s\S]*?border:\s*1px solid var\(--palette-ink\);/);
  assert.match(css, /\.court-ledger\s*>\s*\*\s*\{[\s\S]*?z-index:\s*1;/);
  assert.match(css, /\.map-overview\s*\{[\s\S]*?max-width:\s*140px;/);
  assert.match(css, /\.map-overview\s*\{[\s\S]*?border:\s*1px solid var\(--palette-ink\);/);
  assert.doesNotMatch(css, /\.shield-caption|\.map-shield|clip-path/);
});

test("app shell cannot scroll focused console controls out of the viewport", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const appShellRule = css.match(/\.app-shell\s*\{([^}]*)\}/)?.[1] ?? "";

  // Then
  assert.match(appShellRule, /overflow:\s*clip;/);
  assert.doesNotMatch(appShellRule, /overflow:\s*hidden;/);
});

test("ledger recess keeps responsive controls inside the viewport", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const ledgerRecessRule = css.match(/\.ledger-recess\s*\{([^}]*)\}/)?.[1] ?? "";

  // Then
  assert.match(ledgerRecessRule, /grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(ledgerRecessRule, /align-content:\s*start;/);
  assert.doesNotMatch(ledgerRecessRule, /minmax\(210px, 1fr\)/);
});

test("short landscape consoles use the same compact readable ledger and overlay labels", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const shortLandscapeRules = css.match(
    /@media \(max-width: 720px\), \(max-width: 900px\) and \(max-height: 420px\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";

  // Then
  assert.match(shortLandscapeRules, /\.ledger-label--full\s*\{[\s\S]*?display:\s*none;/);
  assert.match(shortLandscapeRules, /\.ledger-label--compact\s*\{[\s\S]*?display:\s*block;/);
  assert.match(shortLandscapeRules, /\.ledger-row--secondary\s*\{[\s\S]*?display:\s*none;/);
  assert.match(shortLandscapeRules, /\.court-ledger > \.ledger-population-toggle\s*\{[\s\S]*?display:\s*none;/);
  assert.match(shortLandscapeRules, /\.ledger-stack \.economy-overlays\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(shortLandscapeRules, /\.ledger-stack \.overlay-heading\s*\{[\s\S]*?display:\s*none;/);
  assert.match(shortLandscapeRules, /\.overlay-label--full\s*\{[\s\S]*?display:\s*none;/);
  assert.match(shortLandscapeRules, /\.overlay-label--compact\s*\{[\s\S]*?display:\s*inline;/);
  assert.match(shortLandscapeRules, /\.ledger-stack \.overlay-key,[\s\S]*?\.ledger-stack \.overlay-legend\s*\{[\s\S]*?display:\s*none;/);
});

test("the browser shell declares a request-free favicon for clean fresh-load QA", async () => {
  // Given / When
  const html = await readFile(INDEX_HTML, "utf8");

  // Then
  assert.match(html, /<link rel="icon" href="data:," \/>/);
});
