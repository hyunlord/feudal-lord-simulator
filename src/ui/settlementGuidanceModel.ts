import { stageDef } from "../content/scenario/registry";
import type { ConditionSet } from "../content/scenario/types";
import { scenarioOf } from "../engine/scenarioState";
import { houseHasFood } from "../population/houseFood";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { placementSpendableResource } from "../world/placement";
import { idleLabourHighlighted } from "./householdLabourModel";
import { HOUSEHOLD_LABOUR_COPY } from "./householdLabourCopy.ko";
import { foodReserveShort } from "../population/foodReserve";
import { SETTLEMENT_GUIDANCE_COPY } from "./settlementGuidanceCopy.ko";

export type SettlementProblemKind = "water" | "bread" | "labour" | "storage";

export type SettlementProblemGlyph = {
  readonly kind: SettlementProblemKind;
  readonly glyph: string;
  readonly label: string;
};

export type SettlementGuidance = {
  readonly populationGoal: number;
  readonly completedGoal: number | null;
  readonly sampledTick: number;
  readonly statusLine: string;
  readonly priority: SettlementProblemGlyph | null;
  readonly problems: readonly SettlementProblemGlyph[];
  /** LB-9: goal-panel line `일손 남음 N` while any adult is idle. */
  readonly idleLine: string | null;
};

const PROBLEM_GLYPHS: Record<SettlementProblemKind, SettlementProblemGlyph> = {
  water: { kind: "water", glyph: SETTLEMENT_GUIDANCE_COPY.waterGlyph, label: SETTLEMENT_GUIDANCE_COPY.waterShort },
  bread: { kind: "bread", glyph: SETTLEMENT_GUIDANCE_COPY.breadGlyph, label: SETTLEMENT_GUIDANCE_COPY.breadShort },
  labour: { kind: "labour", glyph: SETTLEMENT_GUIDANCE_COPY.labourGlyph, label: SETTLEMENT_GUIDANCE_COPY.labourShort },
  storage: { kind: "storage", glyph: SETTLEMENT_GUIDANCE_COPY.storageGlyph, label: SETTLEMENT_GUIDANCE_COPY.storageFull },
};

export function settlementProblemGlyphs(state: GameState): readonly SettlementProblemGlyph[] {
  const problems: SettlementProblemGlyph[] = [];
  if (hasWaterProblem(state)) problems.push(PROBLEM_GLYPHS.water);
  if (hasBreadProblem(state)) problems.push(PROBLEM_GLYPHS.bread);
  if (hasLabourProblem(state)) problems.push(PROBLEM_GLYPHS.labour);
  if (hasStorageProblem(state)) problems.push(PROBLEM_GLYPHS.storage);
  return problems;
}

function scenarioPopulationTarget(set: ConditionSet | null | undefined): number | null {
  const condition = set?.all.find(candidate => candidate.kind === "population_at_least");
  return condition?.kind === "population_at_least" ? condition.value : null;
}

export function settlementGuidance(state: GameState): SettlementGuidance {
  const marketTownPopulation = scenarioPopulationTarget(stageDef(scenarioOf(state), "market_town").enterWhen) ?? 60;
  const populationGoal = state.era === "hamlet" ? marketTownPopulation
    : scenarioPopulationTarget(scenarioOf(state).victory) ?? scenarioPopulationTarget(scenarioOf(state).walls.stoneWallPrereq) ?? marketTownPopulation;
  const problems = settlementProblemGlyphs(state);
  const priority = guidancePriority(state);
  return {
    populationGoal,
    completedGoal: state.population >= marketTownPopulation ? marketTownPopulation : null,
    sampledTick: Math.floor(state.tick / 60) * 60,
    statusLine: priority?.label ?? SETTLEMENT_GUIDANCE_COPY.stable,
    priority,
    problems,
    idleLine: (state.labour?.idle ?? 0) > 0 ? HOUSEHOLD_LABOUR_COPY.idleLine(state.labour?.idle ?? 0) : null,
  };
}

function guidancePriority(state: GameState): SettlementProblemGlyph | null {
  if (hasWaterProblem(state)) return { ...PROBLEM_GLYPHS.water, label: SETTLEMENT_GUIDANCE_COPY.wellNeeded };
  if (hasBreadProblem(state)) return { ...PROBLEM_GLYPHS.bread, label: SETTLEMENT_GUIDANCE_COPY.foodShort };
  if (state.idleWorkers > 0 && hasLabourProblem(state)) {
    return {
      ...PROBLEM_GLYPHS.labour,
      label: SETTLEMENT_GUIDANCE_COPY.idleWorkersRoad,
    };
  }
  if (!state.buildings.some((building) => building.kind === "granary")) {
    return { kind: "storage", glyph: SETTLEMENT_GUIDANCE_COPY.storageGlyph, label: SETTLEMENT_GUIDANCE_COPY.granaryNeeded };
  }
  if (placementSpendableResource(state, "timber") < 30) {
    return { kind: "storage", glyph: SETTLEMENT_GUIDANCE_COPY.storageGlyph, label: SETTLEMENT_GUIDANCE_COPY.timberShort };
  }
  if (idleLabourHighlighted(state)) return { ...PROBLEM_GLYPHS.labour, label: HOUSEHOLD_LABOUR_COPY.idleHint };
  // FIX-1: household larders can be full while the stores run out; "stable" needs a season of stored food.
  if (foodReserveShort(state)) return { ...PROBLEM_GLYPHS.bread, label: SETTLEMENT_GUIDANCE_COPY.foodReserveShort };
  return null;
}

function hasWaterProblem(state: GameState): boolean {
  return state.houses.some((house) => house.residents > 0 && !house.hasWater);
}

function hasBreadProblem(state: GameState): boolean {
  return state.houses.some(
    (house) =>
      house.residents > 0 &&
      !houseHasFood(house) &&
      state.tick > (house.starvationGraceUntilTick ?? 0),
  );
}

function hasLabourProblem(state: GameState): boolean {
  return state.buildings.some((building) => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    return definition.workersRequired > 0 && building.workers < definition.workersRequired;
  });
}

function hasStorageProblem(state: GameState): boolean {
  return state.buildings.some((building) => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (definition.storageCapacity <= 0) return false;
    const occupied = Object.values(building.inventory).reduce((total, amount) => total + (amount ?? 0), 0);
    return occupied >= definition.storageCapacity;
  });
}
