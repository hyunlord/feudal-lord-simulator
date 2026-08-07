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
  assert.equal(labels.length, 10);
  assert.equal(labels.every((label) => label.length > 0), true);
});

test("the real app renders every placement tool as an accessible control", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(App)),
  );

  // Then
  for (const option of BUILD_TOOL_OPTIONS) {
    assert.match(markup, new RegExp(`aria-label="${option.label}"`));
  }
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
