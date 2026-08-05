import assert from "node:assert/strict";
import { before, test } from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { drawBuildings } from "../src/render/drawBuildings";
import { preloadWorldAssets } from "../src/render/worldAssets";
import type { Tile } from "../src/world/world.types";

class ReadyImage {
  onload: ((event: Event) => unknown) | null = null;
  onerror: OnErrorEventHandler = null;
  #src = "";

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => this.onload?.(new Event("load")));
  }
}

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let globalAlpha = 1;
  let imageSmoothingEnabled = true;
  const context = {
    canvas: { width: 512, height: 512 },
    calls,
    fillStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    strokeStyle: "",
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
      calls.push(`globalAlpha:${value}`);
    },
    get imageSmoothingEnabled() {
      return imageSmoothingEnabled;
    },
    set imageSmoothingEnabled(value: boolean) {
      imageSmoothingEnabled = value;
      calls.push(`smoothing:${value}`);
    },
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) =>
      calls.push(`setTransform:${a},${b},${c},${d},${e},${f}`),
    drawImage: () => calls.push("drawImage"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    rect: (x: number, y: number, width: number, height: number) =>
      calls.push(`rect:${x},${y},${width},${height}`),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    arc: (x: number, y: number, radius: number) => calls.push(`arc:${x},${y},${radius}`),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

function tile(
  tx: number,
  ty: number,
  terrain: Tile["terrain"] = "grass",
  buildingId: string | null = null,
): Tile {
  return { tx, ty, terrain, buildingId, hasRoad: false };
}

function state(): GameState {
  return {
    width: 4,
    height: 4,
    tiles: [tile(0, 0, "grass", "house")],
    tick: 0,
    seed: 1,
    treasuryTimber: 0,
    buildings: [{
      id: "house",
      kind: "house",
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    }],
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function drawHouseAtZoom(zoom: number): LoggedContext {
  const context = loggedContext();
  drawBuildings(context, {
    state: state(),
    tiles: [tile(0, 0, "grass", "house")],
    range: { minTx: 0, minTy: 0, maxTx: 0, maxTy: 0 },
    zoom,
    camera: { zoom, panX: 200, panY: 120 },
    viewport: { width: 512, height: 512 },
    dpr: 1,
  });
  return context;
}

before(async () => {
  Object.defineProperty(globalThis, "Image", { configurable: true, value: ReadyImage });
  await preloadWorldAssets();
});

test("sprite-success building rendering keeps the procedural contact shadow", () => {
  // Given
  const context = drawHouseAtZoom(0.7001);

  // Then
  assert.ok(context.calls.includes("drawImage"));
  assert.deepEqual(
    context.calls.slice(0, 7),
    ["beginPath", "moveTo:0,1", "lineTo:22,10", "lineTo:0,19", "lineTo:-22,10", "closePath", "fill"],
  );
});

test("exact simplified LOD keeps ready building sprites on the procedural path", () => {
  // Given / When
  const context = drawHouseAtZoom(0.7);

  // Then
  assert.ok(!context.calls.includes("drawImage"));
});

test("full LOD just above the simplified boundary may use ready building sprites", () => {
  // Given / When
  const context = drawHouseAtZoom(0.7001);

  // Then
  assert.ok(context.calls.includes("drawImage"));
});
