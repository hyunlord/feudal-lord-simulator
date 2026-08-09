import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE } from "../src/content/palette";
import {
  applyInkOutline,
  drawFlatDiamondShadow,
  shade,
  snapToPixel,
  withAlpha,
} from "../src/render/style";

interface MockCanvasContext {
  fillStyle: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  strokeStyle: string;
  readonly calls: readonly string[];
  beginPath(): void;
  closePath(): void;
  fill(): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
}

function createMockContext(): MockCanvasContext {
  const calls: string[] = [];
  return {
    fillStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    strokeStyle: "",
    calls,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
  };
}

test("snapToPixel rounds canvas coordinates to integers", () => {
  assert.equal(snapToPixel(12.49), 12);
  assert.equal(snapToPixel(12.5), 13);
  assert.equal(snapToPixel(-2.5), -2);
});

test("shade deterministically darkens down-right faces by twenty percent", () => {
  assert.equal(shade(PALETTE.gold, 0.8), "#AA8C2C");
  assert.equal(shade(PALETTE.parchment, 0.8), "#BAB09A");
  assert.equal(shade(PALETTE.ink, 0.8), "#2E2519");
});

test("withAlpha derives translucent colours from the canonical palette", () => {
  assert.equal(withAlpha(PALETTE.ink, 0.18), "rgba(58, 46, 31, 0.18)");
  assert.equal(withAlpha(PALETTE.snow, 1.25), "rgba(220, 228, 232, 1)");
  assert.equal(withAlpha(PALETTE.vermilion, -0.2), "rgba(200, 16, 46, 0)");
  assert.equal(withAlpha(PALETTE.water, Number.NaN), "rgba(74, 107, 124, 0)");
});

test("applyInkOutline owns the canonical ink stroke at zoom scale", () => {
  const context = createMockContext();

  applyInkOutline(context, 2);

  assert.equal(context.strokeStyle, PALETTE.ink);
  assert.equal(context.lineWidth, 0.5);
  assert.equal(context.lineJoin, "round");
  assert.equal(context.lineCap, "round");
});

test("drawFlatDiamondShadow uses a snapped translucent diamond path", () => {
  const context = createMockContext();

  drawFlatDiamondShadow(context, {
    centerX: 10.4,
    centerY: 20.6,
    radiusX: 6.2,
    radiusY: 3.7,
  });

  assert.equal(context.fillStyle, withAlpha(PALETTE.ink, 0.18));
  assert.deepEqual(context.calls, [
    "beginPath",
    "moveTo:10,17",
    "lineTo:17,21",
    "lineTo:10,24",
    "lineTo:4,21",
    "closePath",
    "fill",
  ]);
});
