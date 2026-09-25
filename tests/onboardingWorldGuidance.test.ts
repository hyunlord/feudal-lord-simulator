import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { createConstructionSite } from "../src/economy/construction";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { fieldBlockAction } from "../src/engine/autoplayArable";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { TileCoordinate } from "../src/world/grid";
import { canPlaceBuilding } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";
import { ONBOARDING_TASKS } from "../src/ui/onboardingTaskModel";
import { arableCellCount, ONBOARDING_ARABLE_CELLS } from "../src/ui/onboardingBuildingTaskProgress";
import {
  firstRoadTargetForOnboarding,
  type OnboardingGuidanceTarget,
  onboardingRoadExtensionTargetLabel,
  onboardingWorldGuidanceTargets,
  onboardingRoadTargetLabel,
} from "../src/ui/onboardingWorldGuidance";
import { canPlaceRoad } from "../src/world/roadGraph";
import { placeFinishedBuilding } from "./finishedBuildingFixture";

function stateWith(input: {
  readonly buildings?: readonly Building[];
  readonly tiles?: readonly Tile[];
  readonly width?: number;
  readonly height?: number;
}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    width: input.width ?? DEFAULT_GAME_STATE.width,
    height: input.height ?? DEFAULT_GAME_STATE.height,
    buildings: [...(input.buildings ?? DEFAULT_GAME_STATE.buildings)],
    tiles: [...(input.tiles ?? DEFAULT_GAME_STATE.tiles)],
  };
}

function grassTile(coordinate: TileCoordinate): Tile {
  return tile(coordinate, {});
}

function buildingTile(coordinate: TileCoordinate, buildingId: string): Tile {
  return tile(coordinate, { buildingId });
}

function roadTile(coordinate: TileCoordinate): Tile {
  return tile(coordinate, { hasRoad: true });
}

function waterTile(coordinate: TileCoordinate): Tile {
  return tile(coordinate, { terrain: "water" });
}

function tile(
  coordinate: TileCoordinate,
  input: Partial<Pick<Tile, "buildingId" | "hasRoad" | "terrain">>,
): Tile {
  return {
    tx: coordinate.tx,
    ty: coordinate.ty,
    terrain: input.terrain ?? "grass",
    buildingId: input.buildingId ?? null,
    hasRoad: input.hasRoad ?? false,
  };
}

test("firstRoadTargetForOnboarding returns null for the authored opening road", () => {
  // Given: the canonical default village already has a road beside the first house.
  const state = DEFAULT_GAME_STATE;

  // When
  const target = firstRoadTargetForOnboarding(state);

  // Then
  assert.equal(target, null);
  assert.equal(onboardingRoadTargetLabel, "여기에 길을 놓으세요");
});

test("firstRoadTargetForOnboarding skips water occupied out-of-bounds and already-road candidates through the road placement rule", () => {
  // Given: north and west are out of bounds, east is water, and south is occupied.
  const state = stateWith({
    width: 3,
    height: 3,
    tiles: [
      buildingTile({ tx: 0, ty: 0 }, "house-0-0-0"),
      waterTile({ tx: 1, ty: 0 }),
      grassTile({ tx: 2, ty: 0 }),
      buildingTile({ tx: 0, ty: 1 }, "well-0-1-1"),
      grassTile({ tx: 1, ty: 1 }),
      grassTile({ tx: 2, ty: 1 }),
      grassTile({ tx: 0, ty: 2 }),
      grassTile({ tx: 1, ty: 2 }),
      grassTile({ tx: 2, ty: 2 }),
    ],
  });

  // When
  const target = firstRoadTargetForOnboarding(state);

  // Then
  assert.equal(target, null);
});

test("firstRoadTargetForOnboarding returns null as soon as any cardinal road touches the starting house", () => {
  // Given: task one is complete through an adjacent road.
  const state = stateWith({
    tiles: DEFAULT_GAME_STATE.tiles.map((tile) =>
      tile.tx === 1 && tile.ty === 0 ? roadTile({ tx: 1, ty: 0 }) : tile,
    ),
  });

  // When
  const target = firstRoadTargetForOnboarding(state);

  // Then
  assert.equal(target, null);
});

test("onboardingWorldGuidanceTargets advances from the authored opening to food before sawmill", () => {
  // Given: task one and two are complete in the authored default village.
  const state = placeRoadLine(DEFAULT_GAME_STATE, { tx: 1, ty: 0 }, { tx: 1, ty: 0 });

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  // AF-13: the farmstead needs a painted field beside it, so with no field painted yet there is no
  // farmstead marker (the task hint tells the player to paint one); the mill marker still leads to food.
  assert.ok(targets.some((target) => target.kind === "mill"));
  assert.ok(targets.every((target) => target.kind !== "farmstead"));
  assert.ok(targets.every((target) => target.kind !== "sawmill"));
  for (const target of targets) {
    if (target.kind !== "road") assert.equal(canPlaceBuilding(state, target.kind, target.origin.tx, target.origin.ty).ok, true);
  }
});

test("food guidance waits for the first farm site without asking for a second before sawmill", () => {
  const state = paintField(placeRoadLine(DEFAULT_GAME_STATE, { tx: 1, ty: 0 }, { tx: 1, ty: 0 }), true);
  const farm = onboardingWorldGuidanceTargets(state).find(target => target.kind === "farmstead");
  assert.ok(farm);
  const building = placeBuilding(state, "farmstead", farm.origin);
  assert.ok(building.constructionSites.some(site => site.kind === "farmstead"));

  const targets = onboardingWorldGuidanceTargets(building);
  assert.equal(targets.filter(target => target.kind === "farmstead").length, 0);
  assert.ok(targets.some(target => target.kind === "mill"));
  assert.equal(ONBOARDING_TASKS[2]?.isComplete(building), false);
});

test("pending first farm and mill hold the first food step without duplicate markers", () => {
  const state = {
    ...DEFAULT_GAME_STATE,
    constructionSites: (["farmstead", "mill"] as const).map((kind, ordinal) =>
      createConstructionSite({ ordinal, kind, tx: 30 + ordinal * 3, ty: 30, startedTick: 0 })),
  };
  assert.equal(ONBOARDING_TASKS[2]?.isComplete(state), false);
  assert.deepEqual(onboardingWorldGuidanceTargets(state), []);
});

test("onboardingWorldGuidanceTargets follows task order with buildable production service and storage markers", () => {
  // Given
  let state = DEFAULT_GAME_STATE;
  const expectedKinds = ["farmstead", "mill", "sawmill"] as const satisfies readonly BuildingKind[];

  for (const kind of expectedKinds) {
    // When
    const result = placeGuidedMarkersUntilKind(state, kind);

    // Then
    assert.equal(result.finalTarget.kind, kind);
    state = result.state;
  }

  // AF-13: task-5's field expansion has no world marker of its own (the hint tells the player to paint);
  // once the field is wide enough the storehouse marker follows, same as any other buildable step.
  state = stateAfterExpandedFood(state);
  const storehouse = placeGuidedMarkersUntilKind(state, "storehouse");
  assert.equal(storehouse.finalTarget.kind, "storehouse");
});

test("onboarding marks a second storehouse that can join the timber delivery road", () => {
  const afterSawmill = placeGuidedMarkersUntilKind(stateAfterFoodChain(), "sawmill").state;
  const result = placeGuidedMarkersUntilKind(stateAfterExpandedFood(afterSawmill), "storehouse");

  assert.equal(result.finalTarget.kind, "storehouse");
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(result.state), true);
});

test("chapel guidance remains open while its construction site is unfinished", () => {
  const afterStorage = placeGuidedMarkersUntilKind(
    stateAfterExpandedFood(placeGuidedMarkersUntilKind(stateAfterFoodChain(), "sawmill").state),
    "storehouse",
  ).state;
  const chapel = requiredGuidanceTarget(afterStorage, "chapel");
  const pending = placeBuilding(afterStorage, "chapel", chapel.origin);

  assert.ok(pending.constructionSites.some(site => site.kind === "chapel"));
  assert.equal(ONBOARDING_TASKS[5]?.isComplete(pending), false);
  assert.ok(onboardingWorldGuidanceTargets(pending).every(target => target.kind !== "chapel" && target.kind !== "house"));
});

test("onboardingWorldGuidanceTargets returns non-overlapping buildable markers for available missing food-chain buildings", () => {
  // Given
  const state = stateAtFoodChainTargets();

  // When
  const targets = onboardingWorldGuidanceTargets(state);
  const foodTargets = targets.filter(
    (target) => target.kind === "wheat_farm" || target.kind === "mill" || target.kind === "granary",
  );

  // Then
  assert.ok(foodTargets.length >= 1);
  assert.ok(foodTargets.every((target) => ["wheat_farm", "mill", "granary"].includes(target.kind)));
  for (const target of foodTargets) {
    assert.notEqual(target.kind, "road");
    if (target.kind !== "road") assert.equal(canPlaceBuilding(state, target.kind, target.origin.tx, target.origin.ty).ok, true);
  }
  assert.equal(hasOverlappingFootprints(targets), false);
});

test("onboardingWorldGuidanceTargets keeps the early food task buildable when houses are placed first", () => {
  // AF-13: the farmstead marker only appears beside a painted field.
  const state = paintField(stateAtFoodChainTargets(), true);

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  assert.ok(targets.some((target) => target.kind === "farmstead"));
  assert.deepEqual(
    targets.filter((target) => target.kind === "house").map((target) => target.label),
    ["오두막 1/1"],
  );
  assert.equal(hasOverlappingFootprints(targets), false);

  let settlement = placeGuidedTargets(state, targets.filter((target) => target.kind === "house"));
  for (const kind of ["farmstead", "mill"] as const) {
    settlement = placeGuidedTargets(settlement, [requiredGuidanceTarget(settlement, kind)]);
  }
  assert.equal(settlement.houses.length, state.houses.length + 1);
  assert.equal(ONBOARDING_TASKS[2]?.isComplete(settlement), true);
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(settlement), false);
});

test("onboardingWorldGuidanceTargets marks sawmill, storage, and chapel before another house", () => {
  // Given
  const state = stateAfterFoodChain();

  // When
  const sawmill = placeGuidedMarkersUntilKind(state, "sawmill");
  const storehouse = placeGuidedMarkersUntilKind(stateAfterExpandedFood(sawmill.state), "storehouse");
  const chapel = placeGuidedMarkersUntilKind(storehouse.state, "chapel");
  const result = placeGuidedMarkersUntilKind(chapel.state, "house");

  // Then
  assert.equal(result.finalTarget.kind, "house");
  assert.equal(result.finalTarget.label, "오두막 1/1");
});

test("onboardingWorldGuidanceTargets guides another house after food, sawmill, storage, and chapel", () => {
  const afterStorage = placeGuidedMarkersUntilKind(
    stateAfterExpandedFood(placeGuidedMarkersUntilKind(stateAfterFoodChain(), "sawmill").state),
    "storehouse",
  ).state;
  const afterFoodChain = placeGuidedMarkersUntilKind(afterStorage, "chapel").state;
  const state =
    onboardingWorldGuidanceTargets(afterFoodChain)[0]?.kind === "road"
      ? placeGuidedRoad(afterFoodChain)
      : afterFoodChain;

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  assert.deepEqual(
    targets.map((target) => target.label),
    ["오두막 1/1"],
  );
  assert.deepEqual(
    targets.map((target) => target.kind),
    ["house"],
  );
  assert.equal(hasOverlappingFootprints(targets), false);

  const settlement = placeGuidedTargets(state, targets);
  assert.equal(settlement.houses.length, state.houses.length + 1);
});

function stateAfterFoodChain(): GameState {
  let state = stateAtFoodChainTargets();
  for (const kind of ["farmstead", "mill"] as const) {
    state = placeGuidedMarkersUntilKind(state, kind).state;
  }
  return state;
}

/**
 * AF-13: task-5's field expansion has no world marker (the hint tells the player to paint); a painted
 * field is a standing 2x2 block tended from the existing farmstead, same as the autoplay advisor's own
 * grain step (`fieldBlockAction`). Grow the field until it clears ONBOARDING_ARABLE_CELLS.
 */
function stateAfterExpandedFood(initialState: GameState): GameState {
  let state = initialState;
  while (arableCellCount(state) < ONBOARDING_ARABLE_CELLS) {
    state = paintField(state, false);
  }
  return state;
}

/** Paints a farmstead-tendable field block, same shape as the autoplay advisor's grain step. */
function paintField(state: GameState, newFarmsteadAllowed: boolean): GameState {
  const action = fieldBlockAction(state, newFarmsteadAllowed);
  if (action.kind !== "paint_zone") throw new Error(`No field to paint: ${JSON.stringify(action)}`);
  const command = autoplayActionToGameAction(action, state);
  if (command === null) throw new Error("Field paint action did not translate to a game action");
  return gameReducer(state, command);
}

function placeGuidedTargets(
  initialState: GameState,
  targets: readonly OnboardingGuidanceTarget[],
): GameState {
  let state = initialState;
  for (const target of targets) {
    if (target.kind === "road") throw new Error("Expected building guidance target");
    assert.equal(canPlaceBuilding(state, target.kind, target.origin.tx, target.origin.ty).ok, true);
    state = placeFinishedBuilding(state, target.kind, target.origin);
  }
  return state;
}

function requiredGuidanceTarget(state: GameState, kind: BuildingKind): OnboardingGuidanceTarget {
  const target = onboardingWorldGuidanceTargets(state).find((candidate) => candidate.kind === kind);
  if (target === undefined) throw new Error(`No guided ${kind} marker reached`);
  return target;
}

function stateAtFoodChainTargets(): GameState {
  let state = DEFAULT_GAME_STATE;
  while (onboardingWorldGuidanceTargets(state)[0]?.kind === "road") {
    state = placeGuidedRoad(state);
  }
  return state;
}

function placeGuidedMarkersUntilKind(
  initialState: GameState,
  kind: BuildingKind,
): { readonly state: GameState; readonly finalTarget: { readonly kind: BuildingKind; readonly label: string } } {
  let state = initialState;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const target = onboardingWorldGuidanceTargets(state)[0];
    // AF-13: a farmstead marker only exists beside a painted field; paint one first (the world has no
    // marker for that step, per the task hint) so the guided flow can still reach the farmstead.
    if (kind === "farmstead" && target?.kind !== "farmstead" && target?.kind !== "road") {
      state = paintField(state, true);
      continue;
    }
    assert.notEqual(target, undefined);
    if (target?.kind === "road") {
      assert.equal(target.label, onboardingRoadExtensionTargetLabel);
      state = placeGuidedRoad(state);
      continue;
    }

    assert.equal(target?.kind, kind);
    assert.equal(canPlaceBuilding(state, kind, target.origin.tx, target.origin.ty).ok, true);
    return {
      state: placeFinishedBuilding(state, kind, target.origin),
      finalTarget: { kind: target.kind, label: target.label },
    };
  }
  throw new Error(`No guided ${kind} marker reached`);
}

function placeGuidedRoad(state: GameState): GameState {
  const target = onboardingWorldGuidanceTargets(state)[0];
  assert.equal(target?.kind, "road");
  assert.equal(canPlaceRoad(state, target.origin), true);
  return placeRoadLine(state, target.origin, target.origin);
}

function hasOverlappingFootprints(targets: readonly OnboardingGuidanceTarget[]): boolean {
  const occupied = new Set<string>();
  for (const target of targets) {
    if (target.kind === "road") continue;
    const definition = BUILDING_CONFIG_BY_KIND[target.kind];
    for (let dy = 0; dy < definition.height; dy += 1) {
      for (let dx = 0; dx < definition.width; dx += 1) {
        const key = `${target.origin.tx + dx},${target.origin.ty + dy}`;
        if (occupied.has(key)) return true;
        occupied.add(key);
      }
    }
  }
  return false;
}
