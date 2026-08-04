export interface House {
  buildingId: string;
  level: number;
  residents: number;
  hasWater: boolean;
  breadStock: number;
  lastServicedTick: number;
  unmetRequirementTicks: number;
}
