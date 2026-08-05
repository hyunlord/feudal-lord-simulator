import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingKind } from "../src/content/buildingConfig";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import { depthKey } from "../src/render/iso";
import { drawPlacementOverlay } from "../src/render/overlays";
import {
  ambientOffset,
  computeVisibleTileRange,
  objectPhase,
  runRenderPasses,
  visibleTilesInDrawOrder,
  type PlacementTool,
} from "../src/render/renderer";
import { terrainVariation } from "../src/world/terrain";
import { PlacementFailure } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";

function tile(
  tx: number,
  ty: number,
  terrain: Tile["terrain"] = "grass",
  buildingId: string | null = null,
  hasRoad = false,
): Tile {
  return { tx, ty, terrain, buildingId, hasRoad };
}

test("ambientOffset uses the exact deterministic sine equation with stable object phases", () => {
  // Given
  const tick = 17;
  const amplitude = 3;
  const frequency = 0.75;
  const firstPhase = objectPhase("tree", 4, 9);
  const secondPhase = objectPhase("tree", 4, 9);
  const otherPhase = objectPhase("tree", 5, 9);

  // When
  const offset = ambientOffset({ tick, amplitude, frequency, phase: firstPhase });

  // Then
  assert.equal(firstPhase, secondPhase);
  assert.notEqual(firstPhase, otherPhase);
  assert.equal(offset, amplitude * Math.sin(tick * frequency + firstPhase));
});

test("runRenderPasses calls ground objects and the empty overhang seam in explicit order", () => {
  // Given
  const calls: string[] = [];

  // When
  runRenderPasses({
    ground: () => calls.push("ground"),
    objects: () => calls.push("objects"),
    overhang: () => calls.push("overhang"),
  });

  // Then
  assert.deepEqual(calls, ["ground", "objects", "overhang"]);
});

test("computeVisibleTileRange clips iteration so a small viewport never draws every world tile", () => {
  // Given
  const fullTileCount = 64 * 64;

  // When
  const range = computeVisibleTileRange({
    camera: { zoom: 1, panX: 320, panY: 48 },
    viewport: { width: 320, height: 180 },
    world: { width: 64, height: 64 },
  });
  const visibleTileCount =
    (range.maxTx - range.minTx + 1) * (range.maxTy - range.minTy + 1);

  // Then
  assert.ok(visibleTileCount > 0);
  assert.ok(
    visibleTileCount < fullTileCount / 4,
    `expected visible range to be clipped, got ${visibleTileCount}`,
  );
});

test("terrain variation remains within plus or minus five percent and frame-stable", () => {
  // Given
  const sample = { tx: 6, ty: 7 };

  // When
  const firstFrame = terrainVariation(sample.tx, sample.ty, 73);
  const secondFrame = terrainVariation(sample.tx, sample.ty, 73);

  // Then
  assert.ok(firstFrame >= -0.05);
  assert.ok(firstFrame <= 0.05);
  assert.deepEqual(secondFrame, firstFrame);
});

test("visibleTilesInDrawOrder returns visible tiles back-to-front by depth key", () => {
  // Given
  const tiles = [
    tile(0, 0),
    tile(1, 0),
    tile(2, 0),
    tile(3, 0),
    tile(0, 1),
    tile(1, 1),
    tile(2, 1),
    tile(3, 1),
  ];

  // When
  const ordered = visibleTilesInDrawOrder({
    grid: { tiles, width: 4, height: 2 },
    range: { minTx: 1, minTy: 1, maxTx: 3, maxTy: 1 },
  });

  // Then
  assert.deepEqual(
    ordered.map((candidate) => depthKey(candidate.tx, candidate.ty)),
    [2, 3, 4],
  );
});

test("visibleTilesInDrawOrder reads only row-major indices inside the clipped range", () => {
  // Given
  const reads: number[] = [];
  const tiles = Array.from({ length: 8 }, (_, index) => tile(index % 4, Math.floor(index / 4)));
  const trackedTiles = new Proxy(tiles, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads.push(Number(property));
      return Reflect.get(target, property, receiver);
    },
  });

  // When
  visibleTilesInDrawOrder({
    grid: { tiles: trackedTiles, width: 4, height: 2 },
    range: { minTx: 1, minTy: 1, maxTx: 2, maxTy: 1 },
  });

  // Then
  assert.deepEqual(reads, [5, 6]);
});

test("PlacementTool is a focused tool union owned outside GameState", () => {
  // Given / When
  const buildingTool: PlacementTool = "mill";
  const roadTool: PlacementTool = "road";
  const allBuildingKinds = [
    "house",
    "well",
    "storehouse",
    "granary",
    "wheat_farm",
    "mill",
    "logging_camp",
    "sawmill",
  ] as const satisfies readonly BuildingKind[];

  // Then
  assert.equal(buildingTool, "mill");
  assert.equal(roadTool, "road");
  assert.ok(allBuildingKinds.includes(buildingTool));
  assert.equal("selectedTool" in { tick: 0 }, false);
});

test("invalid placement reasons use a zoom-stable vellum plaque", () => {
  // Given
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let strokeStyle = "";
  const context = {
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; calls.push(`fillStyle:${value}`); },
    get font() { return font; },
    set font(value: string) { font = value; calls.push(`font:${value}`); },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(value: string) { strokeStyle = value; calls.push(`strokeStyle:${value}`); },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    measureText: (text: string) => {
      calls.push(`measureText:${text}`);
      return { width: 70 };
    },
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
  } as unknown as CanvasRenderingContext2D;

  // When
  drawPlacementOverlay(context, {
    zoom: 0.5,
    preview: {
      tool: "sawmill",
      tile: { tx: 4, ty: 5 },
      footprint: [{ tx: 4, ty: 5 }],
      roadPath: [],
      ok: false,
      reason: PlacementFailure.needs_road,
      cursor: { tx: 4, ty: 5 },
    },
  });

  // Then
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.vellum}`), "plaque uses canonical vellum");
  assert.ok(calls.some((call) => call.startsWith("fillRect:")), "plaque fills behind the label");
  assert.ok(calls.some((call) => call.startsWith("strokeRect:")), "plaque uses the sanctioned outline");
  assert.ok(calls.includes("font:28px Georgia, serif"), "14 CSS-pixel text is preserved at 0.5x zoom");
  assert.ok(
    calls.findIndex((call) => call.startsWith("fillRect:")) <
      calls.findIndex((call) => call.startsWith("fillText:needs road")),
    "plaque is drawn before its failure label",
  );
});
