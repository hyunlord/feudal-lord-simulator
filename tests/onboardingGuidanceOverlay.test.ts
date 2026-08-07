import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import { drawOnboardingGuidanceOverlay } from "../src/render/onboardingGuidanceOverlay";
import { withAlpha } from "../src/render/style";
import {
  createOnboardingGuidancePlaqueContext,
  plaqueDrawFrom,
} from "./helpers/onboardingGuidanceOverlayContext";

test("drawOnboardingGuidanceOverlay paints the Korean road target as a gold parchment isometric marker", () => {
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
      return { width: 126 };
    },
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
  } as unknown as CanvasRenderingContext2D;

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "road", label: "여기에 길을 놓으세요", origin: { tx: 1, ty: 0 } }],
    zoom: 1,
  });

  // Then
  assert.ok(calls.includes(`fillStyle:${withAlpha(SEMANTIC_PALETTE.parchment, 0.72)}`));
  assert.ok(calls.includes(`strokeStyle:${PALETTE.gold}`));
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.vellum}`));
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.ink}`));
  assert.ok(calls.includes("measureText:여기에 길을 놓으세요"));
  assert.ok(calls.some((call) => call.startsWith("fillText:여기에 길을 놓으세요,")));
  assert.ok(
    calls.findIndex((call) => call === `strokeStyle:${PALETTE.gold}`) <
      calls.findIndex((call) => call.startsWith("fillText:여기에 길을 놓으세요,")),
  );
});

test("drawOnboardingGuidanceOverlay paints every returned onboarding target label", () => {
  // Given
  const calls: string[] = [];
  const context = {
    fillStyle: "",
    font: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillRect: () => undefined,
    strokeRect: () => undefined,
    fillText: (text: string) => calls.push(text),
    save: () => undefined,
    restore: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [
      { kind: "wheat_farm", label: "여기에 밀밭을 지으세요", origin: { tx: 2, ty: 0 } },
      { kind: "mill", label: "여기에 방앗간을 지으세요", origin: { tx: 3, ty: 0 } },
      { kind: "granary", label: "여기에 곡창을 지으세요", origin: { tx: 4, ty: 0 } },
    ],
    zoom: 1,
  });

  // Then
  assert.deepEqual(calls, [
    "여기에 밀밭을 지으세요",
    "여기에 방앗간을 지으세요",
    "여기에 곡창을 지으세요",
  ]);
});

test("drawOnboardingGuidanceOverlay clamps plaque text inside the canvas on narrow views", () => {
  // Given
  const calls: string[] = [];
  const context = {
    canvas: { clientWidth: 200, clientHeight: 120 },
    fillStyle: "",
    font: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: 70 };
    },
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    save: () => undefined,
    restore: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "road", label: "여기에 길을 놓으세요", origin: { tx: 1, ty: 0 } }],
    zoom: 1,
  });

  // Then
  const fillRect = calls.find((call) => call.startsWith("fillRect:"));
  const fillText = calls.find((call) => call.startsWith("fillText:"));
  assert.ok(fillRect);
  assert.ok(fillText);
  const [, rectX, , rectWidth] = fillRect.split(/[:,]/);
  const [, text, textX] = fillText.split(/[:,]/);
  assert.equal(text, "여기에 길을 놓으세요");
  assert.ok(Number(rectX) >= 0);
  assert.ok(Number(rectX) + Number(rectWidth) <= 200);
  assert.ok(Number(textX) >= Number(rectX));
  assert.ok(Number(textX) <= 200);
});

test("drawOnboardingGuidanceOverlay keeps Korean plaques out of the right rail at tablet width", () => {
  // Given
  const calls: string[] = [];
  const context = {
    canvas: { clientWidth: 768, clientHeight: 375 },
    fillStyle: "",
    font: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    measureText: () => ({ width: 108 }),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: () => undefined,
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    save: () => undefined,
    restore: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "logging_camp", label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
    safeRightInset: 348,
  });

  // Then
  const usableRight = 420;
  const fillRect = calls.find((call) => call.startsWith("fillRect:"));
  const fillText = calls.find((call) => call.startsWith("fillText:"));
  assert.ok(fillRect);
  assert.ok(fillText);
  const [, rectX, , rectWidth] = fillRect.split(/[:,]/);
  const [, , textX] = fillText.split(/[:,]/);
  assert.ok(Number(rectX) + Number(rectWidth) <= usableRight);
  assert.ok(Number(textX) <= usableRight);
});

test("drawOnboardingGuidanceOverlay keeps tablet plaque placement stable across high DPR canvas transforms", () => {
  // Given
  const dpr1 = createOnboardingGuidancePlaqueContext({
    canvasClientWidth: 768,
    canvasClientHeight: 375,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  });
  const dpr2 = createOnboardingGuidancePlaqueContext({
    canvasClientWidth: 768,
    canvasClientHeight: 375,
    canvasPixelWidth: 1_536,
    canvasPixelHeight: 750,
    transform: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
  });
  const input = {
    targets: [{ kind: "logging_camp" as const, label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
    safeRightInset: 348,
  };

  // When
  drawOnboardingGuidanceOverlay(dpr1.context, input);
  drawOnboardingGuidanceOverlay(dpr2.context, input);

  // Then
  const dpr1Plaque = plaqueDrawFrom(dpr1.calls);
  const dpr2Plaque = plaqueDrawFrom(dpr2.calls);
  assert.deepEqual(dpr2Plaque, dpr1Plaque);
  assert.deepEqual(dpr2Plaque, { rectX: 302, rectWidth: 118, textX: 307 });
});

test("drawOnboardingGuidanceOverlay derives the safe inset from an overlapping right rail at high DPR", () => {
  // Given
  const { calls, context } = createOnboardingGuidancePlaqueContext({
    canvasClientWidth: 768,
    canvasClientHeight: 375,
    canvasPixelWidth: 1_536,
    canvasPixelHeight: 750,
    transform: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
    railBounds: { left: 420, top: 0, right: 768, bottom: 375 },
  });

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "logging_camp", label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
  });

  // Then
  const plaque = plaqueDrawFrom(calls);
  assert.deepEqual(plaque, { rectX: 302, rectWidth: 118, textX: 307 });
});

test("drawOnboardingGuidanceOverlay suppresses an unfit mobile plaque without hiding the marker", () => {
  // Given
  const calls: string[] = [];
  const context = {
    canvas: { clientWidth: 375, clientHeight: 667 },
    fillStyle: "",
    font: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => calls.push("fill"),
    stroke: () => undefined,
    measureText: () => ({ width: 120 }),
    fillRect: () => calls.push("fillRect"),
    strokeRect: () => undefined,
    fillText: () => calls.push("fillText"),
    save: () => undefined,
    restore: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "logging_camp", label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
    safeRightInset: 348,
  });

  // Then
  assert.ok(calls.includes("beginPath"));
  assert.ok(calls.includes("fill"));
  assert.equal(calls.includes("fillRect"), false);
  assert.equal(calls.includes("fillText"), false);
});
