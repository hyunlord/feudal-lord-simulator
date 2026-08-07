import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "../src/App";
import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { GameCanvas } from "../src/render/GameCanvas";
import { getPlacementToolStatus } from "../src/render/placementFeedback";
import { OnboardingTasks, SettlementStatusLine } from "../src/ui/InfoPanel";

const APP_SOURCE = new URL("../src/App.tsx", import.meta.url);
const CANVAS_RUNTIME_SOURCE = new URL("../src/render/useGameCanvasRuntime.ts", import.meta.url);
const CANVAS_RUNTIME_REFS_SOURCE = new URL("../src/render/useGameCanvasRuntimeRefs.ts", import.meta.url);
const GLOBAL_CSS_SOURCE = new URL("../src/styles/global.css", import.meta.url);

function renderApp(): string {
  return renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));
}

test("welcome parchment renders exact opening copy and dismiss affordance", () => {
  // Given / When
  const markup = renderApp();

  // Then
  assert.match(markup, /aria-label="Opening guidance"/);
  assert.match(markup, /영지에 오신 것을 환영합니다/);
  assert.match(markup, /왼쪽 아래 도장을 눌러 건물을 고르고, 지도를 클릭해 지으세요\./);
  assert.match(markup, /마우스 휠로 확대, 드래그로 이동합니다\./);
  assert.match(markup, /아무 곳이나 클릭하여 시작/);
});

test("app starts with no armed placement tool and consumes welcome dismissal locally", async () => {
  // Given / When
  const markup = renderApp();
  const source = await readFile(APP_SOURCE, "utf8");
  const runtimeSource = await readFile(CANVAS_RUNTIME_SOURCE, "utf8");
  const runtimeRefsSource = await readFile(CANVAS_RUNTIME_REFS_SOURCE, "utf8");
  const placementMarkup = markup.slice(
    markup.indexOf('aria-label="Placement seals"'),
    markup.indexOf("ledger-recess"),
  );

  // Then
  assert.doesNotMatch(placementMarkup, /aria-pressed="true"/);
  assert.match(source, /useState<PlacementTool \| null>\(null\)/);
  assert.doesNotMatch(source, /useState<PlacementTool \| null>\(DEFAULT_PLACEMENT_TOOL\)/);
  assert.match(source, /presentationNowMs/);
  assert.match(source, /setPresentationNowMs\(Date\.now\(\)\)/);
  assert.match(source, /stopPropagation\(\)/);
  assert.match(source, /setWelcomeVisible\(false\)/);
  assert.doesNotMatch(source, /onPointerDown=/);
  assert.match(source, /onClick=\{consumeDismissal\}/);
  assert.doesNotMatch(runtimeSource, /selectedTool\s*\?\?/);
  assert.match(runtimeRefsSource, /useRef\(input\.selectedTool\)/);
  assert.match(runtimeRefsSource, /selectedToolRef\.current\s*=\s*input\.selectedTool/);
});

test("world canvas exposes crosshair styling only while a placement tool is armed", () => {
  // Given / When
  const armedMarkup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(GameCanvas, { selectedTool: "logging_camp" })),
  );
  const idleMarkup = renderToStaticMarkup(
    createElement(GameProvider, null, createElement(GameCanvas, { selectedTool: null })),
  );

  // Then
  assert.match(armedMarkup, /class="game-canvas game-canvas--placement-armed"/);
  assert.doesNotMatch(idleMarkup, /game-canvas--placement-armed/);
});

test("status line prioritizes armed tool copy before feedback and blocker fallback", () => {
  // Given / When
  const armed = renderToStaticMarkup(
    createElement(SettlementStatusLine, {
      state: DEFAULT_GAME_STATE,
      selectedTool: "logging_camp",
      placementFeedbackMessage: "도로가 필요합니다",
    }),
  );
  const feedback = renderToStaticMarkup(
    createElement(SettlementStatusLine, {
      state: DEFAULT_GAME_STATE,
      selectedTool: null,
      placementFeedbackMessage: "도로가 필요합니다",
    }),
  );
  const fallback = renderToStaticMarkup(
    createElement(SettlementStatusLine, { state: DEFAULT_GAME_STATE, selectedTool: null }),
  );

  // Then
  assert.match(armed, /지을 곳을 클릭하세요 — 벌목소 · 취소하려면 Esc/);
  assert.doesNotMatch(armed, /도로가 필요합니다/);
  assert.match(feedback, /도로가 필요합니다/);
  assert.doesNotMatch(feedback, /우물이 필요합니다/);
  assert.match(fallback, /우물이 필요합니다/);
  assert.equal(getPlacementToolStatus({ kind: "road" }), "드래그하여 길을 놓으세요 · 취소하려면 Esc");
});

test("right console renders current and next onboarding tasks before the open goal", () => {
  // Given / When
  const markup = renderApp();
  const consoleMarkup = markup.slice(markup.indexOf('aria-label="Court console"'));

  // Then
  assert.match(consoleMarkup, /aria-label="Onboarding tasks"/);
  assert.match(consoleMarkup, /data-task-state="current"/);
  assert.match(consoleMarkup, /길을 놓아 오두막을 이으세요/);
  assert.match(consoleMarkup, /data-task-state="next"/);
  assert.match(consoleMarkup, /숲 옆에 벌목소를 지으세요/);
  assert.doesNotMatch(consoleMarkup, /목표: 인구 50명 · 현재/);
});

test("hidden seal tooltips do not inflate responsive console scroll width", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");
  const tooltipRule = css.match(/\.seal-tooltip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const hoverRule = css.match(/\.build-seal:hover \.seal-tooltip,\s*\n\.build-seal:focus-visible \.seal-tooltip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  // Then
  assert.match(tooltipRule, /display:\s*none;/);
  assert.match(hoverRule, /display:\s*block;/);
});

test("onboarding task panel renders completion flourish and the post-task open goal", () => {
  // Given
  const flourishMarkup = renderToStaticMarkup(
    createElement(OnboardingTasks, {
      view: {
        current: {
          id: "task-1",
          title: "길을 놓아 오두막을 이으세요",
          hint: "오두막 바로 옆 칸에 길을 놓으세요.",
          highlightTools: ["road"],
          isComplete: true,
          flourishLabel: "완료",
        },
        next: {
          id: "task-2",
          title: "숲 옆에 벌목소를 지으세요",
          hint: "벌목소 도장을 고르고 숲 가장자리를 클릭하세요.",
          highlightTools: ["logging_camp"],
          isComplete: false,
          flourishLabel: null,
        },
        openGoal: null,
      },
    }),
  );
  const openGoalMarkup = renderToStaticMarkup(
    createElement(OnboardingTasks, {
      view: {
        current: null,
        next: null,
        openGoal: { title: "목표: 인구 50 이후 번영을 이어가세요" },
      },
    }),
  );

  // Then
  assert.match(flourishMarkup, /완료/);
  assert.match(flourishMarkup, /data-task-state="current"/);
  assert.match(openGoalMarkup, /data-onboarding-state="open-goal"/);
  assert.match(openGoalMarkup, /목표: 인구 50 이후 번영을 이어가세요/);
});
