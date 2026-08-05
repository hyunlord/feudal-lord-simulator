import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEMANTIC_PALETTE } from "../src/content/palette";
import { drawTerrain, grassPatternQuarterTurn, terrainTextureOpacity } from "../src/render/drawTerrain";
import { drawRoadPath } from "../src/render/drawTerrainDetails";
import { shade, withAlpha } from "../src/render/style";
import { TERRAIN_TEXTURE_KEYS, getTerrainPattern, terrainTextureKeyFor, type TerrainPatternAssets, type TerrainTextureKey } from "../src/render/terrainPatterns";
import { terrainVariation } from "../src/world/terrain";
import type { Tile } from "../src/world/world.types";
import type { GameState } from "../src/engine/engine.types";

type RecordedCall =
  | `beginPath` | `clip` | `closePath` | `createPattern:${TerrainTextureKey}`
  | `fill` | `restore` | `save` | `stroke`
  | `fillRect:${number},${number},${number},${number}`
  | `fillStyle:${string}` | `lineTo:${number},${number}`
  | `moveTo:${number},${number}` | `patternTransform:${string}` | `globalAlpha:${number}`;

const tile = (tx: number, ty: number, terrain: Tile["terrain"], hasRoad = false): Tile => ({
  tx, ty, terrain, buildingId: null, hasRoad,
});

const state = (tiles: readonly Tile[]): GameState => ({
  tick: 0, seed: 73,
  tiles: [...tiles],
  width: 3, height: 3,
  buildings: [], houses: [], walkers: [],
  population: 0, idleWorkers: 0, treasuryTimber: 0, roadRevision: 0,
  pathCache: {},
});

const readyAssets = (keys: readonly TerrainTextureKey[]): TerrainPatternAssets => {
  const images = new Map(keys.map((key) => [key, terrainImage(key)]));
  return {
    meta: (key) => ({ key, category: "terrain", status: keys.includes(key) ? "ready" : "missing" }),
    sprite: (key) => images.get(key) ?? null,
  };
};

const loadingAssets = (status: "idle" | "loading" | "missing"): TerrainPatternAssets => ({
  meta: (key) => ({ key, category: "terrain", status }),
  sprite: () => ({ terrainKey: status } as unknown as CanvasImageSource),
});

const readyImageAssets = (image: CanvasImageSource): TerrainPatternAssets => ({
  meta: (key) => ({ key, category: "terrain", status: "ready" }),
  sprite: () => image,
});

function recordingContext(calls: RecordedCall[]): CanvasRenderingContext2D {
  let fillStyle: string | CanvasGradient | CanvasPattern = "";
  let globalAlpha = 1;
  return {
    canvas: { width: 300, height: 150 },
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyle = value;
      calls.push(`fillStyle:${patternName(value)}`);
    },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value: number) {
      globalAlpha = value;
      calls.push(`globalAlpha:${value}`);
    },
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    clip: () => calls.push("clip"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    createPattern: (image: CanvasImageSource) => {
      const key = terrainKeyFromImage(image);
      calls.push(`createPattern:${key}`);
      return {
        id: key,
        setTransform: (matrix?: DOMMatrix2DInit) => calls.push(`patternTransform:${JSON.stringify(matrix ?? {})}`),
      } as unknown as CanvasPattern;
    },
  } as unknown as CanvasRenderingContext2D;
}

function nullThenRecordingContext(calls: RecordedCall[]): CanvasRenderingContext2D {
  let attempts = 0;
  return {
    ...recordingContext(calls),
    createPattern: (image: CanvasImageSource) => {
      const key = terrainKeyFromImage(image);
      calls.push(`createPattern:${key}`);
      attempts += 1;
      if (attempts === 1) return null;
      return { id: key, setTransform: () => undefined } as unknown as CanvasPattern;
    },
  } as unknown as CanvasRenderingContext2D;
}

function terrainKeyFromImage(image: CanvasImageSource): TerrainTextureKey {
  const record = image as unknown as Readonly<Record<string, unknown>>;
  const key = record["terrainKey"];
  if (typeof key === "string" && isTerrainTextureKey(key)) return key;
  throw new Error("unexpected terrain texture image");
}

function isTerrainTextureKey(key: string): key is TerrainTextureKey {
  return TERRAIN_TEXTURE_KEYS.some((candidate) => candidate === key);
}

function patternName(value: string | CanvasGradient | CanvasPattern): string {
  if (typeof value === "string") return value;
  const pattern = value as unknown as Readonly<{ readonly id: string }>;
  return `pattern:${pattern.id}`;
}

function terrainImage(terrainKey: TerrainTextureKey, variant?: string): CanvasImageSource {
  return (variant === undefined ? { terrainKey } : { terrainKey, variant }) as unknown as CanvasImageSource;
}

describe("terrain patterns", () => {
  it("Given terrain materials When resolving texture keys Then manifest keys are exact", () => {
    assert.deepEqual(TERRAIN_TEXTURE_KEYS, ["grass", "forest_floor", "water", "rock", "packed_earth_road"]);
    assert.equal(terrainTextureKeyFor("grass"), "grass");
    assert.equal(terrainTextureKeyFor("forest"), "forest_floor");
    assert.equal(terrainTextureKeyFor("water"), "water");
    assert.equal(terrainTextureKeyFor("rock"), "rock");
  });

  it("Given a ready texture When reused on one context Then createPattern is cached per key", () => {
    const calls: RecordedCall[] = [];
    const context = recordingContext(calls);
    const assets = readyAssets(["grass"]);

    const first = getTerrainPattern(context, "grass", assets);
    const second = getTerrainPattern(context, "grass", assets);
    const third = getTerrainPattern(recordingContext([]), "grass", assets);

    assert.equal(first, second);
    assert.notEqual(first, third);
    assert.deepEqual(calls.filter((call) => call === "createPattern:grass"), ["createPattern:grass"]);
  });

  it("Given repeated grass orientations When resolving patterns Then each transformed variant is created once", () => {
    const calls: RecordedCall[] = [];
    const context = recordingContext(calls);
    const assets = readyAssets(["grass"]);

    const first = getTerrainPattern(context, "grass", assets, 1);
    const repeated = getTerrainPattern(context, "grass", assets, 1);
    const second = getTerrainPattern(context, "grass", assets, 2);

    assert.equal(first, repeated);
    assert.notEqual(first, second);
    assert.deepEqual(calls.filter((call) => call === "createPattern:grass"), [
      "createPattern:grass", "createPattern:grass",
    ]);
    assert.equal(calls.filter((call) => call.startsWith("patternTransform:")).length, 2);
  });

  it("Given createPattern returns null When requested again Then null is not cached", () => {
    const calls: RecordedCall[] = [];
    const context = nullThenRecordingContext(calls);
    const assets = readyImageAssets(terrainImage("grass"));

    const first = getTerrainPattern(context, "grass", assets);
    const second = getTerrainPattern(context, "grass", assets);

    assert.equal(first, null);
    assert.notEqual(second, null);
    assert.deepEqual(calls.filter((call) => call === "createPattern:grass"), [
      "createPattern:grass", "createPattern:grass",
    ]);
  });

  it("Given a ready texture source changes When the same key is requested Then the pattern is replaced", () => {
    const calls: RecordedCall[] = [];
    const context = recordingContext(calls);
    const firstImage = terrainImage("water", "first"), secondImage = terrainImage("water", "second");

    const first = getTerrainPattern(context, "water", readyImageAssets(firstImage));
    const second = getTerrainPattern(context, "water", readyImageAssets(secondImage));

    assert.notEqual(first, second);
    assert.deepEqual(calls.filter((call) => call === "createPattern:water"), [
      "createPattern:water", "createPattern:water",
    ]);
  });

  it("Given missing or loading textures When requested Then procedural fallback does not create patterns", () => {
    for (const status of ["idle", "loading", "missing"] as const) {
      const calls: RecordedCall[] = [];
      const pattern = getTerrainPattern(recordingContext(calls), "water", loadingAssets(status));

      assert.equal(pattern, null);
      assert.equal(calls.some((call) => call.startsWith("createPattern:")), false);
    }
  });

  it("Given ready ground textures When terrain draws Then diamonds clip texture and overlay deterministic brightness", () => {
    const calls: RecordedCall[] = [];
    const ground = tile(1, 0, "grass");
    const variation = terrainVariation(1, 0, 73);
    const expectedOverlay = variation >= 0
      ? withAlpha(SEMANTIC_PALETTE.vellum, Math.abs(variation))
      : withAlpha(SEMANTIC_PALETTE.ink, Math.abs(variation));

    drawTerrain(recordingContext(calls), {
      state: state([ground]),
      tiles: [ground],
      range: { minTx: 1, maxTx: 1, minTy: 0, maxTy: 0 },
      zoom: 1,
      terrainPatterns: readyAssets(["grass"]),
    });

    assert.ok(calls.includes("clip"));
    assert.ok(calls.includes("fillRect:0,0,64,32"));
    assert.ok(calls.includes("globalAlpha:0.45"));
    assert.ok(calls.indexOf(`fillStyle:${SEMANTIC_PALETTE.sage}`) < calls.indexOf("fillStyle:pattern:grass"));
    assert.ok(calls.indexOf("restore") < calls.indexOf(`fillStyle:${expectedOverlay}`));
  });

  it("Given terrain materials When texture opacity is selected Then water stays faint and land stays near 45 percent", () => {
    assert.equal(terrainTextureOpacity("grass"), 0.45);
    assert.equal(terrainTextureOpacity("forest"), 0.45);
    assert.equal(terrainTextureOpacity("rock"), 0.45);
    assert.equal(terrainTextureOpacity("water"), 0.18);
  });

  it("Given grass tile coordinates When repeat orientation is selected Then a deterministic quarter-turn is used", () => {
    const first = Array.from({ length: 16 }, (_, index) => grassPatternQuarterTurn((index % 4) * 8, Math.floor(index / 4) * 8, 73));
    const second = Array.from({ length: 16 }, (_, index) => grassPatternQuarterTurn((index % 4) * 8, Math.floor(index / 4) * 8, 73));
    assert.deepEqual(first, second);
    assert.deepEqual([...new Set(first)].sort(), [0, 1, 2, 3]);
    assert.equal(grassPatternQuarterTurn(0, 0, 73), grassPatternQuarterTurn(7, 7, 73));
    assert.notDeepEqual(first, Array.from({ length: 16 }, (_, index) => grassPatternQuarterTurn((index % 4) * 8, Math.floor(index / 4) * 8, 74)));
  });

  it("Given camera transforms differ When textured terrain draws Then pattern phase remains world anchored", () => {
    const firstCalls: RecordedCall[] = [];
    const secondCalls: RecordedCall[] = [];
    const ground = tile(2, 1, "water");
    const input = {
      state: state([ground]),
      tiles: [ground],
      range: { minTx: 2, maxTx: 2, minTy: 1, maxTy: 1 },
      zoom: 1,
      terrainPatterns: readyAssets(["water"]),
    };

    drawTerrain(recordingContext(firstCalls), input);
    drawTerrain(recordingContext(secondCalls), { ...input, zoom: 2 });

    assert.deepEqual(
      firstCalls.filter((call) => call.startsWith("fillRect:")),
      secondCalls.filter((call) => call.startsWith("fillRect:")),
    );
    assert.ok(firstCalls.some((call) => call.startsWith("patternTransform:")));
    assert.deepEqual(
      firstCalls.filter((call) => call.startsWith("patternTransform:")),
      secondCalls.filter((call) => call.startsWith("patternTransform:")),
    );
  });

  it("Given a missing ground texture When terrain draws Then the old shade fill is preserved", () => {
    const calls: RecordedCall[] = [];
    const ground = tile(0, 0, "rock");

    drawTerrain(recordingContext(calls), {
      state: state([ground]),
      tiles: [ground],
      range: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      zoom: 1,
      terrainPatterns: loadingAssets("missing"),
    });

    assert.ok(calls.includes(`fillStyle:${shade(SEMANTIC_PALETTE.stone, 1 + terrainVariation(0, 0, 73))}`));
  });

  it("Given connected roads When packed-earth texture is ready Then centre and arms are pattern-filled before ruts", () => {
    const calls: RecordedCall[] = [];
    const road = tile(1, 1, "grass", true);
    const east = tile(2, 1, "grass", true);

    drawRoadPath(recordingContext(calls), state([road, east]), road, readyAssets(["packed_earth_road"]));

    assert.deepEqual(calls.filter((call) => call === "createPattern:packed_earth_road"), [
      "createPattern:packed_earth_road",
    ]);
    assert.ok(calls.includes("fillStyle:pattern:packed_earth_road"));
    assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.earthDark}`));
    assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.stoneDark}`));
  });

  it("Given the road texture is missing When roads draw Then earth fallback still renders arms and ruts", () => {
    const calls: RecordedCall[] = [];
    const road = tile(1, 1, "grass", true);
    const south = tile(1, 2, "grass", true);

    drawRoadPath(recordingContext(calls), state([road, south]), road, loadingAssets("missing"));

    assert.equal(calls.some((call) => call.startsWith("createPattern:")), false);
    assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.earth}`));
    assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.earthDark}`));
  });

  it("Given zoom is at the boundary When terrain draws Then decals appear only above 0.7", () => {
    const ground = tile(0, 15, "grass");
    const atBoundary: RecordedCall[] = [];
    const aboveBoundary: RecordedCall[] = [];

    drawTerrain(recordingContext(atBoundary), {
      state: state([ground]),
      tiles: [ground],
      range: { minTx: 0, maxTx: 0, minTy: 15, maxTy: 15 },
      zoom: 0.7,
      terrainPatterns: loadingAssets("missing"),
    });
    drawTerrain(recordingContext(aboveBoundary), {
      state: state([ground]),
      tiles: [ground],
      range: { minTx: 0, maxTx: 0, minTy: 15, maxTy: 15 },
      zoom: 0.7001,
      terrainPatterns: loadingAssets("missing"),
    });

    assert.equal(atBoundary.includes(`fillStyle:${SEMANTIC_PALETTE.stoneDark}`), false);
    assert.equal(aboveBoundary.includes(`fillStyle:${SEMANTIC_PALETTE.stoneDark}`), true);
  });
});
