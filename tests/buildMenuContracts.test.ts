import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { App } from "../src/App";
import { GameProvider } from "../src/state/gameStore";
import { BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";

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
