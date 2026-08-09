import type { Building, BuildingDefinition } from "./economy.types";

export function advanceProduction(
  building: Building,
  definition: BuildingDefinition,
): Building {
  if (definition.production === null) return building;

  const nextProgress = building.productionProgress + 1;
  if (nextProgress < definition.production.ticksPerOutput) {
    return {
      ...building,
      productionProgress: nextProgress,
    };
  }

  const input = definition.production.input;
  const currentInput = input === null ? 0 : building.inventory[input] ?? 0;
  if (input !== null && currentInput < definition.production.inputPerOutput) {
    return {
      ...building,
      productionProgress: definition.production.ticksPerOutput - 1,
    };
  }

  const nextInventory = { ...building.inventory };
  if (input !== null) {
    nextInventory[input] = currentInput - definition.production.inputPerOutput;
  }
  nextInventory[definition.production.output] =
    (nextInventory[definition.production.output] ?? 0) + 1;

  return {
    ...building,
    inventory: nextInventory,
    productionProgress: 0,
  };
}
