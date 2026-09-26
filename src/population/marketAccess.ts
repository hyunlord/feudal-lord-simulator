import { operationSuspended, BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { SERVICE_DIAGNOSIS_COPY } from "../ui/serviceDiagnosisCopy.ko";
import { buildingFootprintDistance } from "../geometry/buildingDistance";

export type MarketAccessDiagnosis =
  | { readonly kind: "within"; readonly label: string; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "paused" | "unreachable" | "understaffed"; readonly label: string; readonly distance: number; readonly serviceRadius: number }
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

/**
 * Road connection between a home and a market or church (a wall crossed only at gates). MARKET-1 (MK-1): the engine's
 * service also carries `marketReach`, the market's reach along the road (steps), which replaces the market's radius.
 */
export type MarketRoadService = ((home: Building, market: Building) => boolean) & {
  readonly marketReach?: (home: Building, market: Building) => boolean;
};

export function hasMarketAccess(home: Building, buildings: readonly Building[], service?: MarketRoadService): boolean {
  return marketAccessDiagnosis(home, buildings, service).kind === "within";
}

export function marketAccessDiagnosis(home: Building, buildings: readonly Building[], service?: MarketRoadService): MarketAccessDiagnosis {
  const serviceRadius = BUILDING_CONFIG_BY_KIND.market.serviceRadius;
  const distance = nearestMarketDistance(home, buildings);
  if (distance === null) return { kind: "no_market", label: "시장 없음", serviceRadius };
  const nearby = completedMarkets(buildings).filter(market => buildingFootprintDistance(home, market) <= serviceRadius);
  if (nearby.length === 0) return { kind: "outside", label: `시장이 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}`, distance, serviceRadius };
  const operating = nearby.filter(market => !operationSuspended(market));
  if (operating.length === 0) return { kind: "paused", label: SERVICE_DIAGNOSIS_COPY.paused, distance, serviceRadius };
  const staffed = operating.filter(market => market.workers >= BUILDING_CONFIG_BY_KIND.market.workersRequired);
  if (staffed.length === 0) return { kind: "understaffed", label: "가까운 시장의 일꾼이 부족합니다", distance, serviceRadius };
  const reachable = staffed.find(market => service?.(home, market) === true);
  if (reachable === undefined) return { kind: "unreachable", label: "시장까지 연결된 도로가 없습니다", distance, serviceRadius };
  const servedDistance = buildingFootprintDistance(home, reachable);
  return { kind: "within", label: `시장 이용 가능 — 거리 ${servedDistance} / 범위 ${serviceRadius}`, distance: servedDistance, serviceRadius };
}
