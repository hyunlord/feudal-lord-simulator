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
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, /class="app-interaction-layer" inert="" aria-hidden="true"/);
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
  assert.match(source, /dialogRef\.current\?\.focus\(\)/);
  assert.match(source, /onKeyDown=\{containKeyboard\}/);
  assert.match(source, /inert=\{welcomeVisible \? true : undefined\}/);
  assert.match(source, /aria-hidden=\{welcomeVisible \? true : undefined\}/);
  assert.match(source, /feudal-lord-simulator:welcome-dismissed:v1/);
  assert.match(source, /localStorage\.setItem\(WELCOME_DISMISSED_KEY, "1"\)/);
  assert.match(source, /localStorage\.getItem\(WELCOME_DISMISSED_KEY\) === "1"/);
  assert.match(source, /setWelcomeVisible\(false\)/);
  assert.match(source, /onPointerDown=\{consumeDismissal\}/);
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

test("right rail renders era gauges plus current and next onboarding tasks", () => {
  // Given / When
  const markup = renderApp();
  const railMarkup = markup.slice(
    markup.indexOf('aria-label="Information rail"'),
    markup.indexOf('aria-label="Court console"'),
  );

  // Then
  assert.match(railMarkup, /aria-label="Era console"/);
  assert.equal((railMarkup.match(/class="era-requirement(?: era-requirement--met)?"/g) ?? []).length, 4);
  assert.match(railMarkup, /aria-label="Onboarding tasks"/);
  assert.match(railMarkup, /data-task-state="current"/);
  assert.match(railMarkup, /길을 놓아 오두막을 이으세요/);
  assert.match(railMarkup, /data-task-state="next"/);
  assert.match(railMarkup, /숲 옆에 벌목소를 지으세요/);
  assert.doesNotMatch(railMarkup, /목표: 인구 50명 · 현재/);
});

test("population history is opened only from the ledger drawer", () => {
  // Given / When
  const markup = renderApp();
  const beforeConsole = markup.slice(0, markup.indexOf('aria-label="Court console"'));
  const consoleMarkup = markup.slice(markup.indexOf('aria-label="Court console"'));

  // Then
  assert.doesNotMatch(beforeConsole, /aria-label="인구 변화 기록"/);
  assert.match(consoleMarkup, /class="ledger-population-toggle"/);
  assert.match(consoleMarkup, /aria-expanded="false"/);
  assert.doesNotMatch(consoleMarkup, /id="population-ledger-drawer"/);
});

test("population drawer toggle stays above ledger text for pointer access", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");

  // Then
  assert.match(css, /\.court-ledger > \.ledger-population-toggle\s*\{[\s\S]*?z-index:\s*2;/);
});

test("hidden seal tooltips do not inflate responsive console scroll width", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");
  const tooltipRule = css.match(/\.seal-tooltip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const hoverRule = css.match(/\.build-seal:hover \+ \.seal-tooltip,[\s\S]*?\.build-seal:focus-visible \+ \.seal-tooltip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  // Then
  assert.match(tooltipRule, /display:\s*none;/);
  assert.match(hoverRule, /display:\s*block;/);
});

test("tablet seal layout folds before it can widen the console recess", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");
  const tabletRules = css.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/)?.[0] ?? "";

  // Then
  assert.match(tabletRules, /\.build-seals\s*\{/);
  assert.match(tabletRules, /grid-template-columns:\s*repeat\(4,\s*var\(--seal-size\)\);/);
  assert.match(tabletRules, /\.build-seal--road\s*\{/);
  assert.match(tabletRules, /width:\s*var\(--seal-size\);/);
});

test("seal tray and tooltips stay inside their assigned geometry lanes", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");
  const sealRecessRule = css.match(/\.seal-recess\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const buildSealsRule = css.match(/\.build-seals\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const tooltipRule = css.match(/\.seal-tooltip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const mobileRules = [...css.matchAll(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/g)]
    .map((match) => match[0])
    .join("\n");

  // Then
  assert.match(sealRecessRule, /overflow:\s*visible;/);
  assert.match(buildSealsRule, /max-height:\s*100%;/);
  assert.match(buildSealsRule, /overflow-x:\s*auto;/);
  assert.match(buildSealsRule, /overflow-y:\s*hidden;/);
  assert.match(tooltipRule, /position:\s*fixed;/);
  assert.match(tooltipRule, /top:\s*var\(--seal-tooltip-top,\s*204px\);/);
  assert.match(tooltipRule, /left:\s*clamp\(12px,\s*28vw,\s*360px\);/);
  assert.match(mobileRules, /--seal-tooltip-top:\s*154px;/);
});

test("desktop ledger plaque height fits inside the carved ledger recess", async () => {
  // Given / When
  const css = await readFile(GLOBAL_CSS_SOURCE, "utf8");
  const ledgerRule = css.match(/\.court-ledger\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  // Then
  assert.match(ledgerRule, /height:\s*68px;/);
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
