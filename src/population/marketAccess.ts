import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";

export type MarketAccessDiagnosis =
  | { readonly kind: "within"; readonly label: string; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "outside"; readonly label: string; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "no_market"; readonly label: "시장 없음"; readonly serviceRadius: number };

function completedMarkets(buildings: readonly Building[]): readonly Building[] {
  return buildings.filter((building) => building.kind === "market");
}

export function nearestMarketDistance(
  home: Building,
  buildings: readonly Building[],
): number | null {
  const distances = completedMarkets(buildings).map((market) =>
    buildingFootprintDistance(home, market),
  );
  return distances.length === 0 ? null : Math.min(...distances);
}

export function hasMarketAccess(
  home: Building,
  buildings: readonly Building[],
): boolean {
  const distance = nearestMarketDistance(home, buildings);
  return distance !== null && distance <= BUILDING_CONFIG_BY_KIND.market.serviceRadius;
}

export function marketAccessDiagnosis(
  home: Building,
  buildings: readonly Building[],
): MarketAccessDiagnosis {
  const serviceRadius = BUILDING_CONFIG_BY_KIND.market.serviceRadius;
  const distance = nearestMarketDistance(home, buildings);
  if (distance === null) {
    return { kind: "no_market", label: "시장 없음", serviceRadius };
  }
  if (distance <= serviceRadius) {
    return {
      kind: "within",
      label: `시장 이용 가능 — 거리 ${distance} / 범위 ${serviceRadius}`,
      distance,
      serviceRadius,
    };
  }
  return {
    kind: "outside",
    label: `시장이 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}`,
    distance,
    serviceRadius,
  };
}
