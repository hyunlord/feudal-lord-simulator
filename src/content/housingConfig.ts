export const HOUSE_LEVELS = [0, 1, 2, 3] as const;

export type HousingRequirement = "water" | "bread" | "granary";

export interface HousingDefinition {
  readonly level: (typeof HOUSE_LEVELS)[number];
  readonly name: string;
  readonly requires: readonly HousingRequirement[];
  readonly capacity: number;
  readonly granaryRadius?: number;
}

export const HOUSING_CONFIG = [
  { level: 0, name: "오두막", requires: [], capacity: 4 },
  { level: 1, name: "농가", requires: ["water"], capacity: 8 },
  { level: 2, name: "시민가옥", requires: ["water", "bread"], capacity: 14 },
  {
    level: 3,
    name: "장원저택",
    requires: ["water", "bread", "granary"],
    capacity: 22,
    granaryRadius: 12,
  },
] as const satisfies readonly HousingDefinition[];
