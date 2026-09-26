/**
 * F0-A placement ledger prediction (spec docs/design/flow-pressure.md FP-2): what a building placed at a tile will do
 * to the ledger, for the UI's prediction line. Pure; it builds a hypothetical town with the building standing and asks
 * the same rules the period close and the service allocation use.
 *
 * - `rentPerPeriod` (homes): the rent the home pays per ledger period at the level the site's services give it within
 *   one period (L1 needs water and a 600-tick hold; L2 needs another 2,400, beyond one period). A home fills only with
 *   water and bread, so a home without water, or out of every granary distributor's road reach, pays nothing. A
 *   burgage plot scales the rent by its frontage (M-2).
 * - `upkeepPerPeriod`: the facility's upkeep per period (M-6), 0 for kinds without upkeep.
 * - `labourDemand`: the adults the building needs to run (its staffing), 0 for a home.
 * - `serviceCoverage`: for a well, market or church, the homes the service allocation would give it; for a granary,
 *   the homes within its L3 radius; for a home, the household services it would receive.
 */
import { BALANCE, MONEY_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building, type BuildingKind } from "../content/buildingConfig";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { LEDGER_PERIOD_TICKS } from "../ledger/ledger";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { allocateHouseServices, type HouseholdService } from "../population/serviceAllocation";
import type { House } from "../population/population.types";
import { feasibleDistributorDistance } from "./distributorAccess";
import type { GameState } from "./engine.types";
import { marketRoadService } from "./marketService";
import { homePlots, homeRent } from "./moneyRules";

export interface PlacementLedgerPrediction {
  /** Pennies per ledger period (2,400 ticks). */
  readonly rentPerPeriod: number;
  /** Pennies per ledger period. */
  readonly upkeepPerPeriod: number;
  /** Adults the building takes to run. */
  readonly labourDemand: number;
  readonly serviceCoverage: {
    /** Homes this facility would serve (well, market, church: the allocation; granary: its L3 radius). */
    readonly homesServed: number;
    /** Household services a home placed here would receive. */
    readonly services: readonly HouseholdService[];
  };
}

/** The id the hypothetical building takes; never a saved id. */
export const PREDICTION_BUILDING_ID = "placement-prediction";
const SERVICES: readonly HouseholdService[] = ["water", "market", "church"];
const PROVIDER_SERVICE: Partial<Record<BuildingKind, HouseholdService>> = { well: "water", market: "market", church: "church" };

function hypotheticalBuilding(kind: BuildingKind, tile: TileCoordinate): Building {
  return { id: PREDICTION_BUILDING_ID, kind, tx: tile.tx, ty: tile.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

function upkeepOf(kind: BuildingKind): number {
  return (MONEY_BALANCE.upkeep as Readonly<Record<string, number>>)[kind] ?? 0;
}

/** Highest level whose requirements the served services meet and whose promotion holds fit in one period. */
function levelWithinPeriod(served: ReadonlySet<HouseholdService>): number {
  let level = 0;
  let held = 0;
  for (const definition of HOUSING_CONFIG) {
    if (definition.level === 0) continue;
    held += definition.promotionHoldTicks;
    const met = definition.requires.every(requirement => (requirement === "water" || requirement === "market" || requirement === "church")
      && served.has(requirement));
    if (!met || held > LEDGER_PERIOD_TICKS) break;
    level = definition.level;
  }
  return level;
}

export function predictPlacementLedger(state: GameState, kind: BuildingKind, tile: TileCoordinate): PlacementLedgerPrediction {
  const building = hypotheticalBuilding(kind, tile);
  const home: House | null = kind === "house"
    ? { buildingId: building.id, level: 0, residents: 0, hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 }
    : null;
  const world: GameState = { ...state, buildings: [...state.buildings, building], houses: home === null ? state.houses : [...state.houses, home] };
  const allocation = allocateHouseServices({ houses: world.houses, buildings: world.buildings, roadService: marketRoadService(world) });
  const provided = PROVIDER_SERVICE[kind];
  let homesServed = 0;
  if (provided !== undefined) {
    for (const services of allocation.houses.values()) if (services[provided].kind === "served" && services[provided].providerId === building.id) homesServed += 1;
  } else if (kind === "granary") {
    const radius = HOUSING_CONFIG.find(definition => definition.level === 3)?.granaryRadius ?? 12;
    const homes = new Set(state.houses.map(house => house.buildingId));
    homesServed = state.buildings.filter(candidate => homes.has(candidate.id) && buildingFootprintDistance(candidate, building) <= radius).length;
  }
  const own = home === null ? undefined : allocation.houses.get(home.buildingId);
  const services = own === undefined ? [] : SERVICES.filter(service => own[service].kind === "served");
  let rentPerPeriod = 0;
  const fed = home !== null && world.buildings.some(granary => granary.kind === "granary" && !operationSuspended(granary)
    && (feasibleDistributorDistance(world, granary, building.id) ?? Infinity) <= BALANCE.DISTRIBUTOR_RANGE);
  if (home !== null && services.includes("water") && fed) {
    const plot = homePlots(world).get(building.id);
    rentPerPeriod = homeRent({ level: levelWithinPeriod(new Set(services)) }, plot?.width ?? null);
  }
  return {
    rentPerPeriod,
    upkeepPerPeriod: upkeepOf(kind),
    labourDemand: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    serviceCoverage: { homesServed, services },
  };
}
