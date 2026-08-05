import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { App } from "../src/App";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { GameProvider } from "../src/state/gameStore";
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
  assert.equal(labels.length, 9);
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
  assert.match(markup, /aria-pressed="true"/);
});

test("build menu groups tools and renders Korean purpose, requirements, and shortfall tooltips", () => {
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
    [["house"], ["wheat_farm", "mill", "logging_camp", "sawmill"], ["storehouse", "granary"], ["well", "road"]],
  );
  assert.ok(loggingTooltip.some((line) => line.includes("벌목소")));
  assert.ok(loggingTooltip.some((line) => line.includes("목재 15")));
  assert.ok(loggingTooltip.some((line) => line.includes("목적")));
  assert.ok(loggingTooltip.some((line) => line.includes("길")));
  assert.ok(loggingTooltip.some((line) => line.includes("숲")));
  assert.ok(loggingTooltip.some((line) => line.includes("부족 10")));
  assert.match(appMarkup, /class="build-group"/);
});
