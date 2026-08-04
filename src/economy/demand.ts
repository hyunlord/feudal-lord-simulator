import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "./economy.types";

export interface ResourceDemand {
  requesterBuildingId: string;
  resource: ResourceType;
  amount: number;
}

export function findNearestSource(
  _buildings: readonly Building[],
  _demand: ResourceDemand,
): Building | null {
  throw new Error("not implemented");
}
