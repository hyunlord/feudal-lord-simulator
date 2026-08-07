import assert from "node:assert/strict";
import test from "node:test";

import type {
  BuildingConstructionSite,
  PalisadeConstructionSite,
} from "../src/economy/construction";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import {
  constructionCompletionEffects,
  constructionSiteRenderSignature,
  drawConstructionSite,
} from "../src/render/drawConstructionSites";
import { drawPalisadeRun, drawPalisadeSegment } from "../src/render/drawPalisadeSegments";

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let globalAlpha = 1;
  let strokeStyle = "";
  const context = {
    calls,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      calls.push(`fillStyle:${value}`);
    },
    get font() {
      return font;
    },
    set font(value: string) {
      font = value;
      calls.push(`font:${value}`);
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
      calls.push(`globalAlpha:${value}`);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
      calls.push(`strokeStyle:${value}`);
    },
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    fill: () => calls.push("fill"),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: text.length * 8 };
    },
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    rect: (x: number, y: number, width: number, height: number) =>
      calls.push(`rect:${x},${y},${width},${height}`),
    restore: () => calls.push("restore"),
    save: () => calls.push("save"),
    setLineDash: (segments: number[]) => calls.push(`setLineDash:${segments.join(",")}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

test("proposal plot remains visibly distinct at minimum zoom", () => {
  // Given
  const context = loggedContext();

  // When
  drawPalisadeRun(context, {
    path: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    style: "plot",
    zoom: 0.5,
  });

  // Then
  assert.ok(context.calls.includes("setLineDash:8,8"));
  assert.ok(context.calls.includes(`strokeStyle:${SEMANTIC_PALETTE.gold}`));
  assert.equal(context.lineWidth, 4);
});

function site(patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "storehouse",
    tx: 2,
    ty: 1,
    required: { timber: 40 },
    delivered: { timber: 12 },
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
    ...patch,
  };
}

function wallSite(patch: Partial<PalisadeConstructionSite> = {}): PalisadeConstructionSite {
  return {
    ...createPalisadeConstructionSite({
      id: "wall-a-segment-000",
      wallId: "wall-a",
      segmentIndex: 0,
      gateDistance: 0,
      order: 0,
      path: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
      startedTick: 0,
    }),
    ...patch,
  };
}

test("constructionSiteRenderSignature exposes the exact four visual stage names", () => {
  // Given
  const base = site();

  // When / Then
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 0 }), "plot");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 200 }), "foundation");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 440 }), "frame");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 680 }), "roof");
});

test("drawConstructionSite records distinct plot foundation frame and roof signatures with a builder mark", () => {
  // Given
  const stages = [
    site({ builderTicks: 0 }),
    site({ builderTicks: 200 }),
    site({ builderTicks: 440 }),
    site({ builderTicks: 680 }),
  ] as const;

  // When
  const signatures = stages.map((stageSite) => {
    const context = loggedContext();
    drawConstructionSite(context, { site: stageSite, zoom: 0.5 });
    const expectedCalls = new Set([
      "moveTo:48,48",
      "moveTo:88,52",
      "rect:33,44,70,12",
      "moveTo:46,40",
      "rect:41,10,10,40",
      "rect:86,10,10,40",
      "moveTo:36,14",
      "lineTo:69,-10",
      "fillRect:63,37,10,8",
      "fillRect:67,29,2,8",
    ]);
    return context.calls.filter((call) => expectedCalls.has(call));
  });

  // Then
  assert.deepEqual(signatures.map((signature) => signature.slice(-4)), [
    ["moveTo:48,48", "moveTo:88,52", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["rect:33,44,70,12", "moveTo:46,40", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["rect:41,10,10,40", "rect:86,10,10,40", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["moveTo:36,14", "lineTo:69,-10", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
  ]);
});

test("drawConstructionSite writes the exact current stall label with delivered and required counts", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, { site: site(), zoom: 1 });

  // Then
  assert.ok(context.calls.includes("measureText:🪵 목재 오는 중 (12/40)"));
  assert.ok(context.calls.includes("fillText:🪵 목재 오는 중 (12/40),10,-16"));
});

test("drawConstructionSite gives queued palisade segments a dashed gate-order label without a stall label", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, {
    site: wallSite(),
    schedule: { kind: "queued", position: 2 },
    zoom: 1,
  });

  // Then
  assert.ok(context.calls.includes("setLineDash:6,4"));
  assert.ok(context.calls.includes("measureText:성벽 2번째 대기"));
  assert.ok(context.calls.includes("fillText:성벽 2번째 대기,42,0"));
  assert.equal(context.calls.some((call) => call.includes("목재 오는 중")), false);
});

test("drawConstructionSite records four active palisade construction stages along the wall edge", () => {
  // Given
  const stages = [
    wallSite({ builderTicks: 0, delivered: { timber: 60 }, stall: "no_builders" }),
    wallSite({ builderTicks: 30, delivered: { timber: 60 }, stall: "no_builders" }),
    wallSite({ builderTicks: 72, delivered: { timber: 60 }, stall: "none" }),
    wallSite({ builderTicks: 108, delivered: { timber: 60 }, assignedBuilders: 1, stall: "none" }),
  ] as const;

  // When
  const signatures = stages.map((stageSite) => {
    const context = loggedContext();
    drawConstructionSite(context, {
      site: stageSite,
      schedule: { kind: "active" },
      zoom: 1,
    });
    return context.calls;
  });

  // Then
  assert.deepEqual(signatures.map((signature) => signature.includes("moveTo:0,16")), [
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(signatures.map((signature) => signature.includes("lineTo:128,80")), [
    true,
    true,
    true,
    true,
  ]);
  assert.ok(signatures[0]?.includes("setLineDash:4,4"));
  assert.ok(signatures[1]?.includes("fillRect:61,34,7,16"));
  assert.ok(signatures[2]?.includes("fillRect:29,-4,6,38"));
  assert.ok(signatures[2]?.includes("fillRect:93,28,6,38"));
  assert.ok(signatures[3]?.includes("fillRect:61,43,10,8"));
  assert.ok(signatures[3]?.includes("fillRect:65,35,2,8"));
});

test("drawPalisadeSegment renders a completed timber run and exactly one gate marker", () => {
  // Given
  const plainContext = loggedContext();
  const gateContext = loggedContext();
  const segment = {
    id: "wall-a-segment-000",
    order: 0,
    edgePath: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    tileCount: 4,
    completed: true,
    constructionSiteId: null,
  } as const;

  // When
  drawPalisadeSegment(plainContext, {
    segment,
    gate: null,
    zoom: 1,
  });
  drawPalisadeSegment(gateContext, {
    segment,
    gate: { x: 3, y: 1 },
    zoom: 1,
  });

  // Then
  assert.equal(plainContext.calls.filter((call) => call.startsWith("fillRect:")).length, 4);
  assert.equal(gateContext.calls.filter((call) => call.startsWith("fillRect:")).length, 5);
  assert.ok(gateContext.calls.includes("fillRect:61,43,12,16"));
});

test("constructionCompletionEffects derives a short pop and dust from previous and current snapshots only", () => {
  // Given
  const previous = [site({ id: "construction-site-000001", tx: 2, ty: 1 })];
  const current = [site({ id: "construction-site-000002", tx: 5, ty: 1 })];

  // When
  const fresh = constructionCompletionEffects({ previous, current, nowMs: 1_000, startedAtMs: 900 });
  const expired = constructionCompletionEffects({ previous, current, nowMs: 1_101, startedAtMs: 900 });

  // Then
  assert.deepEqual(fresh, [{ id: "construction-site-000001", tx: 2, ty: 1, ageMs: 100 }]);
  assert.deepEqual(expired, []);
  assert.deepEqual(previous.map(({ id }) => id), ["construction-site-000001"]);
});
