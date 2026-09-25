import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import type { BuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { drawObjectRenderItems } from "../src/render/drawObjectRenderItems";
import {
  buildingSpriteOverlapsCursorTile,
  OBJECT_OUTLINE_ALPHA,
  setObjectRenderViewMode,
} from "../src/render/occlusionModel";
import type { RenderQueueItem } from "../src/render/objectRenderOrder";
import { EconomyOverlayControls } from "../src/ui/EconomyOverlayControls";
import type { Tile } from "../src/world/world.types";

type LoggedContext = CanvasRenderingContext2D & { readonly calls: readonly string[] };

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let globalAlpha = 1;
  let strokeStyle = "";
  const context = {
    calls,
    canvas: { width: 600, height: 400 },
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; calls.push(`fillStyle:${value}`); },
    get font() { return font; },
    set font(value: string) { font = value; calls.push(`font:${value}`); },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value: number) { globalAlpha = value; calls.push(`globalAlpha:${value}`); },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(value: string) { strokeStyle = value; calls.push(`strokeStyle:${value}`); },
    imageSmoothingEnabled: true,
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    arc: (x: number, y: number, radius: number) => calls.push(`arc:${x},${y},${radius}`),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    clip: () => calls.push("clip"),
    drawImage: () => calls.push("drawImage"),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    fill: () => calls.push("fill"),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
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
    setLineDash: (segments: readonly number[]) => calls.push(`setLineDash:${segments.join(",")}`),
    setTransform: () => calls.push("setTransform"),
    stroke: () => calls.push("stroke"),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

function lastIndexWhere<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return index;
  }
  return -1;
}

function building(id: string, tx: number, ty: number, patch: Partial<Building> = {}): Building {
  return {
    id,
    kind: "house",
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function constructionSite(patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
  return {
    id: "site-a",
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

function builderWalker(id: string): Walker {
  return {
    id,
    kind: "builder",
    homeBuildingId: "house-a",
    siteId: "site-a",
    slotIndex: 0,
    position: { tx: 1, ty: 1 },
    path: [{ tx: 1, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
  };
}

function cargoWalker(id: string): Walker {
  return {
    id,
    kind: "carter",
    homeBuildingId: "mill-a",
    destination: { kind: "building", buildingId: "house-a" },
    mission: "deliver",
    phase: "outbound",
    position: { tx: 2, ty: 1 },
    path: [{ tx: 2, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 3 },
    spawnedTick: 0,
    reservation: {
      destination: { kind: "building", buildingId: "house-a" },
      resource: "bread",
      amount: 3,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    cancellation: null,
  };
}

function tile(tx: number, ty: number, hasRoad = false): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad };
}

function state(input: {
  readonly buildings?: readonly Building[];
  readonly walkers?: readonly Walker[];
  readonly constructionSites?: readonly BuildingConstructionSite[];
  readonly tiles?: readonly Tile[];
} = {}): GameState {
  return {
    tick: 0,
    seed: 1,
    width: 8,
    height: 8,
    tiles: [...(input.tiles ?? [])],
    buildings: [...(input.buildings ?? [])],
    constructionSites: [...(input.constructionSites ?? [])],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [...(input.walkers ?? [])],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  };
}

const range = { minTx: 0, minTy: 0, maxTx: 7, maxTy: 7 } as const;

test("Given an intentionally misordered render queue When drawing objects Then no-cargo and cargo walkers render after buildings and construction", () => {
  // Given
  const house = building("house-a", 1, 1);
  const site = constructionSite();
  const noCargo = builderWalker("builder-a");
  const cargo = cargoWalker("carter-a");
  const items = [
    { kind: "walker", id: noCargo.id, walker: noCargo, depth: 0, anchorTx: 0 },
    { kind: "construction_site", id: site.id, site, schedule: { kind: "active" }, depth: 900, anchorTx: 9 },
    { kind: "walker", id: cargo.id, walker: cargo, depth: 1, anchorTx: 1 },
    { kind: "building", id: house.id, building: house, depth: 999, anchorTx: 9 },
  ] as const satisfies readonly RenderQueueItem[];
  const context = loggedContext();

  // When
  drawObjectRenderItems(context, {
    state: state({ buildings: [house], constructionSites: [site], walkers: [noCargo, cargo] }),
    tiles: [],
    range,
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 600, height: 400 },
    objectRenderItems: items,
  });

  // Then
  const lastSiteOrBuilding = Math.max(
    // F0-V: a site with a state draws its plaque (name and line) instead of the stall label; walkers draw no text.
    lastIndexWhere(context.calls, (call) => call.startsWith("fillText:")),
    lastIndexWhere(context.calls, (call) => call === "lineTo:60,48"),
  );
  const firstWalkerBody = context.calls.findIndex((call, index) =>
    index > lastSiteOrBuilding && call === `fillStyle:${PALETTE.gold}`
  );
  const cargoBox = context.calls.findIndex((call, index) =>
    index > firstWalkerBody && call.startsWith("fillRect:") && call.endsWith(",3,3")
  );
  assert.ok(lastSiteOrBuilding >= 0);
  assert.ok(firstWalkerBody > lastSiteOrBuilding);
  assert.ok(cargoBox > firstWalkerBody);
  assert.equal(context.lineWidth, 1, "walker outline remains one CSS pixel at 1x without relying on cargo");
});

test("Given a tall sprite overhangs beyond its footprint When hovering an actually overlapped cursor diamond Then the normal view keeps its occlusion opaque", () => {
  // Given
  const overhanging = building("house-overhang", 1, 1);
  const far = building("house-far", 5, 5);
  const context = loggedContext();

  // When
  drawObjectRenderItems(context, {
    state: state({ buildings: [overhanging, far] }),
    tiles: [],
    range,
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 600, height: 400 },
    hoveredTile: { tx: 0, ty: 1 },
    objectRenderItems: [
      { kind: "building", id: overhanging.id, building: overhanging, depth: 0, anchorTx: 1 },
      { kind: "building", id: far.id, building: far, depth: 10, anchorTx: 5 },
    ],
  });

  // Then
  assert.equal(buildingSpriteOverlapsCursorTile({
    building: overhanging,
    houseLevel: 0,
    hoveredTile: { tx: 0, ty: 1 },
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
  }), true);
  assert.equal(buildingSpriteOverlapsCursorTile({
    building: far,
    houseLevel: 0,
    hoveredTile: { tx: 0, ty: 1 },
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
  }), false);
  assert.equal(context.calls.filter((call) => call === "globalAlpha:0.5").length, 0);
  assert.equal(context.calls.includes("globalAlpha:0.55"), false);
});

test("Given a dense neighborhood When hovering a roof in normal view Then buildings do not become translucent", () => {
  const buildings = Array.from({ length: 7 }, (_, index) => building(`dense-${index}`, index % 5, Math.floor(index / 5)));
  const context = loggedContext();
  drawObjectRenderItems(context, {
    state: state({ buildings }), tiles: [], range, zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 }, dpr: 1,
    viewport: { width: 600, height: 400 }, hoveredTile: { tx: 0, ty: 0 },
    objectRenderItems: buildings.map(home => ({ kind: "building", id: home.id, building: home, depth: home.tx + home.ty, anchorTx: home.tx })),
  });
  for (const alpha of [0.4, 0.5, 0.8]) assert.equal(context.calls.includes(`globalAlpha:${alpha}`), false);
});

test("Given roads are under tall object overhang When drawing objects Then the road ground pass runs before upright buildings and walkers", () => {
  // Given
  const house = building("house-a", 1, 1);
  const walker = builderWalker("builder-a");
  const roadTile = tile(1, 0, true);
  const context = loggedContext();

  // When
  drawObjectRenderItems(context, {
    state: state({ buildings: [house], walkers: [walker], tiles: [roadTile] }),
    tiles: [roadTile],
    range,
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 600, height: 400 },
    objectRenderItems: [
      { kind: "building", id: house.id, building: house, depth: 0, anchorTx: 1 },
      { kind: "walker", id: walker.id, walker, depth: 1, anchorTx: 1 },
    ],
  });

  // Then
  const buildingFill = context.calls.indexOf("stroke");
  const roadAlpha = context.calls.indexOf("globalAlpha:0.72");
  const roadCore = context.calls.findIndex((call, index) => index > roadAlpha && call === `fillStyle:${SEMANTIC_PALETTE.earth}`);
  const walkerBody = context.calls.findIndex((call) => call === `fillStyle:${PALETTE.gold}`);
  assert.ok(buildingFill >= 0);
  assert.ok(roadAlpha < buildingFill);
  assert.ok(roadCore > roadAlpha);
  assert.ok(walkerBody > roadCore);
});

test("Given outlines view is enabled When drawing mixed world objects Then buildings construction sites and walkers use exactly thirty five percent silhouette alpha", () => {
  // Given
  const house = building("house-a", 1, 1);
  const site = constructionSite();
  const walker = builderWalker("builder-a");
  const context = loggedContext();

  try {
    setObjectRenderViewMode("outlines");

    // When
    drawObjectRenderItems(context, {
      state: state({ buildings: [house], constructionSites: [site], walkers: [walker] }),
      tiles: [tile(1, 1, true)],
      range,
      zoom: 1,
      camera: { zoom: 1, panX: 0, panY: 0 },
      dpr: 1,
      viewport: { width: 600, height: 400 },
      hoveredTile: { tx: 1, ty: 1 },
      objectRenderItems: [
        { kind: "building", id: house.id, building: house, depth: 0, anchorTx: 1 },
        { kind: "construction_site", id: site.id, site, schedule: { kind: "active" }, depth: 1, anchorTx: 2 },
        { kind: "walker", id: walker.id, walker, depth: 2, anchorTx: 1 },
      ],
    });
  } finally {
    setObjectRenderViewMode("normal");
  }

  // Then
  assert.equal(OBJECT_OUTLINE_ALPHA, 0.35);
  assert.ok(context.calls.filter((call) => call === "globalAlpha:0.35").length >= 3);
  assert.equal(context.calls.includes("globalAlpha:0.5"), false);
  assert.equal(context.calls.includes("globalAlpha:0.4"), false);
});

test("Given the console renders view controls When outlines are available Then a clearly labelled Korean O-key control is exposed outside GameState", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(EconomyOverlayControls, {
      overlayMode: "none",
      onChange: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /윤곽/);
  assert.match(markup, /건물·공사·사람 윤곽/);
  assert.match(markup, />O<\/span>/);
}
);

test("selection mode draws only a footprint outline for an occluding foreground building", () => {
  const home = building("front", 1, 1);
  const context = loggedContext();
  drawObjectRenderItems(context, {
    state: state({ buildings: [home] }), tiles: [], range, zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 }, dpr: 1,
    viewport: { width: 600, height: 400 }, hoveredTile: { tx: 0, ty: 1 }, selectionMode: true,
    objectRenderItems: [{ kind: "building", id: home.id, building: home, depth: 2, anchorTx: 1 }],
  });
  assert.equal(context.calls.includes("drawImage"), false);
  assert.equal(context.calls.includes("fill"), false);
  assert.equal(context.calls.includes("stroke"), true);
  assert.equal(context.calls.some(call => call.startsWith("globalAlpha:")), false);
});

test("global outlines retain their silhouette when selection hovers behind a foreground house", () => {
  const home = building("front", 1, 1);
  const context = loggedContext();
  try {
    setObjectRenderViewMode("outlines");
    drawObjectRenderItems(context, {
      state: state({ buildings: [home] }), tiles: [], range, zoom: 1,
      camera: { zoom: 1, panX: 0, panY: 0 }, dpr: 1,
      viewport: { width: 600, height: 400 }, hoveredTile: { tx: 0, ty: 1 }, selectionMode: true,
      objectRenderItems: [{ kind: "building", id: home.id, building: home, depth: 2, anchorTx: 1 }],
    });
  } finally { setObjectRenderViewMode("normal"); }
  assert.ok(context.calls.includes("globalAlpha:0.35"));
  assert.ok(context.calls.includes("fill"));
});
