import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettlementPanel } from "../src/ui/SettlementPanel";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { settlementProgress } from "../src/engine/settlementProgress";
test("Given the opening When showing settlement progress Then real supply and current goal appear", () => {
  const markup = renderToStaticMarkup(createElement(SettlementPanel, { state: DEFAULT_GAME_STATE, onRestart: () => {} }));
  assert.match(markup, /자립 마을/);
  assert.match(markup, /가구 비축/);
  assert.match(markup, /30초/);
  assert.doesNotMatch(markup, /새 영지 시작/);
});
test("Given abandonment When showing outcome Then restart is available and cause is explicit", () => {
  const state = { ...DEFAULT_GAME_STATE, settlement: { ...settlementProgress(DEFAULT_GAME_STATE), outcome: "abandoned" as const } };
  const markup = renderToStaticMarkup(createElement(SettlementPanel, { state, onRestart: () => {} }));
  assert.match(markup, /정착지가 비었습니다/);
  assert.match(markup, /새 영지 시작/);
});
