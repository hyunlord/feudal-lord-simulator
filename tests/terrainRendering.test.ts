import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE, SEMANTIC_PALETTE } from "../src/content/palette";
import type { GameState } from "../src/engine/engine.types";
import {
  drawTerrain,
  terrainSeamFor,
  terrainSeamMarkCount,
} from "../src/render/drawTerrain";
import {
  CANVAS_SURROUND_COLOR,
  worldVignetteBands,
} from "../src/render/worldBackdrop";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { shade, withAlpha } from "../src/render/style";
import type { Tile } from "../src/world/world.types";

function recordingContext(calls: string[]): CanvasRenderingContext2D {
  let fillStyle = "";
  let strokeStyle = "";

  return {
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
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    ellipse: (x: number, y: number, radiusX: number, radiusY: number) =>
      calls.push(`ellipse:${x},${y},${radiusX},${radiusY}`),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
  } as unknown as CanvasRenderingContext2D;
}

test("terrain seams are material-specific and drawn only on the grass side", () => {
  assert.equal(terrainSeamFor("grass", "water"), "shoreline");
  assert.equal(terrainSeamFor("grass", "forest"), "forestTufts");
  assert.equal(terrainSeamFor("grass", "rock"), "rockPebbles");

  assert.equal(terrainSeamFor("water", "grass"), null);
  assert.equal(terrainSeamFor("forest", "grass"), null);
  assert.equal(terrainSeamFor("rock", "grass"), null);
  assert.equal(terrainSeamFor("grass", "grass"), null);
});

test("ground tiles use one coherent fill without per-tile ink outlines", () => {
  // Given
  const tile: Tile = {
    tx: 0,
    ty: 0,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
  };
  const state: GameState = {
    tick: 0,
    seed: 73,
    tiles: [tile],
    width: 1,
    height: 1,
    buildings: [],
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
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  };
  const calls: string[] = [];

  // When
  drawTerrain(recordingContext(calls), {
    state,
    tiles: [tile],
    range: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
    zoom: 1,
  });

  // Then
  assert.equal(calls.filter((call) => call === "fill").length, 1);
  assert.equal(calls.filter((call) => call === "stroke").length, 0);
});

test("object grounding is painted after all terrain tiles using the shared object queue", () => {
  // Given
  const forestTile: Tile = {
    tx: 0,
    ty: 0,
    terrain: "forest",
    buildingId: null,
    hasRoad: false,
  };
  const grassTile: Tile = {
    tx: 1,
    ty: 0,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
  };
  const state: GameState = {
    tick: 0,
    seed: 73,
    tiles: [forestTile, grassTile],
    width: 2,
    height: 1,
    buildings: [],
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
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  };
  const renderItems = buildObjectRenderItems({
    tiles: [forestTile, grassTile],
    worldTiles: state.tiles,
    buildings: [],
    walkers: [],
    range: { minTx: 0, minTy: 0, maxTx: 1, maxTy: 0 },
    seed: state.seed,
    includeGroundCover: false,
  });
  const calls: string[] = [];

  // When
  drawTerrain(recordingContext(calls), {
    state,
    tiles: [forestTile, grassTile],
    range: { minTx: 0, maxTx: 1, minTy: 0, maxTy: 0 },
    zoom: 1,
    objectRenderItems: renderItems,
  });

  // Then
  const firstTerrainFill = calls.indexOf("fill");
  const secondTerrainFill = calls.indexOf("fill", firstTerrainFill + 1);
  const haloIndex = calls.indexOf(`fillStyle:${withAlpha(SEMANTIC_PALETTE.earth, 0.16)}`);
  const coreIndex = calls.indexOf(`fillStyle:${withAlpha(SEMANTIC_PALETTE.earthDark, 0.32)}`);
  const contactIndex = calls.indexOf(`fillStyle:${withAlpha(PALETTE.ink, 0.18)}`);
  assert.equal(renderItems.filter((item) => item.kind === "tree").length, 1);
  assert.notEqual(firstTerrainFill, -1);
  assert.notEqual(secondTerrainFill, -1);
  assert.ok(haloIndex > secondTerrainFill);
  assert.ok(coreIndex > haloIndex);
  assert.ok(contactIndex > coreIndex);
});

test("forest seams use a deterministic two or three tuft cluster", () => {
  const counts = Array.from({ length: 32 }, (_, index) =>
    terrainSeamMarkCount("forestTufts", index, 7, 1, 0, 73),
  );

  assert.deepEqual(
    counts,
    Array.from({ length: 32 }, (_, index) =>
      terrainSeamMarkCount("forestTufts", index, 7, 1, 0, 73),
    ),
  );
  assert.ok(counts.every((count) => count === 2 || count === 3));
  assert.deepEqual(new Set(counts), new Set([2, 3]));
});

test("world vignette uses three palette-derived tile bands inside an ink surround", () => {
  const bands = worldVignetteBands({ width: 64, height: 64 });

  assert.equal(CANVAS_SURROUND_COLOR, PALETTE.ink);
  assert.deepEqual(
    bands.map((band) => band.marginTiles),
    [3, 2, 1],
  );
  assert.deepEqual(
    bands.map((band) => band.color),
    [
      shade(SEMANTIC_PALETTE.earthDark, 0.55),
      shade(SEMANTIC_PALETTE.earthDark, 0.65),
      shade(SEMANTIC_PALETTE.earthDark, 0.75),
    ],
  );

  const outer = bands[0];
  const middle = bands[1];
  const inner = bands[2];
  assert.ok(outer && middle && inner);
  assert.ok(outer.points.top.y < middle.points.top.y);
  assert.ok(middle.points.top.y < inner.points.top.y);
  assert.ok(outer.points.right.x > middle.points.right.x);
  assert.ok(middle.points.right.x > inner.points.right.x);
});
