import assert from "node:assert/strict";
import test from "node:test";

import type { ConstructionSite } from "../src/economy/construction";
import {
  constructionCompletionEffects,
  constructionSiteRenderSignature,
  drawConstructionSite,
} from "../src/render/drawConstructionSites";

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
    stroke: () => calls.push("stroke"),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

function site(patch: Partial<ConstructionSite> = {}): ConstructionSite {
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
