import { houseHasFood, houseIsStarving } from "../population/houseFood";
import { durationLabel } from "./gameTimeCopy.ko";
import { serviceDiagnosis, type ServiceDiagnosis } from "./serviceDiagnosisModel";
import type { Building } from "../content/buildingConfig";
import { historicalHouseAssetMeta } from "../render/historicalHouseAssets";
import { houseCompoundAssetManifest } from "../render/houseCompoundAssetManifest.generated";
import { assetUrlForBase } from "../render/worldAssets";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { buildingFootprint, houseLotArea } from "../geometry/buildingFootprint";
import { houseMergeOptions, houseMergeStatus, type HouseMergeOption } from "../engine/houseMerge";
import type { GameState } from "../engine/engine.types";
import { houseBuiltLevel, houseCondition, houseConditionLabel, type HouseCondition } from "../population/houseCondition";
import type { House } from "../population/population.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { palisadeProtectionForBuilding } from "../geometry/palisadeProtection";
import {
  missedHouseRouteReason,
  type DistributorRouteHistory,
  type DistributorRouteMissReason,
} from "./distributorRouteHistory";
import type { MarketAccessDiagnosis } from "../population/marketAccess";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";

export type WaterDiagnosis =
  | { readonly kind: "capacity" | "paused" | "understaffed" | "unreachable"; readonly label: string }
  | { readonly kind: "supplied"; readonly label: string; readonly distance: number }
  | { readonly kind: "no_well"; readonly label: "우물이 없습니다" }
  | {
      readonly kind: "well_too_far";
      readonly label: string;
      readonly distance: number;
      readonly serviceRadius: number;
    };

export type BreadDiagnosis =
  | { readonly kind: "supplied"; readonly label: "빵이 있습니다" }
  | { readonly kind: "no_granary"; readonly label: "곡창이 없습니다" }
  | {
      readonly kind: "granary_empty";
      readonly label: "곡창에 빵이 없습니다 — 방앗간 확인";
    }
  | {
      readonly kind: "road_disconnected";
      readonly label: "곡창에서 이 집까지 도로가 이어지지 않음";
    }
  | {
      readonly kind: "not_visited";
      readonly label: string;
      readonly route: DistributorMissedRouteDiagnosis | null;
    };

export type DistributorMissedRouteDiagnosis = DistributorRouteMissReason;

export type HouseDiagnosisModel = {
  readonly buildingId: string;
  readonly name: string;
  readonly thumbnailUrl: string | null;
  readonly level: number;
  readonly builtLevel: number;
  readonly condition: HouseCondition;
  readonly conditionLabel: string;
  readonly residents: number;
  readonly capacity: number;
  readonly footprintLabel: string;
  readonly mergeOptions: readonly HouseMergeOption[];
  readonly mergeStatus: string;
  readonly water: WaterDiagnosis;
  readonly bread: BreadDiagnosis;
  readonly population: PopulationDiagnosis;
  readonly protection: ProtectionDiagnosis;
  readonly market: MarketAccessDiagnosis | { readonly kind: "capacity" | "paused"; readonly label: string };
  readonly church: ServiceDiagnosis;
  readonly stoneHouse: StoneHouseDiagnosis;
};

export type PopulationDiagnosis =
  | { readonly kind: "declining"; readonly label: string; readonly elapsedTicks: number }
  | { readonly kind: "growth_blocked"; readonly label: "성장 정체 — 물 부족" | "성장 정체 — 식량 부족" }
  | { readonly kind: "stable"; readonly label: "유지 또는 성장 중" };

export type ProtectionDiagnosis =
  | { readonly kind: "inactive"; readonly label: "성벽 미완성"; readonly amenityBonus: 0 }
  | { readonly kind: "inside"; readonly label: "성벽 안 ✅ 편의 +2"; readonly amenityBonus: 2 }
  | { readonly kind: "outside"; readonly label: "성벽 밖 — 3등급 불가"; readonly amenityBonus: 0 };

export type StoneHouseDiagnosis =
  | { readonly kind: "ready"; readonly label: "도시 대가옥 가능"; readonly blockers: readonly [] }
  | { readonly kind: "blocked"; readonly label: string; readonly blockers: readonly string[] };

const HOUSE_NAMES = ["오두막", "소가옥", "장인가옥", "상인가옥", "도시 대가옥"] as const;

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function servingWaterDiagnosis(state: GameState, home: Building): WaterDiagnosis {
  const result = serviceDiagnosis(state, home, "water");
  switch (result.kind) {
    case "served": return { kind: "supplied", label: result.label, distance: result.distance };
    case "missing": return { kind: "no_well", label: "우물이 없습니다" };
    case "outside": return { kind: "well_too_far", label: result.label, distance: result.distance, serviceRadius: result.serviceRadius };
    case "paused": case "understaffed": case "unreachable": case "capacity": return { kind: result.kind, label: result.label };
  }
}

function servingMarketDiagnosis(state: GameState, home: Building): HouseDiagnosisModel["market"] {
  const result = serviceDiagnosis(state, home, "market");
  switch (result.kind) {
    case "served": return { ...result, kind: "within" };
    case "missing": return { kind: "no_market", label: "시장 없음", serviceRadius: result.serviceRadius };
    case "outside": case "paused": case "understaffed": case "unreachable": case "capacity": return { ...result, kind: result.kind };
  }
}

function populationDiagnosis(state: GameState, house: House): PopulationDiagnosis {
  const elapsedTicks = house.emptyFoodTicks ?? 0;
  if (houseIsStarving(house, state.tick)) {
    return {
      kind: "declining",
      label: `감소 중 — 식량 없음, ${durationLabel(elapsedTicks)} 경과`,
      elapsedTicks,
    };
  }
  if (house.hasWater && !houseHasFood(house) && state.tick > (house.starvationGraceUntilTick ?? 0)) {
    return { kind: "growth_blocked", label: "성장 정체 — 식량 부족" };
  }
  return house.hasWater
    ? { kind: "stable", label: "유지 또는 성장 중" }
    : { kind: "growth_blocked", label: "성장 정체 — 물 부족" };
}

function protectionDiagnosis(state: GameState, home: Building): ProtectionDiagnosis {
  const protection = palisadeProtectionForBuilding(home, state.palisade);
  switch (protection) {
    case "inactive":
      return { kind: "inactive", label: "성벽 미완성", amenityBonus: 0 };
    case "inside":
      return { kind: "inside", label: "성벽 안 ✅ 편의 +2", amenityBonus: 2 };
    case "outside":
      return { kind: "outside", label: "성벽 밖 — 3등급 불가", amenityBonus: 0 };
  }
}

function hasFreshBread(_state: GameState, house: House): boolean {
  return houseHasFood(house);
}

function stoneHouseDiagnosis(
  state: GameState,
  house: House,
  home: Building,
): StoneHouseDiagnosis {
  const blockers: string[] = [];
  if (serviceDiagnosis(state, home, "water").kind !== "served") blockers.push(servingWaterDiagnosis(state, home).label);
  if (!hasFreshBread(state, house)) blockers.push("신선한 빵 필요");
  const market = serviceDiagnosis(state, home, "market");
  const church = serviceDiagnosis(state, home, "church");
  if (market.kind !== "served") blockers.push(market.label);
  if (church.kind !== "served") blockers.push(church.label);
  if (palisadeProtectionForBuilding(home, state.palisade) !== "inside") {
    blockers.push("완성된 성벽 안 필요");
  }
  return blockers.length === 0
    ? { kind: "ready", label: "도시 대가옥 가능", blockers: [] }
    : {
        kind: "blocked",
        label: `도시 대가옥 불가 — ${blockers.join(" · ")}`,
        blockers,
      };
}

function connectedToBreadGranary(
  state: GameState,
  home: Building,
  granaries: readonly Building[],
): boolean {
  const houseRoads = buildingRoadAccessTiles(state, home);
  const component = existingRoadComponent(state, houseRoads);
  const componentKeys = new Set(component.map(coordinateKey));
  return granaries.some((granary) =>
    buildingRoadAccessTiles(state, granary).some((road) => componentKeys.has(coordinateKey(road))),
  );
}

function servingBreadDiagnosis(
  state: GameState,
  house: House,
  home: Building,
  history: DistributorRouteHistory | null,
): BreadDiagnosis {
  if (house.breadStock > 0) return { kind: "supplied", label: "빵이 있습니다" };
  const granaries = state.buildings.filter((building) => building.kind === "granary");
  if (granaries.length === 0) return { kind: "no_granary", label: "곡창이 없습니다" };
  const stockedGranaries = granaries.filter((granary) => (granary.inventory.bread ?? 0) > 0);
  if (stockedGranaries.length === 0) {
    return { kind: "granary_empty", label: "곡창에 빵이 없습니다 — 방앗간 확인" };
  }
  if (!connectedToBreadGranary(state, home, stockedGranaries)) {
    return { kind: "road_disconnected", label: "곡창에서 이 집까지 도로가 이어지지 않음" };
  }
  const route = missedHouseRouteReason({
    state,
    home,
    history,
    granaryIds: new Set(stockedGranaries.map((granary) => granary.id)),
  });
  if (route !== null) {
    return {
      kind: "not_visited",
      route,
      label: route.label,
    };
  }
  return {
    kind: "not_visited",
    label: "배급자 순회 기록 없음 — 다음 배급 후 다시 확인",
    route: null,
  };
}

export function houseDiagnosisModel(
  state: GameState,
  houseId: string,
  history: DistributorRouteHistory | null = null,
): HouseDiagnosisModel | null {
  const house = state.houses.find((candidate) => candidate.buildingId === houseId);
  const home = state.buildings.find((candidate) => candidate.id === houseId);
  if (house === undefined || home === undefined || home.kind !== "house") return null;
  const level = Math.max(0, Math.min(HOUSE_NAMES.length - 1, house.level));
  const builtLevel = houseBuiltLevel(house);
  const condition = houseCondition(house);
  const footprint = buildingFootprint(home);
  const compoundAsset = houseCompoundAssetManifest.find((asset) => asset.level === builtLevel && asset.axis === home.houseLot);
  const thumbnailUrl = home.houseLot === undefined ? historicalHouseAssetMeta(builtLevel)?.url ?? null
    : compoundAsset === undefined ? null : assetUrlForBase(compoundAsset.url, import.meta.env?.BASE_URL ?? "/");
  return {
    buildingId: house.buildingId,
    thumbnailUrl,
    name: `${HOUSE_NAMES[builtLevel] ?? HOUSE_NAMES[0]}${home.houseLot === undefined ? "" : " · 합필 주택"}`,
    capacity: (HOUSING_CONFIG.find((definition) => definition.level === level)?.capacity ?? HOUSING_CONFIG[0].capacity) * houseLotArea(home),
    footprintLabel: `${footprint.width}×${footprint.height}`,
    mergeOptions: houseMergeOptions(state, houseId),
    mergeStatus: houseMergeStatus(state, houseId),
    level,
    builtLevel,
    condition,
    conditionLabel: houseConditionLabel(condition),
    residents: house.residents,
    water: servingWaterDiagnosis(state, home),
    bread: servingBreadDiagnosis(state, house, home, history),
    population: populationDiagnosis(state, house),
    protection: protectionDiagnosis(state, home),
    market: servingMarketDiagnosis(state, home),
    church: serviceDiagnosis(state, home, "church"),
    stoneHouse: stoneHouseDiagnosis(state, house, home),
  };
}
