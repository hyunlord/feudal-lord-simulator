import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { SETTLEMENT_CONFIG } from "../src/content/settlementConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { hasPendingFoodChain } from "../src/engine/autoplayFood";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { settlementMetrics } from "../src/engine/settlementMetrics";
import { houseLotArea } from "../src/geometry/buildingFootprint";
import { housingLotCount } from "../src/population/housing";
import type { HouseholdService, ServiceAccessKind } from "../src/population/serviceAllocation";

export const SERVICES = ["water", "market", "church"] as const;
export function parseGrowthOptions(args: readonly string[]) {
  const targetLots = Number(args[0] ?? 16);
  const maxTicks = Number(args[1] ?? 600_000);
  if (!Number.isInteger(targetLots) || targetLots < 1 || targetLots > 48 ||
      !Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 600_000) {
    throw new RangeError("targetLots must be 1..48 and maxTicks must be 1..600000");
  }
  return { targetLots, maxTicks };
}
function serviceCounts(): Record<ServiceAccessKind, number> {
  return { served: 0, missing: 0, outside: 0, understaffed: 0, unreachable: 0, capacity: 0 };
}
export function houseCapacity(state: GameState): number {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  return state.houses.reduce((sum, house) => sum + (HOUSING_CONFIG.find(item => item.level === house.level)?.capacity ?? 0)
    * houseLotArea(buildings.get(house.buildingId)), 0);
}
export function totalBread(state: GameState): number {
  return state.houses.reduce((sum, house) => sum + house.breadStock, 0) +
    state.buildings.reduce((sum, building) => sum + (building.inventory.bread ?? 0), 0);
}
export function growthGuards(state: GameState, targetLots: number): readonly string[] {
  const guards: string[] = [];
  const lots = housingLotCount(state);
  if (state.era === "stone_town") guards.push("post-era-housing-disabled");
  if (lots >= targetLots) guards.push("lot-limit");
  if (state.idleWorkers <= 6) guards.push("idle-workers-at-most-six");
  if (state.population < houseCapacity(state)) guards.push("housing-not-full");
  if (totalBread(state) < 20) guards.push("bread-below-twenty");
  if (hasPendingFoodChain(state)) guards.push("pending-food-chain");
  const farms = state.buildings.filter(building => building.kind === "wheat_farm").length;
  if (lots >= Math.max(4, Math.floor(farms * 5 / 3))) guards.push("food-supported-lot-limit");
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === "house")) guards.push("pending-house");
  return guards;
}
export function growthSnapshot(state: GameState) {
  const allocation = householdServices(state);
  const services: Record<HouseholdService, Record<ServiceAccessKind, number>> = {
    water: serviceCounts(), market: serviceCounts(), church: serviceCounts(),
  };
  for (const access of allocation.houses.values()) for (const service of SERVICES) services[service][access[service].kind] += 1;
  return {
    tick: state.tick, era: state.era, houses: state.houses.length, lots: housingLotCount(state),
    occupiedHouses: state.houses.filter(house => house.residents > 0).length,
    population: state.population, capacity: houseCapacity(state), idleWorkers: state.idleWorkers,
    l4Houses: state.houses.filter(house => house.level === 4).length,
    constructionSites: state.constructionSites.length,
    bread: totalBread(state), minimumHouseBread: Math.min(...state.houses.map(house => house.breadStock)),
    occupiedBreadZeroHouses: state.houses.filter(house => house.residents > 0 && house.breadStock === 0).length,
    services, providers: [...allocation.providers].map(([id, provider]) => ({ id, ...provider })),
    buildingCounts: Object.fromEntries([...new Set(state.buildings.map(building => building.kind))]
      .map(kind => [kind, state.buildings.filter(building => building.kind === kind).length])),
    outcome: state.settlement?.outcome ?? "ongoing",
  };
}
export function prosperityEligible(state: GameState): boolean {
  const metrics = settlementMetrics(state);
  return metrics.occupiedHouses > 0 && metrics.suppliedPercent >= SETTLEMENT_CONFIG.servicePercent &&
    metrics.population >= SETTLEMENT_CONFIG.prosperityPopulation && state.era === "stone_town" &&
    metrics.completedStoneWall && metrics.occupiedL4Lots >= SETTLEMENT_CONFIG.prosperityOccupiedL4Lots;
}
export function fullServicePopulation(state: GameState): boolean {
  const allocation = householdServices(state);
  return state.houses.length > 0 && state.constructionSites.length === 0 && state.population === houseCapacity(state) &&
    state.houses.every(house => house.level === 4) && [...allocation.houses.values()]
      .every(access => SERVICES.every(service => access[service].kind === "served"));
}
export function invalidGrowthResources(state: GameState): boolean {
  return state.buildings.some(building => [building.inventory, building.reserved, building.stockReserved]
    .some(ledger => Object.values(ledger).some(amount => !Number.isFinite(amount) || amount < 0))) ||
    state.houses.some(house => !Number.isFinite(house.breadStock) || house.breadStock < 0);
}
