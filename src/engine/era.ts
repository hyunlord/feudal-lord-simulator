import type { EraRequirement, GameState } from "./engine.types";
import type { BuildingKind } from "../content/buildingConfig";
import { createStoneWallConstructionSite } from "../economy/construction";
import { placementSpendableResource } from "../world/placement";

const PALISADE_REQUIREMENT_TARGETS = {
  population: 60,
  granary: 1,
  chapel: 1,
  timber: 250,
} as const;

const STONE_TOWN_REQUIREMENT_TARGETS = {
  population: 140,
  market: 1,
  masonry: 1,
  stone: 400,
  coin: 200,
} as const;

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

function finishedBuildingCount(state: GameState, kind: BuildingKind): number {
  return state.buildings.filter((building) => building.kind === kind).length;
}

export function spendableTimberForEraRequirement(state: GameState): number {
  return placementSpendableResource(state, "timber");
}

export function spendableStoneForEraRequirement(state: GameState): number {
  return placementSpendableResource(state, "stone");
}

function evaluatePalisadeEraRequirements(state: GameState): readonly EraRequirement[] {
  const requirements = [
    {
      key: "population",
      current: state.population,
      target: PALISADE_REQUIREMENT_TARGETS.population,
    },
    {
      key: "granary",
      current: finishedBuildingCount(state, "granary"),
      target: PALISADE_REQUIREMENT_TARGETS.granary,
    },
    {
      key: "chapel",
      current: finishedBuildingCount(state, "chapel"),
      target: PALISADE_REQUIREMENT_TARGETS.chapel,
    },
    {
      key: "timber",
      current: spendableTimberForEraRequirement(state),
      target: PALISADE_REQUIREMENT_TARGETS.timber,
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

function evaluateStoneTownEraRequirements(state: GameState): readonly EraRequirement[] {
  const requirements = [
    {
      key: "population",
      current: state.population,
      target: STONE_TOWN_REQUIREMENT_TARGETS.population,
    },
    {
      key: "market",
      current: finishedBuildingCount(state, "market"),
      target: STONE_TOWN_REQUIREMENT_TARGETS.market,
    },
    {
      key: "masonry",
      current: finishedBuildingCount(state, "masonry"),
      target: STONE_TOWN_REQUIREMENT_TARGETS.masonry,
    },
    {
      key: "stone",
      current: spendableStoneForEraRequirement(state),
      target: STONE_TOWN_REQUIREMENT_TARGETS.stone,
    },
    {
      key: "coin",
      current: state.treasuryCoin,
      target: STONE_TOWN_REQUIREMENT_TARGETS.coin,
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

export function evaluateEraRequirements(state: GameState): readonly EraRequirement[] {
  return state.era === "hamlet"
    ? evaluatePalisadeEraRequirements(state)
    : evaluateStoneTownEraRequirements(state);
}

export function canProclaimPalisadeEra(state: GameState): boolean {
  return state.era === "hamlet" && evaluatePalisadeEraRequirements(state).every((requirement) => requirement.met);
}

export function canProclaimStoneTownEra(state: GameState): boolean {
  return state.era === "palisade" && evaluateStoneTownEraRequirements(state).every((requirement) => requirement.met);
}

function stoneReplacementSiteId(segmentId: string): string {
  return `${segmentId}-stone`;
}

export function confirmStoneTownProclamation(state: GameState): GameState {
  if (!canProclaimStoneTownEra(state)) return state;
  const replacementSites = state.palisade?.segments.map((segment) =>
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
            replacementConstructionSiteId: stoneReplacementSiteId(segment.id),
          })),
        },
    constructionSites: [...state.constructionSites, ...replacementSites],
  };
}
