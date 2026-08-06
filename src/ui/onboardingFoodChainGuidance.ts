import type { BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { canPlaceRoad } from "../world/roadGraph";
import {
  onboardingPopulationHouseTargetCount,
  populationHouseGuidanceTargets,
} from "./onboardingHouseGuidance";
import {
  manhattanDistance,
  reserveFootprint,
  type GuidanceGeometryWorld,
} from "./onboardingGuidanceGeometry";

const FOOD_CHAIN_KINDS = ["wheat_farm", "mill", "granary"] as const satisfies readonly BuildingKind[];
const LOCAL_PREP_RADIUS = 3;

type FoodGuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
>;

export type FoodChainTargetBuilder<TTarget> = (
  state: FoodGuidanceWorld,
  kind: BuildingKind,
  reserved: Set<string>,
) => TTarget | null;

export type FoodChainPrepTarget = {
  readonly kind: BuildingKind;
  readonly label: string;
  readonly origin: TileCoordinate;
};

export type FoodChainPrepResult =
  | { readonly kind: "targets"; readonly targets: readonly FoodChainPrepTarget[] }
  | { readonly kind: "road"; readonly origin: TileCoordinate };

export function isFoodChainTask(kinds: readonly BuildingKind[]): boolean {
  return kinds.length > 0 && kinds.every(isFoodChainKind);
}

export function foodChainTargetsWithHousePrep(
  state: FoodGuidanceWorld,
  kinds: readonly BuildingKind[],
  candidateOrigins: readonly TileCoordinate[],
  buildFoodTarget: FoodChainTargetBuilder<FoodChainPrepTarget>,
): FoodChainPrepResult {
  const currentTargets = foodAndHousePrepTargets(state, kinds, buildFoodTarget);
  if (hasAllFoodTargets(currentTargets, kinds) && hasFullHousePrep(currentTargets)) {
    return { kind: "targets", targets: currentTargets };
  }

  const roadTarget = roadTargetUnlockingFoodChainHousePrep(state, kinds, candidateOrigins, buildFoodTarget);
  if (roadTarget !== null) return { kind: "road", origin: roadTarget };
  return { kind: "targets", targets: currentTargets };
}

function foodAndHousePrepTargets(
  state: FoodGuidanceWorld,
  kinds: readonly BuildingKind[],
  buildFoodTarget: FoodChainTargetBuilder<FoodChainPrepTarget>,
): readonly FoodChainPrepTarget[] {
  const reserved = new Set<string>();
  const houseCandidates = localHousePrepCandidates(state);
  const houseTargets = populationHouseGuidanceTargets(state, houseCandidates, reserved);
  const foodTargets: FoodChainPrepTarget[] = [];

  for (const kind of kinds) {
    const target = buildFoodTarget(state, kind, reserved);
    if (target === null) continue;
    reserveFootprint(reserved, kind, target.origin);
    foodTargets.push(target);
  }

  return [...foodTargets, ...houseTargets];
}

function roadTargetUnlockingFoodChainHousePrep(
  state: FoodGuidanceWorld,
  kinds: readonly BuildingKind[],
  candidateOrigins: readonly TileCoordinate[],
  buildFoodTarget: FoodChainTargetBuilder<FoodChainPrepTarget>,
): TileCoordinate | null {
  const currentTargets = foodAndHousePrepTargets(state, kinds, buildFoodTarget);
  const currentHouseCount = housePrepCount(currentTargets);
  const currentFoodCount = foodTargetKindCount(currentTargets, kinds);
  let best: { readonly origin: TileCoordinate; readonly foodCount: number; readonly houseCount: number } | null = null;

  for (const origin of localRoadPrepCandidates(state, candidateOrigins)) {
    if (!canPlaceRoad(state, origin)) continue;
    const stateWithRoad = withRoad(state, origin);
    const targets = foodAndHousePrepTargets(stateWithRoad, kinds, buildFoodTarget);
    if (hasAllFoodTargets(targets, kinds) && hasFullHousePrep(targets)) return origin;
    const foodCount = foodTargetKindCount(targets, kinds);
    const houseCount = housePrepCount(targets);
    if (foodCount <= currentFoodCount && houseCount <= currentHouseCount) continue;
    if (best === null || foodCount > best.foodCount || houseCount > best.houseCount) {
      best = { origin, foodCount, houseCount };
    }
  }

  return best?.origin ?? null;
}

function localHousePrepCandidates(state: FoodGuidanceWorld): readonly TileCoordinate[] {
  const anchors = state.tiles
    .filter((tile) => tile.hasRoad)
    .flatMap((tile) => localNeighbors({ tx: tile.tx, ty: tile.ty }, state, LOCAL_PREP_RADIUS));
  return uniqueByDistance(anchors, { tx: 0, ty: 0 });
}

function localRoadPrepCandidates(
  state: FoodGuidanceWorld,
  candidateOrigins: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const anchors = state.tiles
    .filter((tile) => tile.hasRoad)
    .flatMap((tile) => localNeighbors({ tx: tile.tx, ty: tile.ty }, state, LOCAL_PREP_RADIUS));
  const localKeys = new Set(anchors.map((origin) => `${origin.tx},${origin.ty}`));
  return candidateOrigins.filter((origin) => localKeys.has(`${origin.tx},${origin.ty}`));
}

function localNeighbors(
  center: TileCoordinate,
  state: GuidanceGeometryWorld,
  radius: number,
): readonly TileCoordinate[] {
  const neighbors: TileCoordinate[] = [];
  for (let ty = center.ty - radius; ty <= center.ty + radius; ty += 1) {
    for (let tx = center.tx - radius; tx <= center.tx + radius; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      neighbors.push({ tx, ty });
    }
  }
  return neighbors;
}

function uniqueByDistance(
  candidates: readonly TileCoordinate[],
  center: TileCoordinate,
): readonly TileCoordinate[] {
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = `${candidate.tx},${candidate.ty}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const distance = manhattanDistance(left, center) - manhattanDistance(right, center);
      if (distance !== 0) return distance;
      if (left.ty !== right.ty) return left.ty - right.ty;
      return left.tx - right.tx;
    });
}

function isFoodChainKind(kind: BuildingKind): boolean {
  return FOOD_CHAIN_KINDS.some((foodKind) => foodKind === kind);
}

function hasAllFoodTargets(
  targets: readonly FoodChainPrepTarget[],
  kinds: readonly BuildingKind[],
): boolean {
  return foodTargetKindCount(targets, kinds) === kinds.length;
}

function foodTargetKindCount(
  targets: readonly FoodChainPrepTarget[],
  kinds: readonly BuildingKind[],
): number {
  return kinds.filter((kind) => targets.some((target) => target.kind === kind)).length;
}

function hasFullHousePrep(targets: readonly FoodChainPrepTarget[]): boolean {
  return housePrepCount(targets) === onboardingPopulationHouseTargetCount;
}

function housePrepCount(targets: readonly FoodChainPrepTarget[]): number {
  return targets.filter((target) => target.kind === "house").length;
}

function withRoad(state: FoodGuidanceWorld, origin: TileCoordinate): FoodGuidanceWorld {
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tile.tx === origin.tx && tile.ty === origin.ty ? { ...tile, hasRoad: true } : tile,
    ),
  };
}
