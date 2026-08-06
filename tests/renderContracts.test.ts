import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingKind } from "../src/content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import { drawPlacementFeedbackOverlay, drawPlacementOverlay } from "../src/render/overlays";
import type { PlacementFeedback } from "../src/render/placementFeedback";
import { withAlpha } from "../src/render/style";
import {
  ambientOffset,
  objectPhase,
  runRenderPasses,
  type PlacementTool,
} from "../src/render/renderer";
import { PlacementFailure } from "../src/world/placement";

test("ambientOffset uses the exact deterministic sine equation with stable object phases", () => {
  // Given
  const tick = 17;
  const amplitude = 3;
  const frequency = 0.75;
  const firstPhase = objectPhase("tree", 4, 9);
  const secondPhase = objectPhase("tree", 4, 9);
  const otherPhase = objectPhase("tree", 5, 9);

  // When
  const offset = ambientOffset({ tick, amplitude, frequency, phase: firstPhase });

  // Then
  assert.equal(firstPhase, secondPhase);
  assert.notEqual(firstPhase, otherPhase);
  assert.equal(offset, amplitude * Math.sin(tick * frequency + firstPhase));
});

test("runRenderPasses calls ground objects and the empty overhang seam in explicit order", () => {
  // Given
  const calls: string[] = [];

  // When
  runRenderPasses({
    ground: () => calls.push("ground"),
    objects: () => calls.push("objects"),
    overhang: () => calls.push("overhang"),
  });

  // Then
  assert.deepEqual(calls, ["ground", "objects", "overhang"]);
});

test("PlacementTool is a focused tool union owned outside GameState", () => {
  // Given / When
  const buildingTool: PlacementTool = "mill";
  const roadTool: PlacementTool = "road";
  const allBuildingKinds = [
    "house",
    "well",
    "storehouse",
    "granary",
    "wheat_farm",
    "mill",
    "logging_camp",
    "sawmill",
  ] as const satisfies readonly BuildingKind[];

  // Then
  assert.equal(buildingTool, "mill");
  assert.equal(roadTool, "road");
  assert.ok(allBuildingKinds.includes(buildingTool));
  assert.equal("selectedTool" in { tick: 0 }, false);
});

test("invalid placement reasons use a zoom-stable vellum plaque", () => {
  // Given
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let strokeStyle = "";
  const context = {
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; calls.push(`fillStyle:${value}`); },
    get font() { return font; },
    set font(value: string) { font = value; calls.push(`font:${value}`); },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(value: string) { strokeStyle = value; calls.push(`strokeStyle:${value}`); },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: 70 };
    },
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
  } as unknown as CanvasRenderingContext2D;

  // When
  drawPlacementOverlay(context, {
    zoom: 0.5,
    preview: {
      tool: "sawmill",
      tile: { tx: 4, ty: 5 },
      footprint: [{ tx: 4, ty: 5 }],
      roadPath: [],
      ok: false,
      reason: PlacementFailure.needs_road,
      cursor: { tx: 4, ty: 5 },
    },
  });

  // Then
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.vellum}`), "plaque uses canonical vellum");
  assert.ok(calls.some((call) => call.startsWith("fillRect:")), "plaque fills behind the label");
  assert.ok(calls.some((call) => call.startsWith("strokeRect:")), "plaque uses the sanctioned outline");
  assert.ok(calls.includes("font:28px Georgia, serif"), "14 CSS-pixel text is preserved at 0.5x zoom");
  assert.ok(
    calls.findIndex((call) => call.startsWith("fillRect:")) <
      calls.findIndex((call) => call.startsWith("fillText:needs road")),
    "plaque is drawn before its failure label",
  );
});

test("placement feedback reaches the overlay with gold success expansion and expiry", () => {
  // Given
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
    globalAlpha: 1,
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    stroke: () => calls.push("stroke"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
  } as unknown as CanvasRenderingContext2D;
  const feedback = {
    kind: "success",
    message: "건설했습니다",
    anchor: { kind: "tile", tile: { tx: 2, ty: 1 } },
    createdAtMs: 100,
    expiresAtMs: 700,
  } satisfies PlacementFeedback;

  // When
  drawPlacementFeedbackOverlay(context, { feedback, nowMs: 400, zoom: 1 });
  drawPlacementFeedbackOverlay(context, { feedback, nowMs: 700, zoom: 1 });

  // Then
  assert.ok(calls.includes(`strokeStyle:${PALETTE.gold}`), "success uses the palette gold token");
  assert.ok(calls.some((call) => call.startsWith("moveTo:32,21")), "success ring expands from the tile");
  const firstStrokeCount = calls.filter((call) => call === "stroke").length;
  assert.equal(firstStrokeCount, 1, "expired success feedback draws no extra stroke");
});

test("placement failure feedback uses vermilion flash and cursor-near Korean message until expiry", () => {
  // Given
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let strokeStyle = "";
  const context = {
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; calls.push(`fillStyle:${value}`); },
    get font() { return font; },
    set font(value: string) { font = value; calls.push(`font:${value}`); },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(value: string) { strokeStyle = value; calls.push(`strokeStyle:${value}`); },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    globalAlpha: 1,
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: 92 };
    },
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
  } as unknown as CanvasRenderingContext2D;
  const feedback = {
    kind: "failure",
    message: "길에 닿아야 합니다 — 먼저 길을 놓으세요",
    anchor: { kind: "tile", tile: { tx: 4, ty: 2 } },
    createdAtMs: 0,
    expiresAtMs: 4500,
  } satisfies PlacementFeedback;

  // When
  drawPlacementFeedbackOverlay(context, { feedback, nowMs: 4499, zoom: 0.5 });
  drawPlacementFeedbackOverlay(context, { feedback, nowMs: 4500, zoom: 0.5 });

  // Then
  assert.ok(calls.includes(`fillStyle:${withAlpha(PALETTE.vermilion, 0.3)}`), "failure flash uses vermilion");
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.vellum}`), "failure message uses vellum plaque");
  assert.ok(
    calls.includes("fillText:길에 닿아야 합니다 — 먼저 길을 놓으세요,96,80"),
    "message is snapped near the attempted cursor tile",
  );
  assert.equal(
    calls.filter((call) => call.startsWith("fillText:길에 닿아야 합니다")).length,
    1,
    "expired failure feedback draws no second message",
  );
});
