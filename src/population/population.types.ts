export interface House {
  buildingId: string;
  level: number;
  builtLevel?: number;
  residents: number;
  hasWater: boolean;
  breadStock: number;
  lastServicedTick: number;
  emptyFoodTicks?: number;
  starvationGraceUntilTick?: number;
  unmetRequirementTicks: number;
  promotionTicks?: number;
}
