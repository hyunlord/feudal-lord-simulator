import type { Building } from "../content/buildingConfig";
import type { DistributorWalker } from "./walker.types";

export const breadStock = (building: Building): number =>
  Math.max(0, building.inventory.bread ?? 0);

export function withBread(building: Building, amount: number): Building {
  const nextAmount = Math.max(0, Math.floor(amount));
  if (nextAmount === 0) {
    const { bread: _removed, ...remaining } = building.inventory;
    return { ...building, inventory: remaining };
  }
  return {
    ...building,
    inventory: { ...building.inventory, bread: nextAmount },
  };
}

export function replaceBuilding(
  buildings: readonly Building[],
  replacement: Building,
): readonly Building[] {
  return buildings.map((building) =>
    building.id === replacement.id ? replacement : building,
  );
}

export function restoreBread(
  buildings: readonly Building[],
  walker: DistributorWalker,
): readonly Building[] {
  const cargoAmount = walker.cargo?.resource === "bread" ? walker.cargo.amount : 0;
  if (cargoAmount === 0) return buildings;
  return buildings.map((building) =>
    building.id === walker.homeBuildingId
      ? withBread(building, breadStock(building) + cargoAmount)
      : building,
  );
}
