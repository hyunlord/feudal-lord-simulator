import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import {
  applyInkOutline,
  drawFlatDiamondShadow,
  drawGroundingShadow,
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
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number): void;
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
    ellipse: (x: number, y: number, radiusX: number, radiusY: number) =>
      calls.push(`ellipse:${x},${y},${radiusX},${radiusY}`),
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
  assert.equal(shade(PALETTE.gold, 0.8), "#A1821F");
  assert.equal(shade(SEMANTIC_PALETTE.parchment, 0.8), "#B0A99A");
  assert.equal(shade(PALETTE.ink, 0.8), "#221A13");
});

test("withAlpha derives translucent colours from the canonical palette", () => {
  assert.equal(withAlpha(PALETTE.ink, 0.18), "rgba(42, 33, 24, 0.18)");
  assert.equal(withAlpha(SEMANTIC_PALETTE.snow, 1.25), "rgba(239, 232, 216, 1)");
  assert.equal(withAlpha(PALETTE.vermilion, -0.2), "rgba(168, 50, 50, 0)");
  assert.equal(withAlpha(SEMANTIC_PALETTE.water, Number.NaN), "rgba(77, 117, 138, 0)");
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

test("drawGroundingShadow stacks warm ellipses plus a separate contact band", () => {
  const context = createMockContext();

  drawGroundingShadow(context, {
    centerX: 10,
    centerY: 20,
    height: 96,
    scale: 0.75,
    baseRadiusX: 14,
    baseRadiusY: 5,
  });

  assert.deepEqual(context.calls, [
    "beginPath",
    "ellipse:7,22,23,8",
    "fill",
    "beginPath",
    "ellipse:10,20,17,6",
    "fill",
    "beginPath",
    "ellipse:10,20,10,2",
    "fill",
  ]);
  assert.equal(context.fillStyle, withAlpha(PALETTE.ink, 0.18));
});

test("drawGroundingShadow exposes the darker earth core at alpha 0.32", () => {
  const fillStyles: string[] = [];
  const context = {
    ...createMockContext(),
    set fillStyle(value: string) {
      fillStyles.push(value);
    },
    get fillStyle() {
      return fillStyles.at(-1) ?? "";
    },
  };

  drawGroundingShadow(context, {
    centerX: 10,
    centerY: 20,
    height: 96,
    scale: 0.75,
    baseRadiusX: 14,
    baseRadiusY: 5,
  });

  assert.deepEqual(fillStyles, [
    withAlpha(SEMANTIC_PALETTE.earth, 0.16),
    withAlpha(SEMANTIC_PALETTE.earthDark, 0.32),
    withAlpha(PALETTE.ink, 0.18),
  ]);
});
