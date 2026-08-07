import assert from "node:assert/strict";
import { before, test } from "node:test";

import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import type { GameState } from "../src/engine/engine.types";
import { drawBuildings } from "../src/render/drawBuildings";
import { drawStartingLandmark } from "../src/render/drawStartingLandmarks";
import { drawTerrain } from "../src/render/drawTerrain";
import { drawStumpDescriptor, drawTreeDescriptor } from "../src/render/drawTrees";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import type { StartingLandmark } from "../src/render/startingLandmarks";
import { withAlpha } from "../src/render/style";
import type { TerrainPatternAssets } from "../src/render/terrainPatterns";
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

const noTerrainPatterns: TerrainPatternAssets = {
  meta: () => null,
  sprite: () => null,
};

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let globalAlpha = 1;
  let imageSmoothingEnabled = true;
  let fillStyle = "";
  let font = "";
  let strokeStyle = "";
  const context = {
    canvas: { width: 512, height: 512 },
    calls,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      calls.push(`fillStyle:${value}`);
    },
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
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
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
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
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  };
}

function drawHouseAtZoom(zoom: number): LoggedContext {
  const context = loggedContext();
  const gameState = state();
  const tiles = [tile(0, 0, "grass", "house")];
  const range = { minTx: 0, minTy: 0, maxTx: 0, maxTy: 0 };
  const objectRenderItems = buildObjectRenderItems({
    tiles,
    worldTiles: gameState.tiles,
    buildings: gameState.buildings,
    walkers: gameState.walkers,
    range,
    seed: gameState.seed,
  });
  drawTerrain(context, {
    state: gameState,
    tiles,
    range,
    zoom,
    objectRenderItems,
    terrainPatterns: noTerrainPatterns,
  });
  drawBuildings(context, {
    state: gameState,
    tiles,
    range,
    zoom,
    camera: { zoom, panX: 200, panY: 120 },
    viewport: { width: 512, height: 512 },
    dpr: 1,
    objectRenderItems,
  });
  return context;
}

before(async () => {
  Object.defineProperty(globalThis, "Image", { configurable: true, value: ReadyImage });
  await preloadWorldAssets();
});

test("sprite-success building rendering keeps ground-pass contact before the sprite", () => {
  // Given
  const context = drawHouseAtZoom(0.7001);

  // Then
  const firstDrawImage = context.calls.indexOf("drawImage");
  const priorEllipses = context.calls
    .slice(0, firstDrawImage)
    .filter((call) => call.startsWith("ellipse:"));
  assert.notEqual(firstDrawImage, -1);
  assert.deepEqual(priorEllipses.slice(-3), [
    "ellipse:-4,13,33,12",
    "ellipse:0,10,23,10",
    "ellipse:0,10,14,3",
  ]);
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

test("renderer-only ford landmark draws visible water stones and label", () => {
  // Given
  const context = loggedContext();
  const landmark = { kind: "ford", tx: 53, ty: 41, label: "나루터" } as const satisfies StartingLandmark;

  // When
  drawStartingLandmark(context, landmark, 1);

  // Then
  assert.ok(context.calls.includes(`fillStyle:${withAlpha(SEMANTIC_PALETTE.water, 0.72)}`));
  assert.ok(context.calls.includes(`fillStyle:${SEMANTIC_PALETTE.stone}`));
  assert.ok(context.calls.includes(`fillStyle:${PALETTE.ink}`));
  assert.ok(context.calls.some((call) => call.startsWith("fillText:나루터,")));
});

test("visible missing tree and stump sprites fall back to procedural marks", () => {
  // Given
  const context = loggedContext();

  // When
  drawTreeDescriptor(context, {
    tick: 0,
    tree: {
      id: "tree:missing",
      x: 0,
      y: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      silhouette: "rounded",
      tone: SEMANTIC_PALETTE.forest,
      phase: 0,
      sortY: 0,
      anchorTx: 0,
      anchorTy: 0,
      spriteKey: "tree_oak_large",
    },
    zoom: 1,
    spriteOptions: { camera: { zoom: 1, panX: -10_000, panY: -10_000 }, viewport: { width: 64, height: 64 } },
  });
  drawStumpDescriptor(context, {
    descriptor: {
      id: "stump:missing",
      x: 20,
      y: 20,
      scale: 1,
      sortY: 20,
      anchorTx: 0,
      anchorTy: 0,
      spriteKey: "stump_fresh",
    },
    zoom: 1,
    spriteOptions: { camera: { zoom: 1, panX: -10_000, panY: -10_000 }, viewport: { width: 64, height: 64 } },
  });

  // Then
  assert.equal(context.calls.includes("drawImage"), false);
  assert.ok(context.calls.includes(`fillStyle:${SEMANTIC_PALETTE.forest}`));
  assert.ok(context.calls.includes(`fillStyle:${SEMANTIC_PALETTE.earthDark}`));
  assert.ok(context.calls.some((call) => call.startsWith("ellipse:0,-28,")));
  assert.ok(context.calls.includes("ellipse:20,17,11,5"));
});
