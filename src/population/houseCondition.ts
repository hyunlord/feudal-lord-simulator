import type { House } from "./population.types";

export type HouseCondition = "maintained" | "strained" | "neglected" | "vacant";

export function houseBuiltLevel(house: House): number {
  return Math.max(house.level, house.builtLevel ?? house.level);
}

export function houseCondition(house: House): HouseCondition {
  const lostLevels = houseBuiltLevel(house) - house.level;
  if (house.residents <= 0) return "vacant";
  if (lostLevels >= 2 || house.unmetRequirementTicks >= 1200) return "neglected";
  if (lostLevels <= 0) return "maintained";
  return lostLevels === 1 ? "strained" : "neglected";
}

export function houseConditionLabel(condition: HouseCondition): string {
  switch (condition) {
    case "maintained": return "관리 양호";
    case "strained": return "관리 부족";
    case "neglected": return "보수 필요";
    case "vacant": return "빈집";
  }
}
