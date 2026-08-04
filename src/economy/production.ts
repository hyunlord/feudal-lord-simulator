import type { ResourceType } from "../content/resourceConfig";
import type { Building, BuildingDefinition } from "./economy.types";
import { availableSpace } from "./storage";

export type ProductionStep = {
  readonly building: Building;
  readonly produced: ResourceType | null;
};

const stock = (building: Building, resource: ResourceType): number =>
  Math.max(0, building.inventory[resource] ?? 0);

function hasRequiredInput(
  building: Building,
  definition: BuildingDefinition,
): boolean {
  const production = definition.production;
  if (production === null || production.input === null) return true;
  return stock(building, production.input) >= production.inputPerOutput;
}

function hasOutputCapacity(
  building: Building,
  definition: BuildingDefinition,
): boolean {
  const inputReleased = definition.production?.inputPerOutput ?? 0;
  return availableSpace(building, definition) + inputReleased >= 1;
}

export function stepProduction(
  building: Building,
  definition: BuildingDefinition,
): ProductionStep {
  const production = definition.production;
  if (
    production === null ||
    building.workers < definition.workersRequired ||
    !hasRequiredInput(building, definition)
  ) {
    return { building, produced: null };
  }

  const progress = Math.min(
    production.ticksPerOutput,
    building.productionProgress + 1,
  );
  if (progress < production.ticksPerOutput) {
    return {
      building: { ...building, productionProgress: progress },
      produced: null,
    };
  }

  if (!hasOutputCapacity(building, definition)) {
    return {
      building: {
        ...building,
        productionProgress: production.ticksPerOutput,
      },
      produced: null,
    };
  }

  const inventory = { ...building.inventory };
  if (production.input !== null) {
    inventory[production.input] =
      stock(building, production.input) - production.inputPerOutput;
  }
  inventory[production.output] =
    Math.max(0, inventory[production.output] ?? 0) + 1;

  return {
    building: {
      ...building,
      inventory,
      productionProgress: 0,
    },
    produced: production.output,
  };
}

export function advanceProduction(
  building: Building,
  definition: BuildingDefinition,
): Building {
  return stepProduction(building, definition).building;
}
