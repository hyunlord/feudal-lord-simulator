import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingFootprintDistance } from "../world/buildingDistance";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";

export type WaterDiagnosis =
  | { readonly kind: "supplied"; readonly label: "우물 공급 중" }
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
      readonly label: "배급자가 이 집을 지나가지 않음 — 경로가 멀거나 순회 범위 밖";
    };

export type HouseDiagnosisModel = {
  readonly buildingId: string;
  readonly name: string;
  readonly level: number;
  readonly residents: number;
  readonly water: WaterDiagnosis;
  readonly bread: BreadDiagnosis;
};

const HOUSE_NAMES = ["오두막", "농가", "시민가옥", "장원저택"] as const;

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
    return { kind: "supplied", label: "우물 공급 중" };
  }
  return {
    kind: "well_too_far",
    label: `우물이 너무 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}`,
    distance,
    serviceRadius,
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
  return {
    kind: "not_visited",
    label: "배급자가 이 집을 지나가지 않음 — 경로가 멀거나 순회 범위 밖",
  };
}

export function houseDiagnosisModel(
  state: GameState,
  houseId: string,
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
    bread: servingBreadDiagnosis(state, house, home),
  };
}
