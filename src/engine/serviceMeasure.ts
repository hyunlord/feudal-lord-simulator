/**
 * QA033 (spec docs/design/market-reach.md MK-1): how far a home is from a service, by the ruler the service's rule uses —
 * a market by road steps (MARKET-1: within `MARKET_ROAD_REACH` steps of its road access, a radius no longer), the well
 * and the church by footprint tiles within the building's service radius. The screens said "거리 4 / 범위 8" for a market
 * (tiles against the old radius) beside "길 40걸음" (the rule): one ruler per service, carried with the numbers.
 */
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { HOUSEHOLD_SERVICE_CONFIG, type HouseholdService } from "../population/serviceAllocation";
import type { GameState } from "./engine.types";
import { householdServices } from "./householdServices";
import { MARKET_ROAD_REACH, marketRoadDistance } from "./marketService";

export interface ServiceMeasure {
  /** The ruler: road steps from the provider's road access, or tiles between the footprints. */
  readonly measure: "road_steps" | "tiles";
  /** The distance to the serving provider, else to the nearest by that ruler; null when none is reachable by it. */
  readonly distance: number | null;
  /** The most the rule allows on that ruler. */
  readonly limit: number;
  readonly providerId: string | null;
}

/** QA033 API: a home's distance from a service and the limit, in the ruler the service's rule judges by. */
export function serviceMeasure(state: GameState, home: Building, service: HouseholdService): ServiceMeasure {
  const config = HOUSEHOLD_SERVICE_CONFIG[service];
  const providers = state.buildings.filter(building => building.kind === config.kind).sort((a, b) => a.id.localeCompare(b.id));
  const servedBy = householdServices(state).houses.get(home.id)?.[service]?.providerId ?? null;
  const roads = service === "market";
  const measureOf = roads ? marketRoadDistance(state) : (from: Building, to: Building) => buildingFootprintDistance(from, to);
  const measured = providers.map(provider => ({ id: provider.id, distance: measureOf(home, provider) }));
  const served = measured.find(entry => entry.id === servedBy);
  const nearest = measured.filter(entry => entry.distance !== null).sort((a, b) => a.distance! - b.distance! || a.id.localeCompare(b.id))[0];
  const chosen = served ?? nearest;
  return { measure: roads ? "road_steps" : "tiles", distance: chosen?.distance ?? null,
    limit: roads ? MARKET_ROAD_REACH : BUILDING_CONFIG_BY_KIND[config.kind].serviceRadius, providerId: chosen?.id ?? null };
}
