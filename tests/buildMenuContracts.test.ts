import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { App } from "../src/App";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { GameProvider } from "../src/state/gameStore";
import { BuildSeals } from "../src/ui/BuildMenu";
import {
  buildMenuGroups,
  buildToolTooltipLines,
  BUILD_TOOL_OPTIONS,
} from "../src/ui/buildMenuModel";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

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

function cssPx(rule: string, property: string): number {
  const escapedProperty = property.replaceAll("-", "\\-");
  const match = rule.match(new RegExp(`${escapedProperty}:\\s*(\\d+)px;`));
  if (match === null) assert.fail(`${property} px declaration exists`);
  const value = match[1];
  assert.notEqual(value, undefined, `${property} value exists`);
  return Number(value);
}

function cssVarPx(rule: string, name: string): number {
  const escapedName = name.replaceAll("-", "\\-");
  const match = rule.match(new RegExp(`${escapedName}:\\s*(\\d+)px;`));
  if (match === null) assert.fail(`${name} px variable exists`);
  const value = match[1];
  assert.notEqual(value, undefined, `${name} value exists`);
  return Number(value);
}

function cssNumber(rule: string, property: string): number {
  const escapedProperty = property.replaceAll("-", "\\-");
  const match = rule.match(new RegExp(`${escapedProperty}:\\s*([\\d.]+);`));
  if (match === null) assert.fail(`${property} numeric declaration exists`);
  const value = match[1];
  assert.notEqual(value, undefined, `${property} value exists`);
  return Number(value);
}

function cssMaxWidthPx(rule: string): number {
  const match = rule.match(/max-width:\s*(\d+)px;/);
  if (match === null) assert.fail("max-width px declaration exists");
  const value = match[1];
  assert.notEqual(value, undefined, "max-width value exists");
  return Number(value);
}

function cssGapAtViewportPx(rule: string, viewportWidth: number): number {
  const match = rule.match(/gap:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\);/);
  if (match === null) return cssPx(rule, "gap");
  const min = Number(match[1]);
  const viewport = Number(match[2]) * viewportWidth / 100;
  const max = Number(match[3]);
  return Math.min(max, Math.max(min, viewport));
}

function cssInlinePaddingAtViewportPx(rule: string, viewportWidth: number): number {
  const match = rule.match(/padding:\s*\d+px\s+clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\);/);
  if (match === null) return cssPx(rule, "padding") * 2;
  const min = Number(match[1]);
  const viewport = Number(match[2]) * viewportWidth / 100;
  const max = Number(match[3]);
  return Math.min(max, Math.max(min, viewport)) * 2;
}

function consoleBuildTrackWidthPx(rule: string, viewportWidth: number): number {
  const template = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1];
  if (template === undefined) assert.fail("console grid template exists");
  const gap = cssGapAtViewportPx(rule, viewportWidth);
  const inlinePadding = cssInlinePaddingAtViewportPx(rule, viewportWidth);
  const contentWidth = viewportWidth - inlinePadding - gap * 2;
  if (template === "repeat(3, minmax(0, 1fr))") return contentWidth / 3;

  const fixedTracks = [...template.matchAll(/(?:^|\s)(\d+)px(?:\s|$)/g)].map((match) => {
    const value = match[1];
    assert.notEqual(value, undefined, "fixed track value exists");
    return Number(value);
  });
  const minmaxTracks = [...template.matchAll(/minmax\((\d+)px,\s*(\d+)px\)/g)].map((match) => {
    const value = match[2];
    assert.notEqual(value, undefined, "minmax track value exists");
    return Number(value);
  });
  const sideTracks = fixedTracks.length > 0 ? fixedTracks : minmaxTracks;
  assert.equal(sideTracks.length, 2, "console grid declares fixed minimap and ledger side tracks");
  const minimapTrack = sideTracks[0];
  const ledgerTrack = sideTracks[1];
  if (minimapTrack === undefined || ledgerTrack === undefined) assert.fail("console side tracks exist");
  return contentWidth - minimapTrack - ledgerTrack;
}

function labelsFromMarkup(markup: string): readonly string[] {
  return [...markup.matchAll(/<span class="build-seal-label" aria-hidden="true">([^<]+)<\/span>/g)]
    .map((match) => match[1])
    .filter((label): label is string => label !== undefined);
}

function groupLabelsFromMarkup(markup: string): readonly string[] {
  return [...markup.matchAll(/<span class="build-group-label">([^<]+)<\/span>/g)]
    .map((match) => match[1])
    .filter((label): label is string => label !== undefined);
}

function conservativeLabelWidthBudgetPx(label: string, fontSize: number): number {
  return [...label].reduce((width, character) => {
    if (/\p{Script=Hangul}/u.test(character)) return width + fontSize;
    if (/[0-9]/.test(character)) return width + fontSize * 0.58;
    if (/[A-Za-z]/.test(character)) return width + fontSize * 0.62;
    return width + fontSize * 0.5;
  }, 0);
}

function stoneTownState() {
  return {
    ...DEFAULT_GAME_STATE,
    era: "stone_town" as const,
    treasuryTimber: 500,
    buildings: [
      ...DEFAULT_GAME_STATE.buildings,
      {
        id: "stone-store",
        kind: "storehouse" as const,
        tx: 0,
        ty: 0,
        workers: 0,
        inventory: { stone: 500, stone_raw: 500 },
        reserved: {},
        stockReserved: {},
        productionProgress: 0,
      },
    ],
  };
}

function buildGroupCellWidthsPx(input: {
  readonly state: GameState;
  readonly sealSize: number;
  readonly groupGap: number;
  readonly groupLabelFontSize: number;
  readonly markup: string;
}): readonly number[] {
  const widths = buildMenuGroups(input.state).map((group) => {
    const labelWidth = conservativeLabelWidthBudgetPx(group.label, input.groupLabelFontSize);
    const sealsWidth = group.options.length * input.sealSize + Math.max(0, group.options.length - 1) * input.groupGap;
    return Math.max(labelWidth, sealsWidth);
  });
  assert.equal(widths.length, groupLabelsFromMarkup(input.markup).length);
  return widths;
}

function rowWidthPx(widths: readonly number[], gap: number): number {
  return widths.reduce((total, width, index) => total + width + (index === 0 ? 0 : gap), 0);
}

function stoneTownRowsHeightPx(input: {
  readonly sealSize: number;
  readonly buildMenuGap: number;
  readonly groupGap: number;
  readonly groupLabelFontSize: number;
}): number {
  const headerHeight = input.groupLabelFontSize;
  return input.sealSize * 2 + headerHeight * 2 + input.groupGap * 2 + input.buildMenuGap;
}

test("build menu exposes all building tools plus road in reachable order", () => {
  // Given
  const buildingKinds = BUILDING_CONFIG.map((definition) => definition.kind);

  // When
  const tools = BUILD_TOOL_OPTIONS.map((option) => option.tool);

  // Then
  assert.deepEqual(tools, [...buildingKinds, "road"]);
});

test("build menu options provide accessible labels for every selectable tool", () => {
  // Given / When
  const labels = BUILD_TOOL_OPTIONS.map((option) => option.label.trim());

  // Then
  assert.equal(labels.length, BUILDING_CONFIG.length + 1);
  assert.equal(labels.every((label) => label.length > 0), true);
});

test("the real app renders every placement tool as an accessible control", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(App)),
  );

  // Then
  const defaultTools = buildMenuGroups(DEFAULT_GAME_STATE).flatMap((group) => group.options);
  for (const option of [...defaultTools, BUILD_TOOL_OPTIONS.find((candidate) => candidate.tool === "road")]) {
    assert.ok(option);
    assert.match(markup, new RegExp(`aria-label="${option.label}"`));
  }
  assert.doesNotMatch(markup, /aria-label="채석장"/);
  assert.doesNotMatch(markup, /aria-label="석공소"/);
  const placementMarkup = markup.slice(
    markup.indexOf('aria-label="건설 도장"'),
    markup.indexOf("ledger-recess"),
  );
  assert.doesNotMatch(placementMarkup, /aria-pressed="true"/);
});

test("build menu groups buildings while road stays in a dedicated zero-cost control", () => {
  // Given
  const poorState = { ...DEFAULT_GAME_STATE, treasuryTimber: 5 };

  // When
  const groups = buildMenuGroups(poorState);
  const loggingTooltip = buildToolTooltipLines("logging_camp", poorState);
  const appMarkup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(App)),
  );

  // Then
  assert.deepEqual(groups.map((group) => group.label), ["주거", "생산", "저장", "서비스"]);
  assert.deepEqual(
    groups.map((group) => group.options.map((option) => option.tool)),
    [["house"], ["wheat_farm", "mill", "logging_camp", "sawmill"], ["storehouse", "granary"], ["well", "chapel"]],
  );
  assert.match(appMarkup, /class="road-tool"/);
  assert.match(appMarkup, /aria-label="길"/);
  assert.match(appMarkup, /aria-pressed="false"/);
  assert.match(appMarkup, /비용 목재 0/);
  assert.ok(loggingTooltip.some((line) => line.includes("벌목소")));
  assert.ok(loggingTooltip.some((line) => line.includes("목재 15")));
  assert.ok(loggingTooltip.some((line) => line.includes("목적")));
  assert.ok(loggingTooltip.some((line) => line.includes("길")));
  assert.ok(loggingTooltip.some((line) => line.includes("숲")));
  assert.ok(loggingTooltip.some((line) => line.includes("부족 10")));
  assert.match(appMarkup, /class="build-group"/);
});

test("stone town build menu includes civic buildings and reports multi-resource costs", () => {
  // Given
  const state = {
    ...DEFAULT_GAME_STATE,
    era: "stone_town" as const,
    treasuryTimber: 90,
    buildings: [
      {
        id: "stone-store",
        kind: "storehouse" as const,
        tx: 0,
        ty: 0,
        workers: 0,
        inventory: { stone: 40 },
        reserved: {},
        stockReserved: {},
        productionProgress: 0,
      },
    ],
  };

  // When
  const tools = buildMenuGroups(state).flatMap((group) => group.options.map((option) => option.tool));
  const churchTooltip = buildToolTooltipLines("church", state);
  const keepTooltip = buildToolTooltipLines("keep", state);

  // Then
  assert.ok(tools.includes("church"));
  assert.ok(tools.includes("keep"));
  assert.ok(churchTooltip.includes("비용 목재 100 · 석재 60"));
  assert.ok(churchTooltip.includes("건설 불가 · 부족 목재 10 · 석재 20"));
  assert.ok(keepTooltip.includes("비용 석재 150"));
  assert.ok(keepTooltip.includes("건설 불가 · 부족 석재 110"));
});

test("task-driven highlights are semantic attributes and keep unaffordable seals focusable", () => {
  // Given
  const poorState = { ...DEFAULT_GAME_STATE, treasuryTimber: 0 };

  // When
  const markup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: poorState,
      highlightedTools: ["house", "logging_camp", "road"],
      onSelect: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /data-highlighted="house"/);
  assert.match(markup, /data-highlighted="logging_camp"/);
  assert.match(markup, /data-highlighted="road"/);
  assert.match(markup, /aria-disabled="true"/);
  assert.doesNotMatch(markup, /disabled=""/);
});

test("Given every build label When preflighted against the seal geometry Then labels keep twelve-pixel text and four-pixel clearance", async () => {
  // Given
  const stylesheet = await readFile(STYLESHEET, "utf8");
  const buildSealsRule = cssRule(stylesheet, ".build-seals");
  const buildButtonRule = cssRule(stylesheet, ".build-seal,\n.speed-seal");
  const buildLabelRule = cssRule(stylesheet, ".build-seal-label");
  const defaultMarkup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: DEFAULT_GAME_STATE,
      onSelect: () => undefined,
    }),
  );
  const stoneMarkup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: stoneTownState(),
      onSelect: () => undefined,
    }),
  );

  // When
  const sealSize = cssVarPx(buildSealsRule, "--seal-size");
  const sealPadding = cssPx(buildButtonRule, "padding");
  const labelFontSize = cssPx(buildLabelRule, "font-size");
  const labelLineHeight = cssNumber(buildLabelRule, "line-height");
  const labelHeight = labelFontSize * labelLineHeight;
  const labelInlineBudget = sealSize - sealPadding * 2 - 8;
  const labelBlockBudget = sealSize - sealPadding * 2 - 4;
  const labels = [...new Set([...labelsFromMarkup(defaultMarkup), ...labelsFromMarkup(stoneMarkup)])];

  // Then
  assert.equal(labels.length, BUILD_TOOL_OPTIONS.length);
  assert.ok(labelFontSize >= 12, "seal labels declare at least 12 CSS pixels");
  assert.ok(labelHeight <= labelBlockBudget, "label line keeps four CSS pixels from seal block edges");
  for (const label of labels) {
    assert.ok(
      conservativeLabelWidthBudgetPx(label, labelFontSize) <= labelInlineBudget,
      `${label} fits within seal label width with four CSS pixels of inline clearance`,
    );
  }
  assert.match(buildSealsRule, /flex-wrap:\s*wrap;/);
  assert.match(buildSealsRule, /overflow-x:\s*hidden;/);
  assert.doesNotMatch(buildLabelRule, /overflow:\s*hidden|text-overflow|ellipsis|white-space:\s*nowrap/);
});

test("Given a 1280px console When rendered build text is measured against Part7 cells Then the minimap is capped and full labels fit", async () => {
  // Given
  const viewportWidth = 1280;
  const stylesheet = await readFile(STYLESHEET, "utf8");
  const consoleRule = cssRule(stylesheet, ".court-console");
  const mapRule = cssRule(stylesheet, ".map-overview");
  const buildSealsRule = cssRule(stylesheet, ".build-seals");
  const groupSealsRule = cssRule(stylesheet, ".build-group-seals");
  const buildButtonRule = cssRule(stylesheet, ".build-seal,\n.speed-seal");
  const buildLabelRule = cssRule(stylesheet, ".build-seal-label");
  const groupLabelRule = cssRule(stylesheet, ".build-group-label");
  const defaultMarkup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: DEFAULT_GAME_STATE,
      onSelect: () => undefined,
    }),
  );
  const stoneState = stoneTownState();
  const markup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: stoneState,
      onSelect: () => undefined,
    }),
  );

  // When
  const sealSize = cssVarPx(buildSealsRule, "--seal-size");
  const buildMenuTrackWidth = consoleBuildTrackWidthPx(consoleRule, viewportWidth);
  const buildMenuInnerWidth = buildMenuTrackWidth - cssPx(buildSealsRule, "padding") * 2 - 2;
  const groupGap = cssPx(groupSealsRule, "gap");
  const buildMenuGap = cssPx(buildSealsRule, "gap");
  const groupLabelFontSize = cssPx(groupLabelRule, "font-size");
  const sealPadding = cssPx(buildButtonRule, "padding");
  const sealLabelFontSize = cssPx(buildLabelRule, "font-size");
  const sealLabelInlineBudget = sealSize - sealPadding * 2 - 8;
  const defaultGroupCellWidths = buildGroupCellWidthsPx({
    state: DEFAULT_GAME_STATE,
    sealSize,
    groupGap,
    groupLabelFontSize,
    markup: defaultMarkup,
  });
  const groupCellWidths = buildGroupCellWidthsPx({
    state: stoneState,
    sealSize,
    groupGap,
    groupLabelFontSize,
    markup,
  });
  const roadCellWidth = sealSize + 10 + 1;
  const defaultOneRowWidth = rowWidthPx([...defaultGroupCellWidths, roadCellWidth], buildMenuGap);
  const twoRowWidth = Math.max(
    groupCellWidths[1] ?? 0,
    (groupCellWidths[0] ?? 0) + buildMenuGap + (groupCellWidths[2] ?? 0) + buildMenuGap + (groupCellWidths[3] ?? 0) + buildMenuGap + roadCellWidth,
  );
  const renderedLabels = labelsFromMarkup(markup);
  const renderedGroupLabels = groupLabelsFromMarkup(markup);

  // Then
  assert.ok(cssMaxWidthPx(mapRule) <= 140, "minimap CSS caps the overview at 140px");
  assert.ok(buildMenuInnerWidth >= defaultOneRowWidth, "1280px console keeps the default build menu on one complete row");
  assert.ok(buildMenuInnerWidth >= twoRowWidth, "1280px console permits at most two complete build-menu rows");
  assert.equal(renderedLabels.length, BUILD_TOOL_OPTIONS.length);
  assert.equal(renderedGroupLabels.length, buildMenuGroups(stoneState).length);
  for (const label of renderedLabels) {
    assert.ok(
      conservativeLabelWidthBudgetPx(label, sealLabelFontSize) <= sealLabelInlineBudget,
      `${label} rendered label width fits the seal cell`,
    );
  }
  for (const group of buildMenuGroups(stoneState)) {
    const width = conservativeLabelWidthBudgetPx(group.label, groupLabelFontSize);
    const cellWidth = groupCellWidths.find((candidate) => candidate >= width) ?? 0;
    assert.ok(width <= cellWidth, `${group.label} rendered header width fits its group cell`);
  }
});

test("Given the 1280px stone-town menu When two rows render Then the rows fit inside the seal recess without vertical scroll", async () => {
  // Given
  const stylesheet = await readFile(STYLESHEET, "utf8");
  const courtRecessRule = cssRule(stylesheet, ".court-recess");
  const buildSealsRule = cssRule(stylesheet, ".build-seals");
  const groupSealsRule = cssRule(stylesheet, ".build-group-seals");
  const groupLabelRule = cssRule(stylesheet, ".build-group-label");

  // When
  const sealSize = cssVarPx(buildSealsRule, "--seal-size");
  const buildMenuBlockPadding = cssPx(buildSealsRule, "padding") * 2;
  const buildMenuBorder = 2;
  const requiredHeight = stoneTownRowsHeightPx({
    sealSize,
    buildMenuGap: cssPx(buildSealsRule, "gap"),
    groupGap: cssPx(groupSealsRule, "gap"),
    groupLabelFontSize: cssPx(groupLabelRule, "font-size"),
  }) + buildMenuBlockPadding + buildMenuBorder;
  const availableHeight = cssPx(courtRecessRule, "height");

  // Then
  assert.ok(
    availableHeight >= requiredHeight,
    `stone-town two-row build menu needs ${requiredHeight}px but seal recess offers ${availableHeight}px`,
  );
  assert.match(buildSealsRule, /overflow-y:\s*auto;/);
});
