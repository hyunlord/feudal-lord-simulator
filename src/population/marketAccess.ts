import { operationSuspended, BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";

/**
 * CODE-1a: why a home has (or lacks) a market — a reason code and its distances only; the words are the UI's
 * (`ui/serviceDiagnosisCopy.ko.ts`), so the simulation imports no screen copy.
 */
export type MarketAccessDiagnosis =
  | { readonly kind: "within"; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "paused" | "unreachable" | "understaffed"; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "outside"; readonly distance: number; readonly serviceRadius: number }
  | { readonly kind: "no_market"; readonly serviceRadius: number };

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
  if (distance === null) return { kind: "no_market", serviceRadius };
  const nearby = completedMarkets(buildings).filter(market => buildingFootprintDistance(home, market) <= serviceRadius);
  if (nearby.length === 0) return { kind: "outside", distance, serviceRadius };
  const operating = nearby.filter(market => !operationSuspended(market));
  if (operating.length === 0) return { kind: "paused", distance, serviceRadius };
  const staffed = operating.filter(market => market.workers >= BUILDING_CONFIG_BY_KIND.market.workersRequired);
  if (staffed.length === 0) return { kind: "understaffed", distance, serviceRadius };
  const reachable = staffed.find(market => service?.(home, market) === true);
  if (reachable === undefined) return { kind: "unreachable", distance, serviceRadius };
  const servedDistance = buildingFootprintDistance(home, reachable);
  return { kind: "within", distance: servedDistance, serviceRadius };
}
