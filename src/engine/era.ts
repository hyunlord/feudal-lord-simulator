import type { EraRequirement, GameState } from "./engine.types";
import { createStoneWallConstructionSite } from "../economy/construction";
import { placementSpendableResource } from "../world/placement";
import { snapshotWallConstructionReserve } from "./constructionReserve";

import type { Condition, ConditionSet } from "../content/scenario/types";
import type { EraRequirementKey } from "../content/eraConfig";
import { scenarioOf } from "./scenarioState";
import { scenarioById, stageDef } from "../content/scenario/registry";

const ERA_REQUIREMENT_LABELS = {
  population: "인구",
  granary: "곡창",
  chapel: "예배당",
  timber: "목재",
  market: "시장",
  masonry: "석공소",
  stone: "석재",
  coin: "금화",
} as const;

/** Market-town (palisade proclamation) targets of the default scenario, derived from its stage data. */
export const PALISADE_REQUIREMENT_TARGETS = (() => {
  const target = (match: (condition: Condition) => number | null): number => {
    for (const condition of stageDef(scenarioById(undefined), "market_town").enterWhen.all) {
      const value = match(condition);
      if (value !== null) return value;
    }
    throw new Error("default market-town stage lacks a proclamation target");
  };
  return {
    population: target(c => c.kind === "population_at_least" ? c.value : null),
    granary: target(c => c.kind === "building_count_at_least" && c.building === "granary" ? c.value : null),
    chapel: target(c => c.kind === "building_count_at_least" && c.building === "chapel" ? c.value : null),
    timber: target(c => c.kind === "spendable_resource_at_least" && c.resource === "timber" ? c.value : null),
  } as const;
})();

export function spendableTimberForEraRequirement(state: GameState): number {
  return placementSpendableResource(state, "timber");
}

export function spendableStoneForEraRequirement(state: GameState): number {
  return placementSpendableResource(state, "stone");
}

/** One displayed requirement row per proclamation condition; unrepresentable conditions are structural. */
function requirementRow(state: GameState, condition: Condition): EraRequirement | null {
  const row = (key: EraRequirementKey, current: number, target: number): EraRequirement =>
    ({ key, label: ERA_REQUIREMENT_LABELS[key], current, target, met: current >= target });
  switch (condition.kind) {
    case "population_at_least": return row("population", state.population, condition.value);
    case "building_count_at_least": {
      const key = condition.building;
      if (key !== "granary" && key !== "chapel" && key !== "market" && key !== "masonry") return null;
      return row(key, state.buildings.filter((building) => building.kind === key).length, condition.value);
    }
    case "spendable_resource_at_least": return condition.resource === "timber"
      ? row("timber", spendableTimberForEraRequirement(state), condition.value)
      : row("stone", spendableStoneForEraRequirement(state), condition.value);
    case "treasury_coin_at_least": return row("coin", state.treasuryCoin, condition.value);
    default: return null;
  }
}

function requirementRows(state: GameState, sets: readonly (ConditionSet | undefined)[]): readonly EraRequirement[] {
  return sets.flatMap(set => set?.all ?? []).flatMap(condition => requirementRow(state, condition) ?? []);
}

function marketTownRequirements(state: GameState): readonly EraRequirement[] {
  return requirementRows(state, [stageDef(scenarioOf(state), "market_town").enterWhen]);
}

/** Stone-wall project (fortified-town) prerequisites; empty rows when the scenario has no stone wall. */
function stoneWallRequirements(state: GameState): readonly EraRequirement[] {
  const scenario = scenarioOf(state);
  return requirementRows(state, [stageDef(scenario, "fortified_town").enterWhen, scenario.walls.stoneWallPrereq]);
}

export function stoneWallProjectAvailable(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).walls.stoneWall !== "off";
}

export function evaluateEraRequirements(state: GameState): readonly EraRequirement[] {
  return state.era === "hamlet"
    ? marketTownRequirements(state)
    : stoneWallRequirements(state);
}

export function canProclaimPalisadeEra(state: GameState): boolean {
  return state.era === "hamlet" && marketTownRequirements(state).every((requirement) => requirement.met);
}

/** Opens the optional stone-wall project (K4-1); never available when the scenario turns it off. */
export function canProclaimStoneTownEra(state: GameState): boolean {
  return state.era === "palisade" && stoneWallProjectAvailable(state)
    && stoneWallRequirements(state).every((requirement) => requirement.met);
}

export function stoneReplacementSiteId(segmentId: string): string {
  return `${segmentId}-stone`;
}

export function confirmStoneTownProclamation(state: GameState): GameState {
  if (!canProclaimStoneTownEra(state)) return state;
  const replacementSegments = state.palisade?.segments.filter((segment) => segment.completed) ?? [];
  const replacementSites = replacementSegments.map((segment) =>
    createStoneWallConstructionSite({
      id: stoneReplacementSiteId(segment.id),
      wallId: state.palisade?.id ?? "",
      segmentIndex: segment.order,
      gateDistance: segment.gateDistance ?? segment.order,
      order: segment.order,
      path: segment.edgePath,
      startedTick: state.tick,
    }),
  ) ?? [];
  return {
    ...state,
    era: "stone_town",
    eraProclaimedTick: state.tick,
    palisade: state.palisade === null
      ? null
      : {
          ...state.palisade,
          segments: state.palisade.segments.map((segment) => ({
            ...segment,
            material: segment.material ?? "timber",
            replacementConstructionSiteId: segment.completed ? stoneReplacementSiteId(segment.id) : null,
          })),
        },
    constructionSites: [...state.constructionSites, ...replacementSites],
    wallConstructionReserve: snapshotWallConstructionReserve(state, replacementSites, "stone"),
  };
}
