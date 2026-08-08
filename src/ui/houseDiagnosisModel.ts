import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { palisadeProtectionForBuilding } from "../geometry/palisadeProtection";
import {
  missedHouseRouteReason,
  type DistributorRouteHistory,
  type DistributorRouteMissReason,
} from "./distributorRouteHistory";
import {
  marketAccessDiagnosis,
  type MarketAccessDiagnosis,
} from "../population/marketAccess";
import { nearestMarketDistance } from "../population/marketAccess";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";

export type WaterDiagnosis =
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
  readonly level: number;
  readonly residents: number;
  readonly water: WaterDiagnosis;
  readonly bread: BreadDiagnosis;
  readonly population: PopulationDiagnosis;
  readonly protection: ProtectionDiagnosis;
  readonly market: MarketAccessDiagnosis;
  readonly stoneHouse: StoneHouseDiagnosis;
};

export type PopulationDiagnosis =
  | { readonly kind: "declining"; readonly label: string; readonly elapsedTicks: number }
  | { readonly kind: "growth_blocked"; readonly label: "성장 정체 — 물 부족" }
  | { readonly kind: "stable"; readonly label: "유지 또는 성장 중" };

export type ProtectionDiagnosis =
  | { readonly kind: "inactive"; readonly label: "성벽 미완성"; readonly amenityBonus: 0 }
  | { readonly kind: "inside"; readonly label: "성벽 안 ✅ 편의 +2"; readonly amenityBonus: 2 }
  | { readonly kind: "outside"; readonly label: "성벽 밖 — 3등급 불가"; readonly amenityBonus: 0 };

export type StoneHouseDiagnosis =
  | { readonly kind: "ready"; readonly label: "석조 연립가옥 가능"; readonly blockers: readonly [] }
  | { readonly kind: "blocked"; readonly label: string; readonly blockers: readonly string[] };

const HOUSE_NAMES = ["오두막", "농가", "시민가옥", "장원저택", "석조 연립가옥"] as const;

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function servingWaterDiagnosis(
  house: House,
  home: Building,
  wells: readonly Building[],
): WaterDiagnosis {
  if (wells.length === 0) return { kind: "no_well", label: "우물이 없습니다" };
  const serviceRadius = BUILDING_CONFIG_BY_KIND.well.serviceRadius;
  const distances = wells.map((well) => buildingFootprintDistance(home, well));
  const distance = Math.min(...distances);
  if (house.hasWater || distance <= serviceRadius) {
    return { kind: "supplied", label: `우물에서 ${distance}칸`, distance };
  }
  return {
    kind: "well_too_far",
    label: `우물이 너무 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}`,
    distance,
    serviceRadius,
  };
}

function populationDiagnosis(state: GameState, house: House): PopulationDiagnosis {
  const elapsedTicks = Math.max(0, state.tick - house.lastServicedTick);
  if (elapsedTicks > BALANCE.STARVATION_WINDOW) {
    return {
      kind: "declining",
      label: `감소 중 — 식량 없음, ${elapsedTicks}틱 경과`,
      elapsedTicks,
    };
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

function hasFreshBread(state: GameState, house: House): boolean {
  return (
    house.breadStock > 0 &&
    state.tick - house.lastServicedTick <= BALANCE.BREAD_HUNGER_WINDOW
  );
}

function hasChurchAccess(home: Building, buildings: readonly Building[]): boolean {
  return buildings.some(
    (building) =>
      building.kind === "church" &&
      buildingFootprintDistance(home, building) <=
        BUILDING_CONFIG_BY_KIND.church.serviceRadius,
  );
}

function stoneHouseDiagnosis(
  state: GameState,
  house: House,
  home: Building,
): StoneHouseDiagnosis {
  const blockers: string[] = [];
  if (!house.hasWater) blockers.push("물 공급 필요");
  if (!hasFreshBread(state, house)) blockers.push("신선한 빵 필요");
  const marketDistance = nearestMarketDistance(home, state.buildings);
  if (
    marketDistance === null ||
    marketDistance > BUILDING_CONFIG_BY_KIND.market.serviceRadius
  ) {
    blockers.push("시장 범위 8 안 필요");
  }
  if (!hasChurchAccess(home, state.buildings)) {
    blockers.push("교회 범위 12 안 필요");
  }
  if (palisadeProtectionForBuilding(home, state.palisade) !== "inside") {
    blockers.push("완성된 성벽 안 필요");
  }
  return blockers.length === 0
    ? { kind: "ready", label: "석조 연립가옥 가능", blockers: [] }
    : {
        kind: "blocked",
        label: `석조 연립가옥 불가 — ${blockers.join(" · ")}`,
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
  return {
    buildingId: house.buildingId,
    name: HOUSE_NAMES[level] ?? HOUSE_NAMES[0],
    level,
    residents: house.residents,
    water: servingWaterDiagnosis(
      house,
      home,
      state.buildings.filter((building) => building.kind === "well"),
    ),
    bread: servingBreadDiagnosis(state, house, home, history),
    population: populationDiagnosis(state, house),
    protection: protectionDiagnosis(state, home),
    market: marketAccessDiagnosis(home, state.buildings),
    stoneHouse: stoneHouseDiagnosis(state, house, home),
  };
}
