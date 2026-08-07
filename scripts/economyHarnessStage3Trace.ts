import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { evaluateEraRequirements } from "../src/engine/era";
import type { GameState } from "../src/engine/engine.types";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { advanceTick } from "../src/engine/tick";
import { hashEconomyState, sortedResources } from "./economyHarnessSerializer";
import {
  STAGE3_MAX_REQUIREMENT_TICK,
  STAGE3_MAX_WALL_COMPLETION_TICKS,
  STAGE3_PALISADE_PATH,
  STAGE3_PROCLAMATION_TICK,
} from "./economyHarnessStage3Scenario";

export interface Stage3RunTrace {
  readonly hash: string;
  readonly requirementsMetTick: number | null;
  readonly proclamationTick: number | null;
  readonly wallCompleteTick: number | null;
  readonly wallCompletionElapsedTicks: number | null;
  readonly maxNonWallProductionStall: number;
  readonly finalState: GameState;
}

function requirementsMet(state: GameState): boolean {
  return evaluateEraRequirements(state).every((requirement) => requirement.met);
}

function productionBuildingChanged(previous: Building, next: Building): boolean {
  const definition = BUILDING_CONFIG_BY_KIND[previous.kind];
  return definition.production !== null &&
    (
      previous.productionProgress !== next.productionProgress ||
      JSON.stringify(sortedResources(previous.inventory)) !== JSON.stringify(sortedResources(next.inventory))
    );
}

function nonWallProductionChanged(previous: GameState, next: GameState): boolean {
  return previous.buildings.some((building) => {
    const after = next.buildings.find((candidate) => candidate.id === building.id);
    return after !== undefined && productionBuildingChanged(building, after);
  });
}

function completedWall(state: GameState): boolean {
  return state.palisade?.segments.every((segment) => segment.completed) === true;
}

export function trackStage3Run(initial: GameState): Stage3RunTrace {
  let state = initial;
  let requirementsMetTick: number | null = requirementsMet(state) ? state.tick : null;
  while (state.tick < STAGE3_PROCLAMATION_TICK) {
    state = advanceTick(state);
    if (requirementsMetTick === null && requirementsMet(state)) requirementsMetTick = state.tick;
  }

  const proclaimed = requirementsMetTick !== null && requirementsMetTick <= STAGE3_MAX_REQUIREMENT_TICK
    ? confirmPalisadeProclamation(state, STAGE3_PALISADE_PATH)
    : state;
  const proclamationTick = proclaimed.era === "palisade" ? proclaimed.eraProclaimedTick : null;
  state = proclaimed;

  let maxNonWallProductionStall = 0;
  let nonWallProductionStall = 0;
  let wallCompleteTick: number | null = completedWall(state) ? state.tick : null;

  for (let step = 0; step < STAGE3_MAX_WALL_COMPLETION_TICKS && wallCompleteTick === null; step += 1) {
    const previous = state;
    state = advanceTick(state);
    nonWallProductionStall = nonWallProductionChanged(previous, state) ? 0 : nonWallProductionStall + 1;
    maxNonWallProductionStall = Math.max(maxNonWallProductionStall, nonWallProductionStall);
    if (completedWall(state)) wallCompleteTick = state.tick;
  }

  return {
    hash: hashEconomyState(state),
    requirementsMetTick,
    proclamationTick,
    wallCompleteTick,
    wallCompletionElapsedTicks:
      proclamationTick === null || wallCompleteTick === null ? null : wallCompleteTick - proclamationTick,
    maxNonWallProductionStall,
    finalState: state,
  };
}
