import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { BuildSeals } from "../src/ui/BuildMenu";

test("Given palisade drawing is selected When menu renders Then its drag guidance is visible without hover", () => {
  const markup = renderToStaticMarkup(createElement(BuildSeals, {
    state: DEFAULT_GAME_STATE,
    selectedTool: null,
    palisadeDrawing: true,
    onSelect: () => undefined,
    onStartPalisadeDrawing: () => undefined,
  }));
  assert.match(markup, /class="build-menu-summary"[^>]*><strong>목책 긋기<\/strong><span>지도를 드래그해 목책 둘레를 직접 그립니다<\/span>/);
  assert.doesNotMatch(markup, /선택 도구 없음/);
});
