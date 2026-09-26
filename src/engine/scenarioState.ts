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
import { housingLotCount } from "../population/housing";
import type { HistoricalEraEntry } from "./season.types";
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
    case "housing_lots_at_least": return housingLotCount(state) >= condition.value;
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

/**
 * The historical era the town is in (spec SC-12, FP-5): the last era it entered (`historicalEras`, kept by
 * `advanceHistoricalEras`). Before the first v12 tick the year gates stand in, stopping at an era whose readiness
 * gate is unknown until its grace has run out.
 */
export function historicalEra(state: Pick<GameState, "tick" | "scenarioId" | "historicalEras">): EraDef {
  const scenario = scenarioOf(state);
  const entered = state.historicalEras?.at(-1);
  if (entered !== undefined) {
    const era = scenario.eras.find(candidate => candidate.id === entered.id);
    if (era !== undefined) return era;
  }
  const { year } = stateCalendar(state);
  let current = scenario.eras[0];
  for (const era of scenario.eras) {
    const gate = era.enterWhen.yearAtLeast ?? Number.POSITIVE_INFINITY;
    const due = era.enterWhen.state === undefined ? gate : gate + (era.enterWhen.maxDelayYears ?? 0);
    if (due > year) break;
    current = era;
  }
  if (current === undefined) throw new Error(`${scenario.id} has no eras`);
  return current;
}

/**
 * FP-5 (F2): enters the eras whose time has come, in order. An era enters when the calendar reaches its year and the
 * town meets its readiness, or, readiness unmet, when `maxDelayYears` more have passed (forced). An era never enters
 * before the one ahead of it. Returns the state unchanged when nothing enters.
 */
export function advanceHistoricalEras(state: GameState): GameState {
  const scenario = scenarioOf(state);
  const entries: HistoricalEraEntry[] = [...(state.historicalEras ?? [])];
  const { year } = stateCalendar(state);
  let changed = state.historicalEras === undefined;
  for (const era of scenario.eras.slice(entries.length)) {
    const gate = era.enterWhen.yearAtLeast;
    if (gate === undefined || year < gate) break;
    const ready = era.enterWhen.state === undefined || conditionsMet(state, era.enterWhen.state);
    const forced = !ready && year >= gate + (era.enterWhen.maxDelayYears ?? 0);
    if (!ready && !forced) break;
    entries.push({ id: era.id, enteredTick: state.tick, forced });
    changed = true;
  }
  return changed ? { ...state, historicalEras: entries } : state;
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
