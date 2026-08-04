import { BALANCE } from "../content/balanceConfig";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import {
  HOUSING_CONFIG,
  type HousingDefinition,
  type HousingRequirement,
} from "../content/housingConfig";
import type { House } from "./population.types";

export type HouseUpdateContext = {
  readonly tick: number;
  readonly hasGranaryNearby: boolean;
};

export type HousingUpdate = {
  readonly houses: readonly House[];
  readonly population: number;
};

type Footprint = {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
};

function footprint(building: Building): Footprint {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return {
    minTx: building.tx,
    minTy: building.ty,
    maxTx: building.tx + definition.width - 1,
    maxTy: building.ty + definition.height - 1,
  };
}

function axisDistance(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
): number {
  if (firstMax < secondMin) return secondMin - firstMax;
  if (secondMax < firstMin) return firstMin - secondMax;
  return 0;
}

function buildingDistance(first: Building, second: Building): number {
  const firstFootprint = footprint(first);
  const secondFootprint = footprint(second);
  return (
    axisDistance(
      firstFootprint.minTx,
      firstFootprint.maxTx,
      secondFootprint.minTx,
      secondFootprint.maxTx,
    ) +
    axisDistance(
      firstFootprint.minTy,
      firstFootprint.maxTy,
      secondFootprint.minTy,
      secondFootprint.maxTy,
    )
  );
}

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
  const wells = buildings.filter((building) => building.kind === "well");
  return houses.map((house) => {
    const home = houseBuilding(house, buildings);
    const hasWater =
      home !== null &&
      wells.some(
        (well) =>
          buildingDistance(home, well) <=
          BUILDING_CONFIG_BY_KIND.well.serviceRadius,
      );
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
      return (
        house.breadStock > 0 &&
        context.tick - house.lastServicedTick <= BALANCE.BREAD_HUNGER_WINDOW
      );
    case "granary":
      return context.hasGranaryNearby;
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

function stepResidents(house: House, tick: number): House {
  if (tick <= 0 || tick % BALANCE.GROWTH_INTERVAL !== 0) return house;
  const breadAbsent =
    house.breadStock === 0
      ? tick > BALANCE.STARVATION_WINDOW
      : tick - house.lastServicedTick > BALANCE.STARVATION_WINDOW;

  if (breadAbsent) {
    return {
      ...house,
      residents: Math.max(0, house.residents - 1),
    };
  }

  const capacity = definitionForLevel(house.level).capacity;
  if (house.hasWater && house.residents < capacity) {
    return { ...house, residents: house.residents + 1 };
  }
  return house;
}

export function updateHouse(
  house: House,
  context: HouseUpdateContext,
): House {
  const targetLevel = supportedLevel(house, context);
  let updated = house;

  if (targetLevel > house.level) {
    updated = {
      ...house,
      level: targetLevel,
      unmetRequirementTicks: 0,
    };
  } else if (targetLevel === house.level) {
    if (house.unmetRequirementTicks !== 0) {
      updated = { ...house, unmetRequirementTicks: 0 };
    }
  } else {
    const unmetRequirementTicks = house.unmetRequirementTicks + 1;
    updated =
      unmetRequirementTicks >= BALANCE.DEVOLUTION_GRACE
        ? {
            ...house,
            level: Math.max(0, house.level - 1),
            unmetRequirementTicks: 0,
          }
        : { ...house, unmetRequirementTicks };
  }

  return stepResidents(updated, context.tick);
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
      building.kind === "granary" &&
      buildingDistance(home, building) <= granaryRadius,
  );
}

export function updateHousing(
  houses: readonly House[],
  buildings: readonly Building[],
  tick: number,
): HousingUpdate {
  const watered = applyWellService(houses, buildings);
  const updated = watered.map((house) =>
    updateHouse(house, {
      tick,
      hasGranaryNearby: hasGranaryNearby(house, buildings),
    }),
  );
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
