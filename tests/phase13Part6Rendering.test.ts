import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { BuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { resolveCanvasKeyDown } from "../src/render/canvasKeyboardResolution";
import { constructionSiteRenderSignature, drawConstructionSite } from "../src/render/drawConstructionSites";
import { drawObjectRenderItems } from "../src/render/drawObjectRenderItems";
import { getObjectRenderViewMode, toggleObjectRenderViewMode } from "../src/render/objectRenderViewMode";
import type { RenderQueueItem } from "../src/render/objectRenderOrder";

type LoggedContext = CanvasRenderingContext2D & { readonly calls: readonly string[] };

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let globalAlpha = 1;
  let strokeStyle = "";
  const context = {
    calls,
    canvas: { width: 400, height: 300 },
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
    imageSmoothingEnabled: true,
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    arc: (x: number, y: number, radius: number) => calls.push(`arc:${x},${y},${radius}`),
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
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: text.length * 8 };
    },
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    rect: (x: number, y: number, width: number, height: number) =>
      calls.push(`rect:${x},${y},${width},${height}`),
    restore: () => calls.push("restore"),
    save: () => calls.push("save"),
    setTransform: () => calls.push("setTransform"),
    setLineDash: (segments: number[]) => calls.push(`setLineDash:${segments.join(",")}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

function constructionSite(patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
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

function building(id: string, patch: Partial<Building> = {}): Building {
  return {
    id,
    kind: "house",
    tx: 1,
    ty: 1,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
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

function state(input: { readonly buildings?: readonly Building[]; readonly walkers?: readonly Walker[] } = {}): GameState {
  return {
    tick: 0,
    seed: 1,
    width: 4,
    height: 4,
    tiles: [],
    buildings: [...(input.buildings ?? [])],
    constructionSites: [],
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

test("constructionSiteRenderSignature changes bands at 25 55 and 85 percent", () => {
  // Given
  const base = constructionSite({ requiredBuilderTicks: 100 });

  // When / Then
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 24 }), "plot");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 25 }), "foundation");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 54 }), "foundation");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 55 }), "frame");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 84 }), "frame");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 85 }), "roof");
});

test("drawConstructionSite gives each building stage a dense visible procedural band", () => {
  // Given
  const stages = [
    constructionSite({ builderTicks: 0 }),
    constructionSite({ builderTicks: 200 }),
    constructionSite({ builderTicks: 440 }),
    constructionSite({ builderTicks: 680 }),
  ] as const;

  // When
  const callsByStage = stages.map((stageSite) => {
    const context = loggedContext();
    drawConstructionSite(context, { site: stageSite, zoom: 1 });
    return context.calls;
  });

  // Then
  assert.ok(callsByStage[0]?.includes("fillRect:40,34,3,18"), "plot has visible stakes");
  assert.ok(callsByStage[0]?.includes("lineTo:96,36"), "plot has rope bounds");
  assert.ok(callsByStage[0]?.includes("fillRect:74,43,16,6"), "plot has staged material");
  assert.ok(callsByStage[1]?.includes("rect:37,42,22,8"), "foundation has separated footings");
  assert.ok(callsByStage[1]?.includes("fillRect:91,36,12,10"), "foundation has material pile");
  assert.ok(callsByStage[2]?.includes("rect:58,21,20,24"), "frame has partial wall fill");
  assert.ok(callsByStage[2]?.includes("moveTo:34,31"), "frame has scaffold rails");
  assert.ok(callsByStage[3]?.includes("moveTo:36,14"), "roof has roof triangle");
  assert.ok(callsByStage[3]?.includes("rect:94,15,4,38"), "roof keeps scaffold visible");
});

test("drawConstructionSite uses presentation progress to reveal the interpolated stage", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, {
    site: constructionSite({ builderTicks: 0, requiredBuilderTicks: 100 }),
    zoom: 1,
    presentationProgress: 0.9,
  });

  // Then
  assert.ok(context.calls.includes("moveTo:36,14"), "90% presentation progress draws the roof band");
  assert.equal(
    context.calls.includes("fillRect:40,34,3,18"),
    false,
    "the stale simulation stage does not leak into the interpolated frame",
  );
});

test("drawObjectRenderItems feeds frame interpolation into construction rendering", () => {
  // Given
  const context = loggedContext();
  const activeSite = constructionSite({ builderTicks: 0, requiredBuilderTicks: 100 });
  const item = {
    kind: "construction_site",
    id: activeSite.id,
    site: activeSite,
    schedule: { kind: "active" },
    depth: 0,
    anchorTx: activeSite.tx,
  } as const satisfies RenderQueueItem;

  // When
  drawObjectRenderItems(context, {
    state: state(),
    tiles: [],
    range: { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 },
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 400, height: 300 },
    objectRenderItems: [item],
    constructionProgress: new Map([[activeSite.id, 0.9]]),
  });

  // Then
  assert.ok(context.calls.includes("moveTo:36,14"));
  assert.equal(context.calls.includes("fillRect:40,34,3,18"), false);
});

test("drawObjectRenderItems defers walkers until after buildings so they are never occluded", () => {
  // Given
  const context = loggedContext();
  const house = building("house-a");
  const walker = builderWalker("builder-a");
  const items = [
    { kind: "walker", id: walker.id, walker, depth: 0, anchorTx: 0 },
    { kind: "building", id: house.id, building: house, depth: 999, anchorTx: 9 },
  ] as const satisfies readonly RenderQueueItem[];

  // When
  drawObjectRenderItems(context, {
    state: state({ buildings: [house], walkers: [walker] }),
    tiles: [],
    range: { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 },
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 400, height: 300 },
    objectRenderItems: items,
  });

  // Then
  const firstBuildingFill = context.calls.findIndex((call) => call === "fill");
  const proceduralWalker = context.calls.findIndex((call, index, calls) =>
    call === "fillStyle:#C9A227"
    && calls[index + 1] === "fillRect:-4,17,8,14"
    && calls[index + 2] === "strokeStyle:#2A2118",
  );
  assert.ok(firstBuildingFill >= 0);
  assert.ok(proceduralWalker > firstBuildingFill);
});

test("drawObjectRenderItems fades the building that overlaps the cursor tile to fifty five percent", () => {
  // Given
  const context = loggedContext();
  const house = building("house-a");

  // When
  drawObjectRenderItems(context, {
    state: state({ buildings: [house] }),
    tiles: [],
    range: { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 },
    zoom: 1,
    camera: { zoom: 1, panX: 0, panY: 0 },
    dpr: 1,
    viewport: { width: 400, height: 300 },
    hoveredTile: { tx: 1, ty: 1 },
    objectRenderItems: [{ kind: "building", id: house.id, building: house, depth: 0, anchorTx: 1 }],
  });

  // Then
  assert.ok(context.calls.includes("globalAlpha:0.55"));
  assert.ok(context.calls.includes("globalAlpha:1"));
});

test("outlines view mode is off by default and toggled by one keyboard key", () => {
  // Given
  const initial = getObjectRenderViewMode();

  // When
  const result = resolveCanvasKeyDown({
    code: "KeyO",
    key: "o",
    camera: { zoom: 1, panX: 0, panY: 0 },
    spacePressed: false,
    viewport: { width: 400, height: 300 },
    world: { minX: 0, minY: 0, maxX: 128, maxY: 128 },
  });
  toggleObjectRenderViewMode(result.toggleOutlinesView);

  // Then
  assert.equal(initial, "normal");
  assert.equal(result.toggleOutlinesView, true);
  assert.equal(result.preventDefault, true);
  assert.equal(getObjectRenderViewMode(), "outlines");

  // Cleanup
  toggleObjectRenderViewMode(true);
});

test("outlines view mode restores solid alpha before stroking building silhouettes", () => {
  // Given
  if (getObjectRenderViewMode() === "normal") toggleObjectRenderViewMode(true);
  const context = loggedContext();
  const house = building("house-a");

  try {
    // When
    drawObjectRenderItems(context, {
      state: state({ buildings: [house] }),
      tiles: [],
      range: { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 },
      zoom: 1,
      camera: { zoom: 1, panX: 0, panY: 0 },
      dpr: 1,
      viewport: { width: 400, height: 300 },
      objectRenderItems: [{ kind: "building", id: house.id, building: house, depth: 0, anchorTx: 1 }],
    });

    // Then
    const fillAlpha = context.calls.indexOf("globalAlpha:0.4");
    const fill = context.calls.indexOf("fill");
    const solidAlpha = context.calls.indexOf("globalAlpha:1");
    const strokeStyle = context.calls.indexOf("strokeStyle:#2A2118");
    const stroke = context.calls.indexOf("stroke");
    assert.ok(fillAlpha >= 0 && fillAlpha < fill);
    assert.ok(fill < solidAlpha && solidAlpha < strokeStyle && strokeStyle < stroke);
  } finally {
    if (getObjectRenderViewMode() === "outlines") toggleObjectRenderViewMode(true);
  }
});
