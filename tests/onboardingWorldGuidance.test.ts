import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { placeRoadLine } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { TileCoordinate } from "../src/world/grid";
import { canPlaceBuilding } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";
import { ONBOARDING_TASKS } from "../src/ui/onboardingTaskModel";
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

test("onboardingWorldGuidanceTargets advances from the road marker to an actually buildable logging camp marker", () => {
  // Given: task one is complete and task two needs a forest-adjacent logging camp.
  const state = placeRoadLine(DEFAULT_GAME_STATE, { tx: 1, ty: 0 }, { tx: 1, ty: 0 });

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.kind, "logging_camp");
  assert.equal(targets[0]?.label, "여기에 벌목소를 지으세요");
  assert.ok((targets[0]?.region?.length ?? 0) > 1);
  assert.equal(canPlaceBuilding(state, "logging_camp", targets[0]?.origin.tx ?? -1, targets[0]?.origin.ty ?? -1).ok, true);
});

test("onboardingWorldGuidanceTargets follows task order with buildable production service and storage markers", () => {
  // Given
  let state = DEFAULT_GAME_STATE;
  const expectedKinds = ["logging_camp", "sawmill", "storehouse"] as const satisfies readonly BuildingKind[];

  for (const kind of expectedKinds) {
    // When
    const result = placeGuidedMarkersUntilKind(state, kind);

    // Then
    assert.equal(result.finalTarget.kind, kind);
    state = result.state;
  }
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

test("onboardingWorldGuidanceTargets keeps task six buildable when houses are placed before food targets", () => {
  // Given: task six follows the default progression and road prep opens the full food-chain area.
  const state = stateAtFoodChainTargets();

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  assert.ok(targets.some((target) => target.kind === "wheat_farm"));
  assert.deepEqual(
    targets.filter((target) => target.kind === "house").map((target) => target.label),
    ["오두막 1/1"],
  );
  assert.equal(hasOverlappingFootprints(targets), false);

  let settlement = placeGuidedTargets(state, targets.filter((target) => target.kind === "house"));
  for (const kind of ["wheat_farm", "mill", "granary"] as const) {
    settlement = placeGuidedTargets(settlement, [requiredGuidanceTarget(settlement, kind)]);
  }
  assert.equal(settlement.houses.length, state.houses.length + 1);
  assert.equal(ONBOARDING_TASKS[5]?.isComplete(settlement), true);
});

test("onboardingWorldGuidanceTargets marks another buildable house after the food chain exists", () => {
  // Given
  const state = stateAfterFoodChain();

  // When
  const result = placeGuidedMarkersUntilKind(state, "house");

  // Then
  assert.equal(result.finalTarget.kind, "house");
  assert.equal(result.finalTarget.label, "오두막 1/1");
});

test("onboardingWorldGuidanceTargets guides four new houses together for the population thirty task", () => {
  // Given: production, storage, water, and food are established, then one road extension opens a house cluster.
  const afterFoodChain = stateAfterFoodChain();
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
  for (const kind of ["wheat_farm", "mill", "granary"] as const) {
    state = placeGuidedMarkersUntilKind(state, kind).state;
  }
  return state;
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
  for (const kind of ["logging_camp", "sawmill", "storehouse"] as const) {
    state = placeGuidedMarkersUntilKind(state, kind).state;
  }
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
