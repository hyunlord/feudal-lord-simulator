import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { App } from "../src/App";
import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { BuildSeals } from "../src/ui/BuildMenu";
import { buildMenuGroups, buildToolTooltipLines, BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";
import { BUILD_CATEGORIES, buildCategory, buildCostLabel, buildThumbnail } from "../src/ui/buildMenuPresentation";

test("build menu exposes all building tools plus road in reachable order", () => {
  // Given
  // AF-12: every live kind; the retired wheat farm has no tool.
  const buildingKinds = BUILDING_CONFIG.map((definition) => definition.kind).filter(kind => kind !== "wheat_farm");

  // When
  const tools = BUILD_TOOL_OPTIONS.map((option) => option.tool);

  // Then
  assert.deepEqual(tools, [...buildingKinds, "road"]);
});

test("Given an unaffordable card When menu renders Then shortfall shows owned stock and cost", () => {
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    state: { ...DEFAULT_GAME_STATE, treasuryTimber: 0 }, selectedTool: null, onSelect: () => undefined,
  }));
  assert.match(markup, /목재 부족 0\/15/);
  assert.match(markup, /선택 도구 없음/);
});

test("defense offers manual palisade drawing with a visible prerequisite reason", () => {
  const locked = renderToStaticMarkup(createElement(BuildSeals, {
    state: DEFAULT_GAME_STATE, selectedTool: null, onSelect: () => undefined,
    onStartPalisadeDrawing: () => undefined,
  }));
  assert.match(locked, /aria-label="목책 긋기"[^>]*aria-disabled="true"/);
  assert.match(locked, /목책 긋기[\s\S]*인구 12\/60/);
  const ready = renderToStaticMarkup(createElement(BuildSeals, {
    state: { ...DEFAULT_GAME_STATE, era: 'hamlet', population: 60, treasuryTimber: 250,
      buildings: [
        { id: 'granary', kind: 'granary', tx: 1, ty: 1, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
        { id: 'chapel', kind: 'chapel', tx: 4, ty: 4, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
      ] },
    selectedTool: null, onSelect: () => undefined, onStartPalisadeDrawing: () => undefined,
  }));
  assert.match(ready, /aria-label="목책 긋기"[^>]*aria-disabled="false"/);
});

test("build menu options provide accessible labels for every selectable tool", () => {
  // Given / When
  const labels = BUILD_TOOL_OPTIONS.map((option) => option.label.trim());

  // Then
  assert.equal(labels.length, BUILDING_CONFIG.length - 1 + 1, "live kinds (all but the retired wheat farm) plus road");
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
  // UX-1: tools the settlement stage has not opened stay visible, locked, with the stage that opens them.
  assert.match(markup, /class="build-seal build-tool build-tool--locked"[^>]*aria-label="채석장"[^>]*aria-disabled="true"/);
  assert.match(markup, /aria-label="석공소"[\s\S]*?data-icon="lock.locked"[^>]*><\/span> 시장도시 이후/);
  assert.doesNotMatch(markup, /build-tool--selected/);
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
    [["house"], ["farmstead", "mill", "logging_camp", "sawmill"], ["storehouse", "granary"], ["well", "chapel"]],
  );
  assert.match(appMarkup, /class="build-menu-quick-road"/);
  assert.match(appMarkup, /aria-label="길"/);
  assert.match(appMarkup, /aria-pressed="false"/);
  assert.match(appMarkup, /무료/);
  assert.ok(loggingTooltip.some((line) => line.includes("벌목소")));
  assert.ok(loggingTooltip.some((line) => line.includes("목재 15")));
  assert.ok(loggingTooltip.some((line) => line.includes("목적")));
  assert.ok(loggingTooltip.some((line) => line.includes("길")));
  assert.ok(loggingTooltip.some((line) => line.includes("숲")));
  assert.ok(loggingTooltip.some((line) => line.includes("부족 10")));
  assert.match(appMarkup, /aria-label="건설 분류"/);
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

test("category presentation covers every existing tool and preserves the canonical unlock filter", () => {
  // UX-1 regrouping: zones left the categories for the 직접 / 구역 / 방향 layer switch.
  assert.deepEqual(BUILD_CATEGORIES.map((category) => category.label), ["생활", "길", "생업", "저장·유통", "공공·신앙", "방어"]);
  assert.equal(buildCategory("keep"), "defense");
  assert.equal(buildCategory("church"), "public");
  const opening = buildMenuGroups(DEFAULT_GAME_STATE).flatMap((group) => group.options);
  assert.equal(opening.some((option) => buildCategory(option.tool) === "defense"), false);
  for (const option of BUILD_TOOL_OPTIONS) {
    assert.ok(BUILD_CATEGORIES.some((category) => category.key === buildCategory(option.tool)));
  }
});

test("each thumbnail resolves to its installed artwork including historical chapel", async () => {
  for (const option of BUILD_TOOL_OPTIONS) {
    const path = buildThumbnail(option.tool);
    // The farmstead has no artwork yet (render hand-off, AF-12): its glyph stands in.
    if (option.tool === "road" || option.tool === "farmstead") { assert.equal(path, null); continue; }
    assert.ok(path);
    await access(new URL(`../public${path}`, import.meta.url));
  }
});

test("selected tool opens its own category and exposes full cost and requirements", () => {
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: "logging_camp", state: DEFAULT_GAME_STATE, onSelect: () => undefined,
  }));
  assert.match(markup, /<section[^>]*aria-label="생업 도구"/);
  assert.doesNotMatch(markup, /<section[^>]*hidden=""[^>]*aria-label="생업 도구"/);
  assert.match(markup, /<section[^>]*hidden=""[^>]*aria-label="생활 도구"/);
  assert.match(markup, /build-tool--selected[^>]*aria-label="벌목소"/);
  assert.match(markup, /숲 인접 필요/);
  assert.match(markup, /목재 15/);
});

test("resource costs retain all canonical amounts and show free roads plainly", () => {
  const church = BUILD_TOOL_OPTIONS.find((option) => option.tool === "church");
  const road = BUILD_TOOL_OPTIONS.find((option) => option.tool === "road");
  assert.ok(church); assert.ok(road);
  assert.equal(buildCostLabel(church), "목재 100 · 석재 60");
  assert.equal(buildCostLabel(road), "육지 무료 · 다리 목재 4/칸");
});

test("browser build-menu proof includes every app stylesheet in production order", async () => {
  const { pageHtml } = await import("../scripts/phase13Part7BuildMenuProofPage");
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  const imports = [...main.matchAll(/import "\.\/styles\/([^"\n]+\.css)";/g)];
  assert.ok(imports.length > 0);
  const html = await pageHtml({ state: DEFAULT_GAME_STATE, scenarioName: "style-contract" });
  let previousEnd = 0;
  for (const entry of imports) {
    const name = entry[1];
    assert.ok(name);
    const css = await readFile(new URL(`../src/styles/${name}`, import.meta.url), "utf8");
    const start = html.indexOf(css, previousEnd);
    assert.ok(start >= previousEnd, `${name} must appear in production cascade order`);
    previousEnd = start + css.length;
  }
});

test("build controls retain readable names and bounded scrolling at narrow widths", async () => {
  const css = await readFile(new URL("../src/styles/buildMenu.css", import.meta.url), "utf8");
  const tokens = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
  assert.match(tokens, /--font-body:\s*16px/);
  assert.match(css, /\.build-menu \.build-seal-label[^}]*font-size: var\(--font-body\)/);
  const categoryHeights = [...css.matchAll(/\.build-menu-category\s*\{[^}]*min-height:\s*(\d+)px/g)];
  assert.ok(categoryHeights.length > 0);
  for (const match of categoryHeights) assert.ok(Number(match[1]) >= 32, "category targets stay at least 32px tall");
  assert.match(css, /\.build-menu-catalog[^}]*min-width: 0[^}]*overflow-x: auto/);
  assert.match(css, /\.build-menu-tools\[hidden\][^}]*display: none/);
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: null, state: { ...DEFAULT_GAME_STATE, era: "stone_town" }, onSelect: () => undefined,
  }));
  for (const option of BUILD_TOOL_OPTIONS) {
    assert.ok(markup.includes(`<span class="build-seal-label" aria-hidden="true">${option.label}</span>`));
  }
});

test("opening category follows the current task, while an explicit selected tool takes priority", () => {
  const opening = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: null, state: DEFAULT_GAME_STATE, highlightedTools: ["logging_camp"], onSelect: () => undefined,
  }));
  assert.doesNotMatch(opening, /<section[^>]*hidden=""[^>]*aria-label="생업 도구"/);
  assert.match(opening, /<section[^>]*hidden=""[^>]*aria-label="생활 도구"/);
  const selected = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: "house", state: DEFAULT_GAME_STATE, highlightedTools: ["logging_camp"], onSelect: () => undefined,
  }));
  assert.doesNotMatch(selected, /<section[^>]*hidden=""[^>]*aria-label="생활 도구"/);
  assert.match(selected, /<section[^>]*hidden=""[^>]*aria-label="생업 도구"/);
});


test("each tool describes its own immutable guidance even when another tool is selected", () => {
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: "house", state: DEFAULT_GAME_STATE, onSelect: () => undefined,
  }));
  const buttons = [...markup.matchAll(/<button[^>]*class="build-seal[^>]*aria-label="([^"]+)"[^>]*aria-describedby="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, buildMenuGroups(DEFAULT_GAME_STATE, { includeEraLocked: true }).flatMap((group) => group.options).length + 1);
  for (const button of buttons) {
    const [, label, descriptionId, content] = button;
    assert.ok(descriptionId); assert.ok(content); assert.ok(label);
    assert.ok(content.includes(`id="${descriptionId}" class="visually-hidden">${label}. 비용`));
  }
});


test("compact selection summary retains canonical service radius and capacity with a closed detail drawer", () => {
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    selectedTool: "church", state: { ...DEFAULT_GAME_STATE, era: "stone_town" }, onSelect: () => undefined,
  }));
  assert.match(markup, /build-menu-summary[\s\S]*반경 12칸[\s\S]*수용 32필지/);
  assert.match(markup, /aria-label="선택 도구 상세 안내" aria-expanded="false"/);
  assert.match(markup, /class="build-menu-details" aria-label="건설 안내" hidden=""/);
  assert.match(markup, /class="build-menu-body" hidden=""/);
});
