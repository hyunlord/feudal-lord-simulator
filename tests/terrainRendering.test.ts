import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE } from "../src/content/palette";
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
import { shade } from "../src/render/style";
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
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
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
      shade(PALETTE.earthDark, 0.55),
      shade(PALETTE.earthDark, 0.65),
      shade(PALETTE.earthDark, 0.75),
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
