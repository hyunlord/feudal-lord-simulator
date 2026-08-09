import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingConstructionSite } from "../src/economy/construction";
import { drawConstructionSite } from "../src/render/drawConstructionSites";

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
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
    drawImage: () => calls.push("drawImage"),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    fill: () => calls.push("fill"),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    measureText: (text: string) => ({ width: text.length * 8 }),
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

function site(patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "storehouse",
    tx: 2,
    ty: 1,
    required: { timber: 40 },
    delivered: { timber: 12 },
    reserved: {},
    builderTicks: 200,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
    ...patch,
  };
}

test("drawConstructionSite falls back to the procedural builder mark when walker builder sprite is unavailable", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, { site: site(), zoom: 0.5 });

  // Then
  assert.ok(!context.calls.includes("drawImage"));
  assert.ok(context.calls.includes("fillRect:63,37,10,8"));
  assert.ok(context.calls.includes("fillRect:67,29,2,8"));
});
