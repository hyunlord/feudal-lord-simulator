import type { EraRequirement, GameState } from "./engine.types";
import { placementSpendableResource } from "../world/placement";

const ERA_REQUIREMENT_TARGETS = {
  population: 60,
  granary: 1,
  chapel: 1,
  timber: 250,
} as const;

const ERA_REQUIREMENT_LABELS = {
  population: "인구",
  granary: "곡창",
  chapel: "예배당",
  timber: "목재",
} as const;

function finishedBuildingCount(state: GameState, kind: "granary" | "chapel"): number {
  return state.buildings.filter((building) => building.kind === kind).length;
}

export function spendableTimberForEraRequirement(state: GameState): number {
  return placementSpendableResource(state, "timber");
}

export function evaluateEraRequirements(state: GameState): readonly EraRequirement[] {
  const requirements = [
    {
      key: "population",
      current: state.population,
      target: ERA_REQUIREMENT_TARGETS.population,
    },
    {
      key: "granary",
      current: finishedBuildingCount(state, "granary"),
      target: ERA_REQUIREMENT_TARGETS.granary,
    },
    {
      key: "chapel",
      current: finishedBuildingCount(state, "chapel"),
      target: ERA_REQUIREMENT_TARGETS.chapel,
    },
    {
      key: "timber",
      current: spendableTimberForEraRequirement(state),
      target: ERA_REQUIREMENT_TARGETS.timber,
    },
  ] as const;

  return requirements.map((requirement) => ({
    key: requirement.key,
    label: ERA_REQUIREMENT_LABELS[requirement.key],
    current: requirement.current,
    target: requirement.target,
    met: requirement.current >= requirement.target,
  }));
}

export function canProclaimPalisadeEra(state: GameState): boolean {
  return state.era === "hamlet" && evaluateEraRequirements(state).every((requirement) => requirement.met);
}
