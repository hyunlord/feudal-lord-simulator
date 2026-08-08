export interface House {
  buildingId: string;
  level: number;
  residents: number;
  hasWater: boolean;
  breadStock: number;
  lastServicedTick: number;
  starvationGraceUntilTick?: number;
  unmetRequirementTicks: number;
}
