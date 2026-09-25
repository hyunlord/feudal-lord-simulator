import { type Building, type BuildingKind } from "../content/buildingConfig";
import { constructionMaterialSources } from "../agents/deliveryConstruction";
import { createConstructionSite } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../engine/simulationPorts";
import { getTile, type TileCoordinate } from "../world/grid";
import { canPlaceBuildingWithZones } from "../zones/zonePlacement";
import { canPlaceRoad } from "../world/roadGraph";
import {
  completedCoreOnboardingBuildings,
  missingCurrentBuildingKinds,
  storehouseOnTimberDeliveryRoad,
  timberDeliveryRoads,
  wellCompletesTask,
} from "./onboardingBuildingTaskProgress";
import {
  foodChainTargetsWithHousePrep as buildFoodChainTargetsWithHousePrep,
  isFoodChainTask,
} from "./onboardingFoodChainGuidance";
import { buildableForestAdjacentOrigins } from "./onboardingForestGuidance";
import {
  reserveFootprint,
  reservedOverlaps,
  sortedCandidateOrigins as sortCandidateOrigins,
} from "./onboardingGuidanceGeometry";
import {
  needsPopulationHouseGuidance,
  populationHouseGuidanceTargets,
} from "./onboardingHouseGuidance";

export const onboardingRoadTargetLabel = "여기에 길을 놓으세요";
export const onboardingRoadExtensionTargetLabel = "여기에 길을 이어주세요";

const STARTING_HOUSE_ID = "house-0-0-0";
const CARDINAL_OFFSETS = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
] as const satisfies readonly TileCoordinate[];

const BUILDING_TARGET_LABELS = {
  house: "여기에 오두막을 지으세요",
  well: "여기에 우물을 지으세요",
  storehouse: "여기에 창고를 지으세요",
  granary: "여기에 곡창을 지으세요",
  chapel: "여기에 예배당을 지으세요",
  wheat_farm: "여기에 밀밭을 지으세요",
  farmstead: "여기에 헛간을 지으세요",
  mill: "여기에 방앗간을 지으세요",
  logging_camp: "여기에 벌목소를 지으세요",
  sawmill: "여기에 제재소를 지으세요",
  quarry: "여기에 채석장을 지으세요",
  masonry: "여기에 석공소를 지으세요",
  market: "여기에 시장을 지으세요",
  church: "여기에 교회를 지으세요",
  keep: "여기에 성채를 지으세요",
} as const satisfies Readonly<Record<BuildingKind, string>>;
type GuidanceWorld = GameState;

export type OnboardingGuidanceTarget = {
  readonly kind: BuildingKind | "road";
  readonly label: string;
  readonly origin: TileCoordinate;
  readonly region?: readonly TileCoordinate[];
};

export function firstRoadTargetForOnboarding(state: GuidanceWorld): TileCoordinate | null {
  const house = startingHouse(state);
  if (house === null) return null;

  const candidates = adjacentCardinals(house);
  if (candidates.some((candidate) => getTile(state, candidate)?.hasRoad === true)) return null;

  return candidates.find((candidate) => canPlaceRoad(state, candidate)) ?? null;
}

// Memo for the per-frame guidance overlay (B11: ~14 ms per frame on a new game).
// Cache (AGENTS rule 10):
// (a) Key: the identity of every top-level GameState field except `tick`, `walkers` and `pathCache`. State updates
//     are immutable, so an unchanged field keeps its identity.
// (b) Left out: `tick` is only copied into a trial construction site's startedTick, which no route or placement check
//     reads; `walkers` is not read by any guidance rule; `pathCache` is a route cache whose contents never change a
//     route result. So a key match means the same targets.
// (c) Measured before/after `frameWorkMs` on the new-game benchmark: docs/verification/d1a/REPORT.md.
const GUIDANCE_KEY_IGNORED: ReadonlySet<string> = new Set(["tick", "walkers", "pathCache"]);
let guidanceMemo: { readonly fields: readonly string[]; readonly values: readonly unknown[]; readonly targets: readonly OnboardingGuidanceTarget[] } | null = null;
let guidanceMemoStats = { hits: 0, misses: 0 };

export function onboardingWorldGuidanceMemoStats(): Readonly<{ hits: number; misses: number }> {
  return { ...guidanceMemoStats };
}

export function onboardingWorldGuidanceTargets(
  state: GuidanceWorld,
): readonly OnboardingGuidanceTarget[] {
  const fields = Object.keys(state).filter(field => !GUIDANCE_KEY_IGNORED.has(field)).sort();
  const values = fields.map(field => (state as unknown as Record<string, unknown>)[field]);
  if (guidanceMemo !== null && guidanceMemo.fields.length === fields.length
    && guidanceMemo.fields.every((field, index) => field === fields[index] && guidanceMemo?.values[index] === values[index])) {
    guidanceMemoStats = { ...guidanceMemoStats, hits: guidanceMemoStats.hits + 1 };
    return guidanceMemo.targets;
  }
  guidanceMemoStats = { ...guidanceMemoStats, misses: guidanceMemoStats.misses + 1 };
  const targets = computeOnboardingWorldGuidanceTargets(state);
  guidanceMemo = { fields, values, targets };
  return targets;
}

function computeOnboardingWorldGuidanceTargets(
  state: GuidanceWorld,
): readonly OnboardingGuidanceTarget[] {
  const roadTarget = firstRoadTargetForOnboarding(state);
  if (roadTarget !== null) {
    return [{ kind: "road", label: onboardingRoadTargetLabel, origin: roadTarget }];
  }

  return buildingTargetsForCurrentTask(state);
}

function buildingTargetsForCurrentTask(state: GuidanceWorld): readonly OnboardingGuidanceTarget[] {
  const kinds = missingCurrentBuildingKinds(state);
  const foodChainTargets = foodChainGuidanceTargetsForTask(state, kinds);
  if (foodChainTargets !== null) return foodChainTargets;

  const targets: OnboardingGuidanceTarget[] = [];
  const reserved = new Set<string>();
  const candidateOrigins = sortedCandidateOrigins(state);

  for (const kind of kinds) {
    if (kind === "logging_camp") {
      const region = buildableForestAdjacentOrigins(state, kind, reserved, candidateOrigins);
      const origin = region[0] ?? null;
      if (origin === null) continue;
      reserveFootprint(reserved, kind, origin);
      targets.push({ kind, label: BUILDING_TARGET_LABELS[kind], origin, region });
      continue;
    }
    const origin = firstBuildableOriginForKind(state, kind, reserved, candidateOrigins);
    if (origin === null) continue;
    reserveFootprint(reserved, kind, origin);
    targets.push({ kind, label: BUILDING_TARGET_LABELS[kind], origin });
  }

  if (targets.length > 0) return targets;

  if (kinds.length === 0 && completedCoreOnboardingBuildings(state) && needsPopulationHouseGuidance(state)) {
    return populationHouseGuidanceTargets(state, candidateOrigins, reserved);
  }

  return targets;
}

function foodChainGuidanceTargetsForTask(
  state: GuidanceWorld,
  kinds: readonly BuildingKind[],
): readonly OnboardingGuidanceTarget[] | null {
  if (!isFoodChainTask(kinds)) return null;

  const candidateOrigins = sortedCandidateOrigins(state);
  const result = buildFoodChainTargetsWithHousePrep(state, kinds, candidateOrigins, (inputState, kind, reserved) => {
    const trialState = inputState.tiles === state.tiles
      ? state
      : { ...state, tiles: inputState.tiles, roadRevision: state.roadRevision + 1, pathCache: {} };
    const origin = firstBuildableOriginForKind(trialState, kind, reserved, candidateOrigins);
    return origin === null ? null : { kind, label: BUILDING_TARGET_LABELS[kind], origin };
  });
  return result.kind === "road"
    ? [{ kind: "road", label: onboardingRoadExtensionTargetLabel, origin: result.origin }]
    : result.targets;
}

function firstBuildableOriginForKind(
  state: GuidanceWorld,
  kind: BuildingKind,
  reserved: ReadonlySet<string>,
  candidateOrigins: readonly TileCoordinate[],
): TileCoordinate | null {
  const timberRoads = kind === "storehouse" ? timberDeliveryRoads(state) : null;
  for (const origin of candidateOrigins) {
    if (reservedOverlaps(kind, origin, reserved)) continue;
    if (kind === "well" && !wellCompletesTask(state, origin)) continue;
    if (timberRoads !== null && !storehouseOnTimberDeliveryRoad(state, origin, timberRoads)) continue;
    if (!canPlaceBuildingWithZones(state, kind, origin.tx, origin.ty).ok) continue;
    if (kind === "farmstead" && !hasFarmConstructionMaterialRoute(state, origin)) continue;
    return origin;
  }
  return null;
}

function hasFarmConstructionMaterialRoute(state: GameState, origin: TileCoordinate): boolean {
  const site = createConstructionSite({
    ordinal: state.nextConstructionOrdinal,
    kind: "farmstead",
    tx: origin.tx,
    ty: origin.ty,
    startedTick: state.tick,
  });
  const trialState = { ...state, constructionSites: [...state.constructionSites, site], pathCache: {} };
  return constructionMaterialSources({
    site,
    buildings: trialState.buildings,
    routes: createSimulationRoutePorts(trialState).delivery,
    inventory: createDeliveryInventoryPort(),
    treasuryTimber: trialState.treasuryTimber,
  }).some(source => source.hasRoute);
}

function sortedCandidateOrigins(state: GuidanceWorld): readonly TileCoordinate[] {
  const house = startingHouse(state);
  const center = house === null ? { tx: 0, ty: 0 } : { tx: house.tx, ty: house.ty };
  return sortCandidateOrigins(state, center);
}

function adjacentCardinals(house: Building): readonly TileCoordinate[] {
  return CARDINAL_OFFSETS.map((offset) => ({
    tx: house.tx + offset.tx,
    ty: house.ty + offset.ty,
  }));
}

function startingHouse(state: GuidanceWorld): Building | null {
  const canonical = state.buildings.find(
    (building) => building.id === STARTING_HOUSE_ID && building.kind === "house",
  );
  if (canonical !== undefined) return canonical;

  for (const house of state.houses) {
    const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
    if (building !== undefined && building.kind === "house") return building;
  }

  return state.buildings.find((building) => building.kind === "house") ?? null;
}
