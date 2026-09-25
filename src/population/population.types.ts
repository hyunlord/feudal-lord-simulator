/** LB-1 (save v11): the household's adults and children (sum = residents) and the seed its members derive from. */
export interface HouseholdMembers {
  readonly adults: number;
  readonly children: number;
  readonly seed: number;
}

/** LB-8 (save v11): a household production slot with a product; slots without one are not stored. */
export interface HouseholdSlot {
  readonly craftId: string | null;
  readonly workers: number;
  readonly input: Readonly<Record<string, number>>;
  readonly output: Readonly<Record<string, number>>;
  /** Goods held in the house itself (LB-8): they never pass through a storehouse. */
  readonly stock: Readonly<Record<string, number>>;
}

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
  /** LB-1 (save v11). Absent only before the first housing update of a house built this tick. */
  members?: HouseholdMembers;
  /** LB-8 (save v11): slots that hold a product, by slot index. Absent = every slot empty. */
  crafts?: readonly HouseholdSlot[];
}
