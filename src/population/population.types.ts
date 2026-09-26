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
  /** FP-3 (save v12): the household has been short of food since this tick without a break. Absent = fed. */
  foodShortSinceTick?: number;
  /** FP-3 stage 1 (save v12): the household has been preparing to leave since this tick (`떠날 준비`). */
  leavingSinceTick?: number;
  /** FP-3 stage 2 (save v12): the household left at this tick; the house stands empty and pays no rent (not demolished). */
  abandonedTick?: number;
  /** FP-4 (save v12): the winter ration's carried fraction, thousandths of a bread (0–999). Absent = 0. */
  winterRationCarry?: number;
}
