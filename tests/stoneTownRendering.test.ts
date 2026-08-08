import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import type { PalisadeSegment } from "../src/engine/engine.types";
import { hashEconomyState } from "../scripts/economyHarness";
import { drawBuildings } from "../src/render/drawBuildings";
import { drawPalisadeSegment } from "../src/render/drawPalisadeSegments";
import { buildingSpriteKey } from "../src/render/buildingSprites";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import type { GameState } from "../src/engine/engine.types";
import type { Tile } from "../src/world/world.types";

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  const context = {
    canvas: { width: 800, height: 600 },
    calls,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      calls.push(`fillStyle:${value}`);
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
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
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

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function tile(tx: number, ty: number, terrain: Tile["terrain"] = "grass", buildingId: string | null = null): Tile {
  return { tx, ty, terrain, buildingId, hasRoad: false };
}

function state(buildings: readonly Building[]): GameState {
  return {
    tick: 0,
    seed: 1,
    tiles: [
      tile(0, 0, "grass", "quarry"),
      tile(1, 0, "grass", "quarry"),
      tile(2, 0, "grass", "masonry"),
      tile(3, 0, "grass", "market"),
      tile(4, 0, "grass", "church"),
      tile(5, 0, "grass", "keep"),
      tile(6, 0, "grass", "house-l4"),
    ],
    width: 8,
    height: 4,
    buildings: [...buildings],
    constructionSites: [],
    houses: [{ buildingId: "house-l4", level: 4, residents: 32, hasWater: true, breadStock: 10, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    walkers: [],
    population: 32,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    wallTick: 0,
    era: "stone_town",
    eraProclaimedTick: 0,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 0,
    pathCache: {},
  };
}

function segment(material: "timber" | "stone"): PalisadeSegment {
  return {
    id: `segment-${material}`,
    order: 0,
    gateDistance: 0,
    edgePath: [{ x: 1, y: 1 }, { x: 3, y: 1 }],
    tileCount: 2,
    completed: true,
    constructionSiteId: null,
    material,
    replacementConstructionSiteId: material === "timber" ? "segment-stone-site" : null,
  };
}

test("Given level four housing When routing sprites Then the Stone Town house uses the house_l4 key", () => {
  // Given
  const house = building("house-l4", "house", 6, 0);

  // When / Then
  assert.equal(buildingSpriteKey(house, 4), "house_l4");
});

test("Given sprites are absent When drawing Stone Town building fallbacks Then every new kind paints a nonempty silhouette", () => {
  // Given
  const buildings = [
    building("quarry", "quarry", 0, 0),
    building("masonry", "masonry", 2, 0),
    building("market", "market", 3, 0),
    building("church", "church", 4, 0),
    building("keep", "keep", 5, 0),
    building("house-l4", "house", 6, 0),
  ];
  const context = loggedContext();
  const gameState = state(buildings);
  const objectRenderItems = buildObjectRenderItems({
    tiles: gameState.tiles,
    worldTiles: gameState.tiles,
    buildings: gameState.buildings,
    range: { minTx: 0, minTy: 0, maxTx: 7, maxTy: 3 },
  });

  // When
  drawBuildings(context, {
    state: gameState,
    tiles: gameState.tiles,
    range: { minTx: 0, minTy: 0, maxTx: 7, maxTy: 3 },
    zoom: 0.7,
    objectRenderItems,
  });

  // Then
  assert.equal(context.calls.filter((call) => call === "fill").length >= buildings.length, true);
  assert.ok(context.calls.includes(`fillStyle:${SEMANTIC_PALETTE.stone}`));
  assert.ok(context.calls.includes(`fillStyle:${SEMANTIC_PALETTE.stoneDark}`));
});

test("Given timber and completed stone wall segments When drawing Then each position chooses exactly one material style", () => {
  // Given
  const timberContext = loggedContext();
  const stoneContext = loggedContext();

  // When
  drawPalisadeSegment(timberContext, { segment: segment("timber"), gate: null, zoom: 1 });
  drawPalisadeSegment(stoneContext, { segment: segment("stone"), gate: null, zoom: 1 });

  // Then
  assert.ok(timberContext.calls.includes(`fillStyle:${SEMANTIC_PALETTE.earth}`));
  assert.equal(timberContext.calls.includes(`fillStyle:${SEMANTIC_PALETTE.stone}`), false);
  assert.ok(stoneContext.calls.includes(`fillStyle:${SEMANTIC_PALETTE.stone}`));
  assert.equal(stoneContext.calls.includes(`fillStyle:${SEMANTIC_PALETTE.earth}`), false);
  assert.deepEqual(
    timberContext.calls.filter((call) => call.startsWith("fillRect:")),
    stoneContext.calls.filter((call) => call.startsWith("fillRect:")),
  );
});

test("Given a material wave clock outside GameState When hashing gameplay Then presentation timing has no effect", () => {
  // Given
  const gameState = state([building("house-l4", "house", 6, 0)]);
  const widened = { ...gameState, houseMaterialWaveStartedAtMs: 123_456, materialWaveNowMs: 124_000 };

  // When / Then
  assert.equal(hashEconomyState(widened), hashEconomyState(gameState));
});
