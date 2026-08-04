import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "./economy.types";

export interface StockReservation {
  buildingId: string;
  resource: ResourceType;
  amount: number;
}

export function reserveStock(
  _building: Building,
  _reservation: StockReservation,
): Building {
  throw new Error("not implemented");
}
