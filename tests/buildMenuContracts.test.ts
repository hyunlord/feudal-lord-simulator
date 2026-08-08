import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { App } from "../src/App";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { GameProvider } from "../src/state/gameStore";
import { BuildSeals } from "../src/ui/BuildMenu";
import {
  buildMenuGroups,
  buildToolTooltipLines,
  BUILD_TOOL_OPTIONS,
} from "../src/ui/buildMenuModel";

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
    markup.indexOf('aria-label="Placement seals"'),
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
