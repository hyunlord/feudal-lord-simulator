import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "./economy.types";

export interface StockReservation {
  buildingId: string;
  resource: ResourceType;
  amount: number;
}

export function reserveStock(
  building: Building,
  reservation: StockReservation,
): Building {
  const current = building.inventory[reservation.resource] ?? 0;
  const remaining = Math.max(0, current - reservation.amount);
  return {
    ...building,
    inventory: {
      ...building.inventory,
      [reservation.resource]: remaining,
    },
  };
}
