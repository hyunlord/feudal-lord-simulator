import assert from "node:assert/strict";
import { before, test } from "node:test";

import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../src/content/buildingConfig";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import type { GameState } from "../src/engine/engine.types";
import { drawBuildings } from "../src/render/drawBuildings";
import { drawTerrain } from "../src/render/drawTerrain";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
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
    treasuryCoin: 0,
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
  assert.notEqual(firstDrawImage, -1);
  const contactStart = context.calls.indexOf(`fillStyle:${withAlpha(SEMANTIC_PALETTE.earthDark, 0.26)}`);
  assert.ok(contactStart >= 0 && contactStart < firstDrawImage);
  assert.deepEqual(context.calls.slice(contactStart, contactStart + 9), [
    `fillStyle:${withAlpha(SEMANTIC_PALETTE.earthDark, 0.26)}`,
    "beginPath",
    "moveTo:-12,-4",
    "lineTo:-2,-8",
    "lineTo:11,-3",
    "lineTo:5,1",
    "lineTo:-7,2",
    "closePath",
    "fill",
  ]);
  assert.ok(!context.calls.slice(0, firstDrawImage).some((call) => call.startsWith("ellipse:")));
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

test("Stone Town fallback sprite keys cover all new render kinds when manifest images are absent", () => {
  // Given
  const newKindState = state();
  const buildings: GameState["buildings"] = [
    {
      id: "house-l4",
      kind: "house",
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
    {
      id: "quarry",
      kind: "quarry",
      tx: 1,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
    {
      id: "masonry",
      kind: "masonry",
      tx: 2,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
    {
      id: "market",
      kind: "market",
      tx: 3,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
    {
      id: "church",
      kind: "church",
      tx: 4,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
    {
      id: "keep",
      kind: "keep",
      tx: 5,
      ty: 0,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
  ];
  const context = loggedContext();

  // When
  drawBuildings(context, {
    state: {
      ...newKindState,
      era: "stone_town",
      buildings,
      houses: [{ buildingId: "house-l4", level: 4, residents: 32, hasWater: true, breadStock: 1, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    },
    tiles: [tile(0, 0, "grass", "house-l4")],
    range: { minTx: 0, minTy: 0, maxTx: 6, maxTy: 1 },
    zoom: 0.7,
  });

  // Then
  assert.equal(context.calls.includes("drawImage"), false);
  assert.equal(context.calls.filter((call) => call === "fill").length >= buildings.length, true);
});

function drawCivicAtZoom(kind: BuildingKind, zoom: number, connected = false): LoggedContext {
  const context = loggedContext();
  const initial = state();
  const original = initial.buildings[0];
  assert.ok(original);
  const building = { ...original, kind };
  const size = BUILDING_CONFIG_BY_KIND[kind];
  const tiles = Array.from({ length: 16 }, (_, index) => {
    const tx = index % 4;
    const ty = Math.floor(index / 4);
    return { ...tile(tx, ty, "grass", tx < size.width && ty < size.height ? building.id : null),
      hasRoad: connected && tx === size.width && ty === 0 };
  });
  const gameState: GameState = { ...initial, buildings: [building], tiles };
  const range = { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 };
  const objectRenderItems = buildObjectRenderItems({ tiles, worldTiles: tiles, buildings: gameState.buildings,
    walkers: [], range, seed: gameState.seed });
  drawTerrain(context, { state: gameState, tiles, range, zoom, objectRenderItems, terrainPatterns: noTerrainPatterns });
  drawBuildings(context, { state: gameState, tiles, range, zoom,
    camera: { zoom, panX: 200, panY: 120 }, viewport: { width: 512, height: 512 }, dpr: 1, objectRenderItems });
  return context;
}

test("ready civic and production sprites use compact footprint contact before their art", () => {
  for (const kind of ["well", "storehouse", "granary", "logging_camp", "sawmill"] as const) {
    // Given ready accepted sprites, when rendering full detail.
    const context = drawCivicAtZoom(kind, 1);
    // Then footprint contact precedes the art without a broad ellipse underneath.
    const sprite = context.calls.indexOf("drawImage");
    const contact = context.calls.indexOf(`fillStyle:${withAlpha(SEMANTIC_PALETTE.earthDark, 0.24)}`);
    assert.ok(sprite > 0 && contact >= 0 && contact < sprite, kind);
    assert.ok(!context.calls.slice(0, sprite).some(call => call.startsWith("ellipse:")), kind);
  }
});

test("simplified civic and production buildings preserve procedural grounding", () => {
  for (const kind of ["well", "storehouse", "granary", "logging_camp", "sawmill"] as const) {
    // Given simplified detail, when rendering the same buildings.
    const context = drawCivicAtZoom(kind, 0.7);
    // Then ordinary grounding remains and no full-detail sprite is drawn.
    assert.ok(context.calls.some(call => call.startsWith("ellipse:")), kind);
    assert.ok(!context.calls.includes("drawImage"), kind);
  }
});


test("building access remains visibly earthen when terrain patterns are unavailable", () => {
  // Given a well with a real adjacent road and no loaded terrain textures.
  const earthPrefix = `fillStyle:${withAlpha(SEMANTIC_PALETTE.earth, 0).replace(/0\)$/, "")}`;
  // When rendering its frontage through the real ground pass.
  const context = drawCivicAtZoom("well", 1, true);
  // Then the narrow access has a strong earth centre in addition to its faint edge.
  const opacities = context.calls.filter(call => call.startsWith(earthPrefix))
    .map(call => Number(call.slice(earthPrefix.length, -1)));
  assert.ok(opacities.some(opacity => opacity >= 0.65 && opacity <= 0.8));
  assert.ok(opacities.some(opacity => opacity >= 0.16 && opacity <= 0.28));
});
