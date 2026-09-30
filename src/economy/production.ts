import { operationSuspended } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { Building, BuildingDefinition } from "./economy.types";
import { availableSpace } from "./storage";

export type ProductionStep = {
  readonly building: Building;
  readonly produced: ResourceType | null;
};

const stock = (building: Building, resource: ResourceType): number =>
  Math.max(0, building.inventory[resource] ?? 0);

export type ProductionOperation = "paused" | "not_producing" | "no_road" | "understaffed" | "no_input" | "output_full" | "working";

export function productionOperation(
  building: Building,
  definition: BuildingDefinition,
  hasRoad = true,
): ProductionOperation {
  if (operationSuspended(building)) return "paused";
  const production = definition.production;
  if (production === null) return "not_producing";
  if (!hasRoad) return "no_road";
  if (building.workers < definition.workersRequired) return "understaffed";
  if (production.input !== null && stock(building, production.input) < production.inputPerOutput) return "no_input";
  // C5 (CL-6): a second good each output uses (the dyehouse's dyes).
  if (production.alsoConsumes !== undefined && stock(building, production.alsoConsumes.resource) < production.alsoConsumes.amount) return "no_input";
  const released = production.input === null ? 0 : production.inputPerOutput;
  if (availableSpace(building, definition) + released < 1) return "output_full";
  if (production.outputHoldLimit !== undefined && stock(building, production.output) >= production.outputHoldLimit) return "output_full";
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
  if (production.alsoConsumes !== undefined) {
    inventory[production.alsoConsumes.resource] = stock(building, production.alsoConsumes.resource) - production.alsoConsumes.amount;
  }
  inventory[production.output] =
    Math.max(0, inventory[production.output] ?? 0) + 1;

  // FIX-11 (14): when the dyehouse completes a bolt, assign a dye colour deterministically. Colour cycles
  // woad → madder → weld by total bolts produced so far (woad+madder+weld in dyedColours).
  let dyedColours = building.dyedColours;
  if (building.kind === "dyehouse" && production.output === "dyed_cloth") {
    const dc = building.dyedColours ?? { woad: 0, madder: 0, weld: 0 };
    const total = dc.woad + dc.madder + dc.weld;
    const colours = ["woad", "madder", "weld"] as const;
    const colour = colours[total % 3] ?? "woad";
    dyedColours = { ...dc, [colour]: dc[colour] + 1 };
  }

  return {
    building: {
      ...building,
      inventory,
      productionProgress: 0,
      ...(dyedColours !== building.dyedColours ? { dyedColours } : {}),
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
