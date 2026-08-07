import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { cameraForStartingHouse } from "../src/render/canvasRuntime";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import { STARTING_LANDMARKS } from "../src/render/startingLandmarks";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import {
  hashEconomyState,
  hashOpeningState,
} from "../scripts/economyHarnessSerializer";
import { ONBOARDING_TASKS } from "../src/ui/onboardingTaskModel";

const OPENING_CENTER = { tx: 45, ty: 41 } as const;
const EXPECTED_OPENING_HASH = "b96ecf8b914bb99d";

function roadKeys(): readonly string[] {
  return DEFAULT_GAME_STATE.tiles
    .filter((tile) => tile.hasRoad)
    .map((tile) => `${tile.tx},${tile.ty}`)
    .sort((left, right) => left.localeCompare(right));
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

  // When / Then: it has no building/tool/economy representation.
  assert.deepEqual(ford, { kind: "ford", tx: 53, ty: 41, label: "나루터" });
  assert.equal("ford" in BUILDING_CONFIG_BY_KIND, false);
  assert.equal(new Set<string>(DEFAULT_GAME_STATE.buildings.map((building) => building.kind)).has("ford"), false);
  assert.equal(DEFAULT_GAME_STATE.tiles.some((tile) => tile.buildingId === "ford"), false);
});

test("initial camera centres the authored village with roughly twenty visible isometric tiles", () => {
  // Given: a first-frame desktop canvas and the default village.
  const canvas = { clientWidth: 1280, clientHeight: 720 };

  // When: the runtime derives the opening camera.
  const camera = cameraForStartingHouse(canvas, DEFAULT_GAME_STATE);
  const anchor = tileToScreen(OPENING_CENTER.tx, OPENING_CENTER.ty);
  const screenX = anchor.sx * camera.zoom + camera.panX;
  const screenY = anchor.sy * camera.zoom + camera.panY;
  const usableHeight = canvas.clientHeight - 150;
  const visibleTileSpan = Math.min(
    canvas.clientWidth / (TILE_W * camera.zoom),
    usableHeight / (TILE_H * camera.zoom),
  );

  // Then: the village centre is the visual anchor, not a map edge.
  assert.ok(Math.abs(screenX - canvas.clientWidth / 2) <= 2);
  assert.ok(Math.abs(screenY - usableHeight / 2) <= 2);
  assert.ok(visibleTileSpan >= 18 && visibleTileSpan <= 22);
});

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
