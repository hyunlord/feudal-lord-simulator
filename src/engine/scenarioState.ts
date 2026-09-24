import { treasuryBalance } from "../ledger/ledger";
import { EffectRegistry, SETTLEMENT_REGION_ID } from "../contracts";
import { BALANCE } from "../content/balanceConfig";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { scenarioById } from "../content/scenario/registry";
import { STAGE_ERA, STAGE_ORDER, type Condition, type ConditionSet, type EraDef, type ScenarioDef, type StageId } from "../content/scenario/types";
import type { Era } from "../content/eraConfig";
import { placementSpendableResource } from "../world/placement";
import type { GameState } from "./engine.types";
import { settlementMetrics } from "./settlementMetrics";
import type { SettlementMetrics } from "./settlement.types";

const ERA_STAGE = { hamlet: "village", palisade: "market_town", stone_town: "fortified_town" } as const satisfies Record<Era, StageId>;

export function scenarioOf(state: Pick<GameState, "scenarioId">): ScenarioDef {
  return scenarioById(state.scenarioId);
}

export function stageOf(state: Pick<GameState, "era">): StageId {
  return ERA_STAGE[state.era];
}

export function stageForEra(era: Era): StageId {
  return ERA_STAGE[era];
}

export function eraForStage(stage: StageId): Era {
  return STAGE_ERA[stage];
}

/** Counters that are not in `GameState` itself but in the settlement progress being computed. */
export type ConditionContext = Readonly<{ emptyTicks?: number; metrics?: SettlementMetrics }>;

export function conditionMet(state: GameState, condition: Condition, context: ConditionContext = {}): boolean {
  const metrics = (): SettlementMetrics => context.metrics ?? settlementMetrics(state);
  switch (condition.kind) {
    case "population_at_least": return state.population >= condition.value;
    case "supplied_percent_at_least": return metrics().occupiedHouses > 0 && metrics().suppliedPercent >= condition.value;
    case "occupied_l4_lots_at_least": return metrics().occupiedL4Lots >= condition.value;
    case "stage_at_least": return STAGE_ORDER.indexOf(stageOf(state)) >= STAGE_ORDER.indexOf(condition.stage);
    case "wall_completed": return metrics().completedWall;
    case "stone_wall_completed": return metrics().completedStoneWall;
    case "building_count_at_least": return state.buildings.filter(building => building.kind === condition.building).length >= condition.value;
    case "spendable_resource_at_least": return placementSpendableResource(state, condition.resource) >= condition.value;
    case "treasury_coin_at_least": return treasuryBalance(state) >= condition.value;
    case "settlement_empty_for": return (context.emptyTicks ?? 0) >= condition.ticks;
  }
}

/** Instantaneous check; `holdTicks` is counted by the caller that owns the saved counter. */
export function conditionsMet(state: GameState, set: ConditionSet, context: ConditionContext = {}): boolean {
  return set.all.every(condition => conditionMet(state, condition, context));
}

/** Victory conditions of the state's scenario at this tick (null scenario victory = never). */
export function victoryConditionsMet(state: GameState): boolean {
  const victory = scenarioOf(state).victory;
  return victory !== null && conditionsMet(state, victory);
}

export type CalendarDate = Readonly<{ year: number; season: 0 | 1 | 2 | 3; dayOfYear: number }>;

/** Derived calendar (spec SC-11): integer arithmetic only, tick 0 = spring day 1 of `startYear`. */
export function calendar(tick: number, startYear: number, ticksPerYear: number = BALANCE.TICKS_PER_YEAR): CalendarDate {
  const whole = Math.max(0, Math.floor(tick));
  const yearOffset = Math.floor(whole / ticksPerYear);
  const inYear = whole - yearOffset * ticksPerYear;
  return {
    year: startYear + yearOffset,
    season: Math.floor((inYear * 4) / ticksPerYear) as 0 | 1 | 2 | 3,
    dayOfYear: Math.floor((inYear * 360) / ticksPerYear) + 1,
  };
}

export function stateCalendar(state: Pick<GameState, "tick" | "scenarioId">): CalendarDate {
  return calendar(state.tick, scenarioOf(state).startYear);
}

/** The last era whose year gate is met (spec SC-12). State gates are reserved and not evaluated yet. */
export function historicalEra(state: Pick<GameState, "tick" | "scenarioId">): EraDef {
  const scenario = scenarioOf(state);
  const { year } = stateCalendar(state);
  let current = scenario.eras[0];
  for (const era of scenario.eras) if ((era.enterWhen.yearAtLeast ?? Number.POSITIVE_INFINITY) <= year) current = era;
  if (current === undefined) throw new Error(`${scenario.id} has no eras`);
  return current;
}

export function calendarLabel(state: Pick<GameState, "tick" | "scenarioId">): string {
  const date = stateCalendar(state);
  return SCENARIO_COPY.calendarLabel(date.year, SCENARIO_COPY.seasons[date.season]);
}

/**
 * Effects of the current historical era, published through the B1 effect pipe (spec SC-12).
 * Derived and unsaved; every core era has zero effects until C-stage content defines values.
 */
export function historicalEraEffectRegistry(state: Pick<GameState, "tick" | "scenarioId">): EffectRegistry {
  const era = historicalEra(state);
  const registry = new EffectRegistry();
  era.effects.forEach((spec, index) => registry.register({
    id: `${era.id}:${index}`, source: { type: "scenario", id: scenarioOf(state).id, detail: era.id },
    target: { kind: "settlement", id: SETTLEMENT_REGION_ID }, spec, startedAt: 0,
  }));
  return registry;
}
