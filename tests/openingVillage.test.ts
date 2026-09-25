import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { cameraForStartingHouse, MIN_OPENING_1X1_BUILDING_SCREEN_PX } from "../src/render/canvasRuntime";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { tileToScreen } from "../src/render/iso";
import { spriteMeta } from "../src/render/worldAssets";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";
import {
  hashEconomyState,
  hashOpeningState,
} from "../scripts/economyHarnessSerializer";
import { ONBOARDING_TASKS } from "../src/ui/onboardingTaskModel";

const OPENING_CENTER = { tx: 45, ty: 41 } as const;
// FIX-1: the opening houses are watered at creation (was 839a86230db877de / 2e036754c2d05951 with hasWater false).
const EXPECTED_ECONOMY_HASH = "a0b2bbd0dd5b032b";
const EXPECTED_OPENING_HASH = "efe743579d152e19";
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
  const authoredEconomy = state.buildings
    .filter((building) => building.kind === "granary" || building.kind === "logging_camp" || building.kind === "storehouse")
    .sort((left, right) => left.id.localeCompare(right.id));

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
  assert.equal(state.treasuryTimber, 120);
  assert.deepEqual(
    authoredEconomy.map(({ id, kind, tx, ty, workers, inventory }) => ({ id, kind, tx, ty, workers, inventory })),
    [
      { id: "granary-42-37-0", kind: "granary", tx: 42, ty: 37, workers: 2, inventory: { bread: 30 } },
      { id: "logging-camp-50-40-0", kind: "logging_camp", tx: 50, ty: 40, workers: 3, inventory: {} },
      { id: "storehouse-41-40-0", kind: "storehouse", tx: 41, ty: 40, workers: 1, inventory: { logs: 20 } },
    ],
  );
});

test("DEFAULT_GAME_STATE contains exactly the fourteen authored legal road tiles", () => {
  // Given / When / Then: the path is fixed so the first frame is identical every run.
  assert.deepEqual(roadKeys(), [
    "43,39",
    "43,40",
    "43,41",
    "44,39",
    "44,41",
    "45,39",
    "46,39",
    "46,41",
    "47,39",
    "47,40",
    "47,41",
    "48,41",
    "49,41",
    "50,41",
  ]);
});

test("the old ford placeholder is gone: the river crossing east of the village draws only terrain objects", () => {
  // Given: (53,41), where Phase 8 drew a code-made ford (ellipse, stones, label plate). Ferries and quays come
  // back later as real modules with the curved shoreline.
  const range = { minTx: 51, minTy: 39, maxTx: 55, maxTy: 43 };

  // When: the object queue sees the tiles around it.
  const renderItems = buildObjectRenderItems({
    tiles: DEFAULT_GAME_STATE.tiles.filter((tile) =>
      tile.tx >= range.minTx && tile.tx <= range.maxTx && tile.ty >= range.minTy && tile.ty <= range.maxTy),
    worldTiles: DEFAULT_GAME_STATE.tiles,
    buildings: DEFAULT_GAME_STATE.buildings,
    walkers: DEFAULT_GAME_STATE.walkers,
    range,
    seed: DEFAULT_GAME_STATE.seed,
    includeGroundCover: false,
  });

  // Then: nothing but trees and stumps, and no gameplay registry ever knew a ford.
  assert.deepEqual([...new Set(renderItems.map((item) => item.kind))].filter((kind) => kind !== "tree" && kind !== "stump"), []);
  assert.equal("ford" in BUILDING_CONFIG_BY_KIND, false);
  assert.equal(new Set<string>(BUILD_TOOL_OPTIONS.map((option) => option.tool)).has("ford"), false);
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

test("opening village pixel floor uses manifest render scale", () => {
  const expectedFloor = Math.min(
    ...DEFAULT_GAME_STATE.buildings.map((building) => {
      const meta = spriteMeta(building.kind === "well" ? "well" : "house_l0");
      if (meta === null) throw new Error(`missing sprite metadata for ${building.kind}`);
      return Math.min(meta.width, meta.height) * meta.renderScale;
    }),
  );

  assert.equal(smallestRenderedOpeningBuildingPx(1), expectedFloor);
});

function smallestRenderedOpeningBuildingPx(zoom: number): number {
  return Math.min(
    ...DEFAULT_GAME_STATE.buildings.map((building) => {
      const meta = spriteMeta(building.kind === "well" ? "well" : "house_l0");
      if (meta === null) throw new Error(`missing sprite metadata for ${building.kind}`);
      return Math.min(meta.width, meta.height) * meta.renderScale * zoom;
    }),
  );
}

test("authored default state still needs connected timber storage for the palisade", () => {
  // Given: no presentation tasks have been acknowledged yet.
  const completion = ONBOARDING_TASKS.map((task) => task.isComplete(DEFAULT_GAME_STATE));

  assert.deepEqual(completion, [true, true, false, false, false, false, false, false]);
});

test("opening hashes include the authored roads and differ from the prior edge-hut baseline", () => {
  // Given / When: the economy and opening serializers hash the state.
  const economyHash = hashEconomyState(DEFAULT_GAME_STATE);
  const openingHash = hashOpeningState(DEFAULT_GAME_STATE);

  // Then: the opening hash is pinned separately because roads/tiles are part of the first frame.
  assert.equal(economyHash, EXPECTED_ECONOMY_HASH);
  assert.equal(openingHash, EXPECTED_OPENING_HASH);
});
