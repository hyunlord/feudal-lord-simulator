import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import { drawOnboardingGuidanceOverlay } from "../src/render/onboardingGuidanceOverlay";
import { withAlpha } from "../src/render/style";

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
