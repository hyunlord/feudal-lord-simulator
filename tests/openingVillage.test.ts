import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { cameraForStartingHouse, MIN_OPENING_1X1_BUILDING_SCREEN_PX } from "../src/render/canvasRuntime";
import { drawStartingLandmark } from "../src/render/drawStartingLandmarks";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import { STARTING_LANDMARKS } from "../src/render/startingLandmarks";
import type { StartingLandmark } from "../src/render/startingLandmarks";
import { spriteMeta } from "../src/render/worldAssets";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";
import {
  hashEconomyState,
  hashOpeningState,
} from "../scripts/economyHarnessSerializer";
import { ONBOARDING_TASKS } from "../src/ui/onboardingTaskModel";

const OPENING_CENTER = { tx: 45, ty: 41 } as const;
const EXPECTED_OPENING_HASH = "f0cd4b1b189c579b";
type Rect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};
type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function roadKeys(): readonly string[] {
  return DEFAULT_GAME_STATE.tiles
    .filter((tile) => tile.hasRoad)
    .map((tile) => `${tile.tx},${tile.ty}`)
    .sort((left, right) => left.localeCompare(right));
}

function intersects(left: Rect, right: Rect): boolean {
  return !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );
}

function fordProtectedRects(landmark: StartingLandmark): readonly Rect[] {
  const center = tileToScreen(landmark.tx, landmark.ty);
  return [
    {
      left: center.sx - 26,
      right: center.sx + 26,
      top: center.sy - 30,
      bottom: center.sy - 8,
    },
    {
      left: center.sx - TILE_W * 0.42,
      right: center.sx + TILE_W * 0.42,
      top: center.sy - TILE_H * 0.26,
      bottom: center.sy + TILE_H * 0.34,
    },
  ];
}

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let font = "";
  let strokeStyle = "";
  const context = {
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
    beginPath: () => calls.push("beginPath"),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      calls.push(`ellipse:${x},${y},${rx},${ry}`),
    fill: () => calls.push("fill"),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x},${y},${width},${height}`),
  };
  return context as unknown as LoggedContext;
}

test("DEFAULT_GAME_STATE opens with the authored four-cottage village around the centre", () => {
  // Given: the canonical opening state.
  const state = DEFAULT_GAME_STATE;

  // When: state is inspected at the data boundary used by first-frame rendering.
  const cottages = state.buildings
    .filter((building) => building.kind === "house")
    .sort((left, right) => left.id.localeCompare(right.id));
  const well = state.buildings.find((building) => building.kind === "well");

  // Then: the village is authored, deterministic, and populated without changing timber.
  assert.deepEqual(
    cottages.map(({ tx, ty }) => ({ tx, ty })),
    [
      { tx: 44, ty: 40 },
      { tx: 44, ty: 42 },
      { tx: 46, ty: 40 },
      { tx: 46, ty: 42 },
    ],
  );
  assert.deepEqual(well === undefined ? null : { tx: well.tx, ty: well.ty }, OPENING_CENTER);
  assert.deepEqual(
    [...state.houses]
      .sort((left, right) => left.buildingId.localeCompare(right.buildingId))
      .map(({ buildingId, level, residents }) => ({ buildingId, level, residents })),
    cottages.map(({ id }) => ({ buildingId: id, level: 0, residents: 3 })),
  );
  assert.equal(state.houses[0]?.buildingId, "house-46-40-0");
  assert.equal(state.population, 12);
  assert.equal(state.treasuryTimber, 205);
});

test("DEFAULT_GAME_STATE contains exactly the eight authored road tiles toward the ford", () => {
  // Given / When / Then: the path is fixed so the first frame is identical every run.
  assert.deepEqual(roadKeys(), [
    "45,41",
    "46,41",
    "47,41",
    "48,41",
    "49,41",
    "50,41",
    "51,41",
    "52,41",
  ]);
});

test("the decorative ford is renderer-only and absent from gameplay registries", () => {
  // Given: Phase 8 adds a ford landmark only for the opening tableau.
  const ford = STARTING_LANDMARKS.find((landmark) => landmark.kind === "ford");

  // When: the object queue sees the tile that owns the landmark.
  const renderItems = buildObjectRenderItems({
    tiles: DEFAULT_GAME_STATE.tiles.filter((tile) => tile.tx === 53 && tile.ty === 41),
    worldTiles: DEFAULT_GAME_STATE.tiles,
    buildings: DEFAULT_GAME_STATE.buildings,
    walkers: DEFAULT_GAME_STATE.walkers,
    range: { minTx: 53, minTy: 41, maxTx: 53, maxTy: 41 },
    seed: DEFAULT_GAME_STATE.seed,
    includeGroundCover: false,
  });

  // Then: it renders, but has no building/tool/economy representation.
  assert.deepEqual(ford, { kind: "ford", tx: 53, ty: 41, label: "나루터" });
  assert.deepEqual(
    renderItems.filter((item) => item.kind === "starting_landmark").map((item) => item.id),
    ["starting-landmark:ford:53:41"],
  );
  assert.equal("ford" in BUILDING_CONFIG_BY_KIND, false);
  assert.equal(new Set<string>(BUILD_TOOL_OPTIONS.map((option) => option.tool)).has("ford"), false);
  assert.equal(new Set<string>(DEFAULT_GAME_STATE.buildings.map((building) => building.kind)).has("ford"), false);
  assert.equal(DEFAULT_GAME_STATE.tiles.some((tile) => tile.buildingId === "ford"), false);
});

test("opening ford clearance keeps tree descriptors off the readable landmark label and footprint", () => {
  // Given: the 1280px opening route reaches the renderer-only ford through forest.
  const ford = STARTING_LANDMARKS.find((landmark) => landmark.kind === "ford");
  if (ford === undefined) throw new Error("ford landmark missing");
  const range = {
    minTx: ford.tx - 4,
    minTy: ford.ty - 4,
    maxTx: ford.tx + 4,
    maxTy: ford.ty + 4,
  };
  const visibleTiles = DEFAULT_GAME_STATE.tiles.filter((tile) =>
    tile.tx >= range.minTx &&
    tile.tx <= range.maxTx &&
    tile.ty >= range.minTy &&
    tile.ty <= range.maxTy,
  );

  // When: the object queue builds the same tree descriptors used by the first frame.
  const renderItems = buildObjectRenderItems({
    tiles: visibleTiles,
    worldTiles: DEFAULT_GAME_STATE.tiles,
    buildings: DEFAULT_GAME_STATE.buildings,
    walkers: DEFAULT_GAME_STATE.walkers,
    range,
    seed: DEFAULT_GAME_STATE.seed,
    includeGroundCover: false,
  });
  const protectedRects = fordProtectedRects(ford);
  const occludingTreeIds = renderItems.flatMap((item) => {
    if (item.kind !== "tree") return [];
    const meta = spriteMeta(item.descriptor.spriteKey);
    if (meta === null) throw new Error(`missing tree sprite metadata for ${item.descriptor.spriteKey}`);
    const bounds = {
      left: item.descriptor.x - meta.anchor.x * item.descriptor.scale,
      right: item.descriptor.x + (meta.width - meta.anchor.x) * item.descriptor.scale,
      top: item.descriptor.y - meta.anchor.y * item.descriptor.scale,
      bottom: item.descriptor.y,
    };
    return protectedRects.some((rect) => intersects(bounds, rect)) ? [item.id] : [];
  });

  // Then: tree placement leaves the ford landmark readable without changing it into gameplay data.
  assert.deepEqual(ford, { kind: "ford", tx: 53, ty: 41, label: "나루터" });
  assert.deepEqual(occludingTreeIds, []);
});

test("ford landmark label is painted on an opaque plate before text", () => {
  // Given
  const context = loggedContext();
  const landmark = { kind: "ford", tx: 53, ty: 41, label: "나루터" } as const satisfies StartingLandmark;

  // When
  drawStartingLandmark(context, landmark, 1);

  // Then
  const plateIndex = context.calls.findIndex((call) => call.startsWith("fillRect:"));
  const labelIndex = context.calls.findIndex((call) => call.startsWith("fillText:나루터,"));
  assert.ok(plateIndex >= 0);
  assert.ok(labelIndex > plateIndex);
});

test("initial camera centres the authored village with legible opening buildings", () => {
  // Given: a first-frame desktop canvas and the default village.
  const canvas = { clientWidth: 1280, clientHeight: 720 };

  // When: the runtime derives the opening camera.
  const camera = cameraForStartingHouse(canvas, DEFAULT_GAME_STATE);
  const anchor = tileToScreen(OPENING_CENTER.tx, OPENING_CENTER.ty);
  const screenX = anchor.sx * camera.zoom + camera.panX;
  const screenY = anchor.sy * camera.zoom + camera.panY;
  const usableHeight = canvas.clientHeight - 150;

  // Then: the village centre is the visual anchor, and the startup floor keeps buildings readable.
  assert.ok(Math.abs(screenX - canvas.clientWidth / 2) <= 2);
  assert.ok(Math.abs(screenY - usableHeight / 2) <= 2);
  assert.ok(smallestRenderedOpeningBuildingPx(camera.zoom) >= MIN_OPENING_1X1_BUILDING_SCREEN_PX);
});

function smallestRenderedOpeningBuildingPx(zoom: number): number {
  return Math.min(
    ...DEFAULT_GAME_STATE.buildings.map((building) => {
      const meta = spriteMeta(building.kind === "well" ? "well" : "house_l0");
      if (meta === null) throw new Error(`missing sprite metadata for ${building.kind}`);
      return Math.min(meta.width, meta.height) * zoom;
    }),
  );
}

test("authored roads satisfy only the first onboarding gate on first evaluation", () => {
  // Given: no presentation tasks have been acknowledged yet.
  const [roadTask, loggingTask] = ONBOARDING_TASKS;
  if (roadTask === undefined || loggingTask === undefined) throw new Error("onboarding tasks missing");

  // When / Then: the first task is already true, but the next building task remains active.
  assert.equal(roadTask.isComplete(DEFAULT_GAME_STATE), true);
  assert.equal(loggingTask.isComplete(DEFAULT_GAME_STATE), false);
});

test("opening hashes include the authored roads and differ from the prior edge-hut baseline", () => {
  // Given / When: the economy and opening serializers hash the state.
  const economyHash = hashEconomyState(DEFAULT_GAME_STATE);
  const openingHash = hashOpeningState(DEFAULT_GAME_STATE);

  // Then: the opening hash is pinned separately because roads/tiles are part of the first frame.
  assert.equal(economyHash.length, 16);
  assert.equal(openingHash, EXPECTED_OPENING_HASH);
});
