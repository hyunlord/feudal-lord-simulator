import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { DistributorWalker } from "./walker.types";

export interface BreadRestoreResult {
  readonly buildings: readonly Building[];
  readonly remaining: number;
}

const stockTotal = (
  record: Building["inventory"] | Building["reserved"],
): number => Object.values(record).reduce(
  (total, amount) => total + Math.max(0, amount ?? 0),
  0,
);

const reservedBread = (building: Building): number =>
  Math.max(0, building.reserved.bread ?? 0);

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

function withReservedBread(building: Building, amount: number): Building {
  const nextAmount = Math.max(0, Math.floor(amount));
  if (nextAmount === 0) {
    const { bread: _removed, ...remaining } = building.reserved;
    return { ...building, reserved: remaining };
  }
  return {
    ...building,
    reserved: { ...building.reserved, bread: nextAmount },
  };
}

export function reserveBreadCapacity(
  building: Building,
  amount: number,
): Building {
  return withReservedBread(building, reservedBread(building) + amount);
}

export function releaseBreadCapacity(
  buildings: readonly Building[],
  homeBuildingId: string,
  amount: number,
): readonly Building[] {
  return buildings.map((building) =>
    building.id === homeBuildingId
      ? withReservedBread(
          building,
          reservedBread(building) - Math.max(0, amount),
        )
      : building,
  );
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
): BreadRestoreResult {
  const cargoAmount = walker.cargo?.resource === "bread" ? walker.cargo.amount : 0;
  if (cargoAmount === 0) return { buildings, remaining: 0 };
  let remaining = cargoAmount;
  const restored = buildings.map((building) => {
    if (building.id !== walker.homeBuildingId) return building;
    const claim = Math.min(reservedBread(building), cargoAmount);
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    const occupiedAfterClaim =
      stockTotal(building.inventory) + stockTotal(building.reserved) - claim;
    const available = Math.max(0, definition.storageCapacity - occupiedAfterClaim);
    const restoredAmount = Math.min(cargoAmount, available);
    remaining = cargoAmount - restoredAmount;
    return withReservedBread(
      withBread(building, breadStock(building) + restoredAmount),
      reservedBread(building) - Math.min(claim, restoredAmount),
    );
  });
  return { buildings: restored, remaining };
}
