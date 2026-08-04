import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "../src/App";
import { PALETTE } from "../src/content/palette";
import type { Building } from "../src/economy/economy.types";
import { drawOverlay } from "../src/render/overlays";
import type { RenderFrameInput } from "../src/render/renderer";
import { withAlpha } from "../src/render/style";
import { DEFAULT_GAME_STATE, GameProvider } from "../src/state/gameStore";
import { toggleOverlayByKey } from "../src/ui/EconomyOverlayControls";
import { CourtLedger } from "../src/ui/InfoPanel";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

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
  assert.equal(toggleOverlayByKey("Digit1", "none"), "water");
  assert.equal(toggleOverlayByKey("Digit1", "water"), "none");
  assert.equal(toggleOverlayByKey("Digit2", "water"), "labour");
  assert.equal(toggleOverlayByKey("KeyW", "water"), "water");
  assert.equal(toggleOverlayByKey("ArrowUp", "labour"), "labour");
});

test("water overlay draws well coverage and marks dry houses in vermilion", () => {
  // Given
  const { calls, context } = contextRecorder();
  const state = {
    ...DEFAULT_GAME_STATE,
    buildings: [
      building({ id: "house:dry", kind: "house", tx: 0, ty: 0, workers: 0 }),
      building({ id: "well:1", kind: "well", tx: 2, ty: 0, workers: 0 }),
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
  assert.ok(calls.some((call) => call.startsWith("ellipse:")), "well radius is visible");
  assert.ok(
    calls.some((call) => call.includes(withAlpha(PALETTE.vermilion, 0.42))),
    "dry house uses vermilion",
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
  assert.match(css, /position:\s*absolute;/);
  assert.match(css, /bottom:\s*150px;/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}|\b(?:rgb|hsl)a?\(|box-shadow|backdrop-filter|blur\(/i);
});
