import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "../src/App";
import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import type { Building } from "../src/economy/economy.types";
import { drawOverlay, wellCoverageTiles } from "../src/render/overlays";
import type { RenderFrameInput } from "../src/render/renderer";
import { withAlpha } from "../src/render/style";
import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { toggleOverlayByKey } from "../src/ui/EconomyOverlayControls";
import { CourtLedger } from "../src/ui/InfoPanel";
import {
  settlementGuidance,
  settlementProblemGlyphs,
} from "../src/ui/settlementGuidanceModel";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);
const APP_SOURCE = new URL("../src/App.tsx", import.meta.url);

function contextRecorder(): { readonly calls: readonly string[]; readonly context: CanvasRenderingContext2D } {
  const calls: string[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  const context = {
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; calls.push(`fillStyle:${value}`); },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(value: string) { strokeStyle = value; calls.push(`strokeStyle:${value}`); },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    setLineDash: (segments: readonly number[]) => calls.push(`dash:${segments.join(",")}`),
  } as unknown as CanvasRenderingContext2D;
  return { calls, context };
}

function building(input: Pick<Building, "id" | "kind" | "tx" | "ty" | "workers">): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

test("CourtLedger keeps old call sites and can display the Phase 3 economy totals", () => {
  // Given / When
  const legacy = renderToStaticMarkup(
    createElement(CourtLedger, { tick: 7, timber: 9, selectedTool: "house" }),
  );
  const phase3 = renderToStaticMarkup(
    createElement(CourtLedger, {
      tick: 8,
      timber: 11,
      selectedTool: "mill",
      population: 6,
      idleWorkers: 2,
      stockTotals: { wheat: 3, bread: 4, logs: 5, timber: 12 },
    }),
  );

  // Then
  assert.match(legacy, /Timber/);
  assert.match(phase3, /Population/);
  assert.match(phase3, /Idle/);
  assert.match(phase3, /Wheat/);
  assert.match(phase3, /Bread/);
  assert.match(phase3, /Logs/);
  assert.ok(phase3.includes("<dt>Timber</dt><dd>12</dd>"));
});

test("economy overlay controls expose visible water and labour toggles without camera-key collisions", () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));

  // Then
  assert.match(markup, /aria-label="Economy overlays"/);
  assert.match(markup, /Water/);
  assert.match(markup, /Labour/);
  assert.match(markup, /Digit1/);
  assert.match(markup, /Digit2/);
  assert.match(markup, /Distribution/);
  assert.match(markup, /Road component/);
  assert.match(markup, /Digit3/);
  assert.match(markup, /Digit4/);
  assert.equal(toggleOverlayByKey("Digit1", "none"), "water");
  assert.equal(toggleOverlayByKey("Digit1", "water"), "none");
  assert.equal(toggleOverlayByKey("Digit2", "water"), "labour");
  assert.equal(toggleOverlayByKey("Digit3", "none"), "distribution");
  assert.equal(toggleOverlayByKey("Digit4", "distribution"), "road_component");
  assert.equal(toggleOverlayByKey("KeyW", "water"), "water");
  assert.equal(toggleOverlayByKey("ArrowUp", "labour"), "labour");
});

test("economy overlay controls render inside the right console recess instead of as persistent floating UI", () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));

  // Then
  assert.ok(markup.indexOf('class="ledger-recess"') < markup.indexOf('aria-label="Economy overlays"'));
  assert.ok(markup.indexOf('class="court-ledger"') < markup.indexOf('aria-label="Economy overlays"'));
  assert.ok(markup.indexOf('aria-label="Economy overlays"') < markup.indexOf('class="speed-seals"'));
});

test("the onboarding task list replaces the distant population objective in the right console", () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));

  // Then
  const statusIndex = markup.indexOf('aria-label="Settlement status"');
  const consoleIndex = markup.indexOf('aria-label="Court console"');
  const tasksIndex = markup.indexOf('aria-label="Onboarding tasks"');
  assert.ok(statusIndex >= 0 && statusIndex < consoleIndex);
  assert.ok(tasksIndex > consoleIndex);
  assert.match(markup.slice(statusIndex, consoleIndex), /우물이 필요합니다/);
  assert.doesNotMatch(markup.slice(statusIndex, consoleIndex), /목표: 인구/);
  assert.match(markup.slice(tasksIndex), /길을 놓아 오두막을 이으세요/);
  assert.match(markup.slice(tasksIndex), /숲 옆에 벌목소를 지으세요/);
});

test("sixty-tick guidance sampling does not schedule state from an effect on every simulation tick", async () => {
  // Given / When
  const source = await readFile(APP_SOURCE, "utf8");

  // Then
  assert.doesNotMatch(source, /setGuidanceSnapshot/);
  assert.match(source, /guidanceSnapshotRef/);
});

test("build groups reserve their full two-seal width so neighboring buttons cannot intercept clicks", async () => {
  // Given / When
  const stylesheet = await readFile(STYLESHEET, "utf8");

  // Then
  assert.match(stylesheet, /grid-template-columns:\s*repeat\(4, calc\(var\(--seal-size\) \* 2 \+ 2px\)\)/);
  assert.match(stylesheet, /@media \(max-width: 600px\)[\s\S]*grid-template-columns:\s*repeat\(2, calc\(var\(--seal-size\) \* 2 \+ 2px\)\)/);
});

test("settlement guidance advances population targets and samples priority on a sixty tick cadence", () => {
  // Given
  const state = {
    ...DEFAULT_GAME_STATE,
    tick: 260,
    population: 50,
    houses: DEFAULT_GAME_STATE.houses.map((house) => ({
      ...house,
      hasWater: true,
      breadStock: 0,
      lastServicedTick: 0,
    })),
  };

  // When
  const guidance = settlementGuidance(state);

  // Then
  assert.equal(guidance.populationGoal, 120);
  assert.equal(guidance.completedGoal, 50);
  assert.equal(guidance.sampledTick, 240);
  assert.equal(guidance.statusLine, "식량이 부족합니다");
});

test("settlement guidance priority follows the exact Phase 4F blocker order", () => {
  // Given
  const hydratedHouse = DEFAULT_GAME_STATE.houses.map((house) => ({
    ...house,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 0,
  }));
  const granary = {
    ...building({ id: "granary", kind: "granary", tx: 2, ty: 2, workers: 2 }),
    inventory: {},
  };
  const farm = building({ id: "farm", kind: "wheat_farm", tx: 3, ty: 3, workers: 1 });
  const openingHouse = DEFAULT_GAME_STATE.buildings[0];
  assert.ok(openingHouse);
  const stable = {
    ...DEFAULT_GAME_STATE,
    tick: 10,
    houses: hydratedHouse,
    buildings: [openingHouse, granary],
    treasuryTimber: 30,
    idleWorkers: 0,
  };

  // When / Then
  assert.equal(
    settlementGuidance({ ...stable, houses: hydratedHouse.map((house) => ({ ...house, hasWater: false })) }).statusLine,
    "우물이 필요합니다",
  );
  assert.equal(
    settlementGuidance({
      ...stable,
      tick: 200,
      houses: hydratedHouse.map((house) => ({ ...house, breadStock: 0, lastServicedTick: 0 })),
    }).statusLine,
    "식량이 부족합니다",
  );
  assert.equal(
    settlementGuidance({ ...stable, buildings: [...stable.buildings, farm], idleWorkers: 1 }).statusLine,
    "일꾼이 놀고 있습니다 — 길이 끊겼는지 확인하세요",
  );
  assert.equal(settlementGuidance({ ...stable, buildings: [openingHouse] }).statusLine, "곡창이 필요합니다");
  assert.equal(settlementGuidance({ ...stable, treasuryTimber: 29 }).statusLine, "목재가 부족합니다");
  assert.equal(settlementGuidance(stable).statusLine, "정착지는 안정적입니다");
});

test("settlement problem glyphs appear only for real water bread labour and storage conditions", () => {
  // Given
  const healthy = {
    ...DEFAULT_GAME_STATE,
    tick: 10,
    houses: DEFAULT_GAME_STATE.houses.map((house) => ({
      ...house,
      hasWater: true,
      breadStock: 1,
      lastServicedTick: 10,
    })),
    buildings: DEFAULT_GAME_STATE.buildings.map((item) => ({ ...item, workers: 0 })),
  };
  const troubled = {
    ...healthy,
    tick: 260,
    houses: healthy.houses.map((house) => ({
      ...house,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
    })),
    buildings: [
      ...healthy.buildings,
      building({ id: "farm", kind: "wheat_farm", tx: 3, ty: 3, workers: 1 }),
      {
        ...building({ id: "granary", kind: "granary", tx: 5, ty: 5, workers: 2 }),
        inventory: { bread: 200 },
      },
    ],
  };

  // When
  const healthyGlyphs = settlementProblemGlyphs(healthy);
  const troubledGlyphs = settlementProblemGlyphs(troubled);

  // Then
  assert.deepEqual(healthyGlyphs, []);
  assert.deepEqual(
    troubledGlyphs.map((glyph) => glyph.kind),
    ["water", "bread", "labour", "storage"],
  );
});

test("water overlay draws well coverage and marks dry houses in vermilion", () => {
  // Given
  const { calls, context } = contextRecorder();
  const state = {
    ...DEFAULT_GAME_STATE,
    buildings: [
      building({ id: "house:dry", kind: "house", tx: 0, ty: 0, workers: 0 }),
      building({ id: "well:1", kind: "well", tx: 8, ty: 8, workers: 0 }),
    ],
    houses: [{
      buildingId: "house:dry",
      level: 1,
      residents: 4,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: -1,
      unmetRequirementTicks: 0,
    }],
  };

  // When
  drawOverlay({ context, state, mode: "water", zoom: 1 });

  // Then
  assert.ok(
    calls.some((call) => call.includes(withAlpha(SEMANTIC_PALETTE.water, 0.16))),
    "well radius is visible",
  );
  assert.ok(
    calls.some((call) => call.includes(withAlpha(PALETTE.vermilion, 0.42))),
    "dry house uses vermilion",
  );
});

test("water coverage uses the same bounded Manhattan radius as well service", () => {
  const well = building({ id: "well:1", kind: "well", tx: 8, ty: 8, workers: 0 });

  const coverage = wellCoverageTiles(
    { ...DEFAULT_GAME_STATE, width: 20, height: 20 },
    well,
  );

  assert.equal(coverage.length, 85);
  assert.ok(coverage.some(({ tx, ty }) => tx === 14 && ty === 8));
  assert.ok(!coverage.some(({ tx, ty }) => tx === 15 && ty === 8));
  assert.ok(
    coverage.every(({ tx, ty }) => Math.abs(tx - 8) + Math.abs(ty - 8) <= 6),
  );
});

test("labour overlay highlights only buildings below their worker requirement", () => {
  // Given
  const { calls, context } = contextRecorder();
  const state = {
    ...DEFAULT_GAME_STATE,
    buildings: [
      building({ id: "farm", kind: "wheat_farm", tx: 0, ty: 0, workers: 1 }),
      building({ id: "mill", kind: "mill", tx: 2, ty: 0, workers: 2 }),
      building({ id: "well", kind: "well", tx: 4, ty: 0, workers: 0 }),
    ],
  };

  // When
  drawOverlay({ context, state, mode: "labour", zoom: 1 });

  // Then
  assert.equal(
    calls.filter((call) => call.includes(withAlpha(PALETTE.vermilion, 0.42))).length,
    1,
  );
});

test("renderer overlay input is optional so existing renderFrame callers remain source-compatible", () => {
  // Given / When
  const input = {
    context: contextRecorder().context,
    state: DEFAULT_GAME_STATE,
    camera: { zoom: 1, panX: 0, panY: 0 },
    viewport: { width: 320, height: 180 },
    preview: {
      tool: "house",
      tile: null,
      footprint: [],
      roadPath: [],
      ok: true,
      reason: null,
      cursor: null,
    },
  } satisfies RenderFrameInput;

  // Then
  assert.equal(input.state.tick, DEFAULT_GAME_STATE.tick);
});

test("economy overlay CSS stays fixed and tokenized", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");

  // Then
  assert.match(css, /\.economy-overlays/);
  assert.doesNotMatch(css, /\.economy-overlays\s*\{[^}]*position:\s*absolute;/);
  assert.match(css, /\.problem-glyph/);
  assert.match(css, /font-size:\s*18px;/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}|\b(?:rgb|hsl)a?\(|box-shadow|backdrop-filter|blur\(/i);
});
