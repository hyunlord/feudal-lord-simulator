import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "./economy.types";

export interface ResourceDemand {
  requesterBuildingId: string;
  resource: ResourceType;
  amount: number;
}

export function findNearestSource(
  buildings: readonly Building[],
  demand: ResourceDemand,
): Building | null {
  return (
    buildings.find(
      (building) =>
        building.id !== demand.requesterBuildingId &&
        (building.inventory[demand.resource] ?? 0) >= demand.amount,
    ) ?? null
  );
}
