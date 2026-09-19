import type { ResourceType } from "../content/resourceConfig";
import type { Building, BuildingDefinition } from "./economy.types";
import { availableSpace } from "./storage";

export type ProductionStep = {
  readonly building: Building;
  readonly produced: ResourceType | null;
};

const stock = (building: Building, resource: ResourceType): number =>
  Math.max(0, building.inventory[resource] ?? 0);

export type ProductionOperation = "not_producing" | "no_road" | "understaffed" | "no_input" | "output_full" | "working";

export function productionOperation(
  building: Building,
  definition: BuildingDefinition,
  hasRoad = true,
): ProductionOperation {
  const production = definition.production;
  if (production === null) return "not_producing";
  if (!hasRoad) return "no_road";
  if (building.workers < definition.workersRequired) return "understaffed";
  if (production.input !== null && stock(building, production.input) < production.inputPerOutput) return "no_input";
  const released = production.input === null ? 0 : production.inputPerOutput;
  if (availableSpace(building, definition) + released < 1) return "output_full";
  return "working";
}

export function stepProduction(
  building: Building,
  definition: BuildingDefinition,
): ProductionStep {
  const production = definition.production;
  if (production === null || productionOperation(building, definition) !== "working") {
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
