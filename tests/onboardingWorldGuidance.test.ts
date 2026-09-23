import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { constructionMaterialSources } from "../src/agents/deliveryConstruction";
import { createConstructionSite } from "../src/economy/construction";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
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

test("onboardingWorldGuidanceTargets advances from the authored opening to food before sawmill", () => {
  // Given: task one and two are complete in the authored default village.
  const state = placeRoadLine(DEFAULT_GAME_STATE, { tx: 1, ty: 0 }, { tx: 1, ty: 0 });

  // When
  const targets = onboardingWorldGuidanceTargets(state);

  // Then
  assert.ok(targets.some((target) => target.kind === "wheat_farm"));
  assert.ok(targets.some((target) => target.kind === "mill"));
  assert.ok(targets.every((target) => target.kind !== "sawmill"));
  for (const target of targets) {
    if (target.kind !== "road") assert.equal(canPlaceBuilding(state, target.kind, target.origin.tx, target.origin.ty).ok, true);
  }
});

test("food guidance waits for the first farm site without asking for a second before sawmill", () => {
  const state = placeRoadLine(DEFAULT_GAME_STATE, { tx: 1, ty: 0 }, { tx: 1, ty: 0 });
  const farm = onboardingWorldGuidanceTargets(state).find(target => target.kind === "wheat_farm");
  assert.ok(farm);
  const building = placeBuilding(state, "wheat_farm", farm.origin);
  assert.ok(building.constructionSites.some(site => site.kind === "wheat_farm"));

  const targets = onboardingWorldGuidanceTargets(building);
  assert.equal(targets.filter(target => target.kind === "wheat_farm").length, 0);
  assert.ok(targets.some(target => target.kind === "mill"));
  assert.equal(ONBOARDING_TASKS[2]?.isComplete(building), false);
});

test("second farm guidance has a real construction material route", () => {
  const state = placeGuidedMarkersUntilKind(
    placeGuidedMarkersUntilKind(
      placeGuidedMarkersUntilKind(DEFAULT_GAME_STATE, "wheat_farm").state, "mill",
    ).state, "sawmill",
  ).state;
  const targets = onboardingWorldGuidanceTargets(state);
  const marker = targets.find(target => target.kind === "wheat_farm");
  assert.ok(marker, JSON.stringify(targets));
  const site = createConstructionSite({
    ordinal: state.nextConstructionOrdinal,
    kind: "wheat_farm",
    tx: marker.origin.tx,
    ty: marker.origin.ty,
    startedTick: state.tick,
  });
  const trial = { ...state, constructionSites: [...state.constructionSites, site] };
  const sources = constructionMaterialSources({
    site,
    buildings: trial.buildings,
    routes: createSimulationRoutePorts(trial).delivery,
    inventory: createDeliveryInventoryPort(),
    treasuryTimber: trial.treasuryTimber,
  });
  assert.ok(sources.some(source => source.hasRoute));
});

test("second farm marker skips a nearer disconnected road island", () => {
  const buildings = [
    guidanceBuilding("house", 0, 0),
    guidanceBuilding("logging_camp", 8, 3),
    guidanceBuilding("wheat_farm", 0, 5),
    guidanceBuilding("mill", 5, 4),
    guidanceBuilding("granary", 7, 0),
    guidanceBuilding("storehouse", 7, 5, { timber: 60 }),
    guidanceBuilding("sawmill", 3, 6),
  ];
  const roads = new Set(["1,0", "2,0", "2,1", "2,2", "6,5", "6,4", "6,3", "6,2", "5,2", "4,2"]);
  const tiles = Array.from({ length: 80 }, (_, index) => {
    const tx = index % 10;
    const ty = Math.floor(index / 10);
    const occupant = buildings.find(building => {
      const size = BUILDING_CONFIG_BY_KIND[building.kind];
      return tx >= building.tx && tx < building.tx + size.width
        && ty >= building.ty && ty < building.ty + size.height;
    });
    return tile({ tx, ty }, { buildingId: occupant?.id ?? null, hasRoad: roads.has(`${tx},${ty}`) });
  });
  const state = {
    ...stateWith({ buildings, tiles, width: 10, height: 8 }),
    treasuryTimber: 0,
    constructionSites: [],
    pathCache: {},
  };
  assert.equal(canPlaceBuilding(state, "wheat_farm", 0, 1).ok, true);
  assert.deepEqual(canPlaceBuilding(state, "wheat_farm", 3, 3), { ok: true });
  const isolatedSite = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: "wheat_farm", tx: 0, ty: 1, startedTick: 0 });
  const candidateSite = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: "wheat_farm", tx: 3, ty: 3, startedTick: 0 });
  const candidateSource = buildings.find(building => building.kind === "storehouse");
  assert.ok(candidateSource);
  assert.equal(
    createSimulationRoutePorts({ ...state, constructionSites: [isolatedSite] }).delivery.fromBuildingToDestination(
      candidateSource.id,
      { kind: "construction_site", siteId: isolatedSite.id },
    ),
    null,
  );
  assert.notEqual(
    createSimulationRoutePorts({ ...state, constructionSites: [candidateSite] }).delivery.fromBuildingToDestination(
      candidateSource.id,
      { kind: "construction_site", siteId: candidateSite.id },
    ),
    null,
  );
  const targets = onboardingWorldGuidanceTargets(state);
  const marker = targets.find(target => target.kind === "wheat_farm");
  assert.ok(marker, JSON.stringify(targets));
  const site = createConstructionSite({
    ordinal: state.nextConstructionOrdinal,
    kind: "wheat_farm",
    tx: marker.origin.tx,
    ty: marker.origin.ty,
    startedTick: state.tick,
  });
  const source = buildings.find(building => building.kind === "storehouse");
  assert.ok(source);
  const trial = { ...state, constructionSites: [site] };
  const route = createSimulationRoutePorts(trial).delivery.fromBuildingToDestination(
    source.id,
    { kind: "construction_site", siteId: site.id },
  );
  assert.notEqual(route, null);
});

function guidanceBuilding(
  kind: BuildingKind,
  tx: number,
  ty: number,
  inventory: Building["inventory"] = {},
): Building {
  return {
    id: `${kind}-${tx}-${ty}`,
    kind,
    tx,
    ty,
    workers: 0,
    inventory,
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

test("pending first farm and mill hold the first food step without duplicate markers", () => {
  const state = {
    ...DEFAULT_GAME_STATE,
    constructionSites: (["wheat_farm", "mill"] as const).map((kind, ordinal) =>
      createConstructionSite({ ordinal, kind, tx: 30 + ordinal * 3, ty: 30, startedTick: 0 })),
  };
  assert.equal(ONBOARDING_TASKS[2]?.isComplete(state), false);
  assert.deepEqual(onboardingWorldGuidanceTargets(state), []);
});

test("one finished and one pending farm hold expansion without a third farm marker", () => {
  const state = placeGuidedMarkersUntilKind(stateAfterFoodChain(), "sawmill").state;
  const site = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: "wheat_farm", tx: 30, ty: 30, startedTick: 0 });
  const pending = { ...state, constructionSites: [...state.constructionSites, site] };

  assert.equal(ONBOARDING_TASKS[2]?.isComplete(pending), true);
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(pending), false);
  assert.ok(onboardingWorldGuidanceTargets(pending).every(target => target.kind !== "wheat_farm"));
});

test("onboardingWorldGuidanceTargets follows task order with buildable production service and storage markers", () => {
  // Given
  let state = DEFAULT_GAME_STATE;
  const expectedKinds = ["wheat_farm", "mill", "sawmill", "wheat_farm"] as const satisfies readonly BuildingKind[];

  for (const kind of expectedKinds) {
    // When
    const result = placeGuidedMarkersUntilKind(state, kind);

    // Then
    assert.equal(result.finalTarget.kind, kind);
    state = result.state;
  }
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
  for (const kind of ["wheat_farm", "mill"] as const) {
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
  for (const kind of ["wheat_farm", "mill"] as const) {
    state = placeGuidedMarkersUntilKind(state, kind).state;
  }
  return state;
}

function stateAfterExpandedFood(initialState: GameState): GameState {
  let state = initialState;
  for (const kind of ["wheat_farm", "granary"] as const) {
    if (kind === "granary" && state.buildings.some(building => building.kind === "granary")) continue;
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
