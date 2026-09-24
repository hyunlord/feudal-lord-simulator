import { houseGrowthPhase, houseHasFood, houseIsStarving, stepHouseFood } from "./houseFood";
import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import {
  HOUSING_CONFIG,
  type HousingDefinition,
  type HousingRequirement,
} from "../content/housingConfig";
import { houseLotArea } from "../geometry/buildingFootprint";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import {
  palisadeProtectionForBuilding,
  type PalisadeProtection,
  type PalisadeProtectionSource,
} from "../geometry/palisadeProtection";
import type { MarketRoadService } from "./marketAccess";
import { allocateHouseServices, type ServiceAllocation } from "./serviceAllocation";
import type { House } from "./population.types";
import { houseBuiltLevel } from "./houseCondition";

export type HouseUpdateContext = {
  readonly tick: number;
  readonly lotArea?: number;
  readonly hasGranaryNearby: boolean;
  readonly hasMarketAccess?: boolean;
  readonly hasChurchAccess?: boolean;
  readonly palisadeProtection?: PalisadeProtection;
};

export type HousingUpdate = {
  readonly houses: readonly House[];
  readonly population: number;
};

function houseBuilding(
  house: House,
  buildings: readonly Building[],
): Building | null {
  return buildings.find((building) => building.id === house.buildingId) ?? null;
}

export function applyWellService(
  houses: readonly House[],
  buildings: readonly Building[],
): readonly House[] {
  const services = allocateHouseServices({ houses, buildings });
  return houses.map((house) => {
    const hasWater = services.houses.get(house.buildingId)?.water.kind === "served";
    return hasWater === house.hasWater ? house : { ...house, hasWater };
  });
}

function requirementMet(
  requirement: HousingRequirement,
  house: House,
  context: HouseUpdateContext,
): boolean {
  switch (requirement) {
    case "water":
      return house.hasWater;
    case "bread":
      return houseHasFood(house);
    case "granary":
      return context.hasGranaryNearby;
    case "market":
      return context.hasMarketAccess === true;
    case "church":
      return context.hasChurchAccess === true;
    case "protected":
      return context.palisadeProtection === "inside";
  }
}

function supportedLevel(
  house: House,
  context: HouseUpdateContext,
): HousingDefinition["level"] {
  let supported: HousingDefinition["level"] = 0;
  for (const definition of HOUSING_CONFIG) {
    if (
      definition.requires.every((requirement) =>
        requirementMet(requirement, house, context),
      )
    ) {
      supported = definition.level;
    }
  }
  return supported;
}

function definitionForLevel(level: number): HousingDefinition {
  return HOUSING_CONFIG.find((definition) => definition.level === level) ??
    HOUSING_CONFIG[0];
}

function stepResidents(house: House, tick: number, lotArea: number): House {
  if (tick <= 0 || tick % BALANCE.GROWTH_INTERVAL !== houseGrowthPhase(house.buildingId)) return house;
  const breadAbsent = houseIsStarving(house, tick);

  if (breadAbsent) {
    return {
      ...house,
      residents: Math.max(0, house.residents - lotArea),
    };
  }

  const capacity = definitionForLevel(house.level).capacity * lotArea;
  if (house.hasWater && (houseHasFood(house) || tick <= (house.starvationGraceUntilTick ?? 0)) && house.residents < capacity) {
    return { ...house, residents: Math.min(capacity, house.residents + lotArea) };
  }
  return house;
}

export function updateHouse(
  house: House,
  context: HouseUpdateContext,
): House {
  house = stepHouseFood(house, context.tick);
  const supported = supportedLevel(house, context);
  const targetLevel =
    context.palisadeProtection === "outside" && house.level < 3
      ? Math.min(supported, 2)
      : supported;
  let updated = house;
  const next = HOUSING_CONFIG.find((definition) => definition.level === house.level + 1);
  const nextEligible = next !== undefined
    && !(context.palisadeProtection === "outside" && house.level < 3 && next.level >= 3)
    && next.requires.every((requirement) => requirementMet(requirement, house, context));

  if (nextEligible && next !== undefined) {
    const promotionTicks = (house.promotionTicks ?? 0) + 1;
    updated = promotionTicks >= next.promotionHoldTicks
      ? { ...house, level: next.level, promotionTicks: 0, unmetRequirementTicks: 0 }
      : { ...house, promotionTicks, unmetRequirementTicks: 0 };
  } else if (targetLevel >= house.level) {
    if (house.unmetRequirementTicks !== 0 || (house.promotionTicks ?? 0) !== 0) {
      updated = { ...house, unmetRequirementTicks: 0, promotionTicks: 0 };
    }
  } else {
    const unmetRequirementTicks = house.unmetRequirementTicks + 1;
    updated =
      unmetRequirementTicks >= BALANCE.DEVOLUTION_GRACE
        ? {
            ...house,
            level: Math.max(0, house.level - 1),
            unmetRequirementTicks: 0,
            promotionTicks: 0,
          }
        : { ...house, unmetRequirementTicks, promotionTicks: 0 };
  }

  return stepResidents({ ...updated, builtLevel: Math.max(houseBuiltLevel(house), updated.level) }, context.tick, context.lotArea ?? 1);
}

function hasGranaryNearby(
  house: House,
  buildings: readonly Building[],
): boolean {
  const home = houseBuilding(house, buildings);
  if (home === null) return false;
  const granaryRadius =
    HOUSING_CONFIG.find((definition) => definition.level === 3)
      ?.granaryRadius ?? 12;
  return buildings.some(
    (building) =>
      building.kind === "granary" && building.operationPaused !== true &&
      buildingFootprintDistance(home, building) <= granaryRadius,
  );
}

export function updateHousing(
  houses: readonly House[],
  buildings: readonly Building[],
  tick: number,
  palisade: PalisadeProtectionSource = null,
  marketService?: MarketRoadService,
  services: ServiceAllocation = allocateHouseServices({ houses, buildings, roadService: marketService }),
): HousingUpdate {
  const watered = houses.map(house => {
    const hasWater = services.houses.get(house.buildingId)?.water.kind === "served";
    return hasWater === house.hasWater ? house : { ...house, hasWater };
  });
  const updated = watered.map((house) => {
    const home = houseBuilding(house, buildings);
    return updateHouse(house, {
      tick,
      lotArea: houseLotArea(home ?? undefined),
      hasGranaryNearby: hasGranaryNearby(house, buildings),
      hasMarketAccess: services.houses.get(house.buildingId)?.market.kind === "served",
      hasChurchAccess: services.houses.get(house.buildingId)?.church.kind === "served",
      palisadeProtection:
        home === null ? "inactive" : palisadeProtectionForBuilding(home, palisade),
    });
  });
  return {
    houses: updated,
    population: updated.reduce(
      (total, house) => total + Math.max(0, house.residents),
      0,
    ),
  };
}

export function evolveHouse(
  house: House,
  context: HouseUpdateContext,
): House {
  return updateHouse(house, context);
}

export function housingLotCount(state: { readonly houses: readonly House[]; readonly buildings: readonly Building[] }): number {
  const buildings = new Map(state.buildings.map((building) => [building.id, building]));
  return state.houses.reduce((total, house) => total + houseLotArea(buildings.get(house.buildingId)), 0);
}
