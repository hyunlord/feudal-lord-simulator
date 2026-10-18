import { evaluateEraRequirements } from "../../engine/era";
import type { EraRequirement, GameState } from "../../engine/engine.types";
import { chapterGoals } from "../../engine/politics";
import { scenarioOf } from "../../engine/scenarioState";
import type { SettlementCriterion, SettlementGoal } from "../../engine/settlement.types";
import { getSettlementView } from "../../engine/settlementView";
import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import { CHAPTER_COPY } from "../chapterCopy.ko";
import { durationLabel } from "../gameTimeCopy.ko";
import { moneyShort } from "../money.ko";
import { GOAL_PIN_COPY } from "./goalPinCopy.ko";
import { stuckRows } from "./stuckStockView";
import type { TileCoordinate } from "../../world/grid";

// LM-R1 (playtest 2026-10-02 #1): "이제 뭘 해야 하지?" — the answer was behind the finished tutorial in the goal log. The
// pin is the town's current goal, the very next thing it waits on ("목재 250단까지 12단 부족") and the one place to go
// for it: the full store that holds the timber back (the engine's stuck stock), the stock ledger, or the goal log with
// its conditions and the era console. #10: the chapter's flow stands beside it, apart from the town goal.

export type GoalPinAction =
  | Readonly<{ kind: "inspect"; buildingId: string; tile: TileCoordinate }>
  | Readonly<{ kind: "ledger" }>
  | Readonly<{ kind: "goals" }>;

export type GoalPinNext = Readonly<{ line: string; cta: string; action: GoalPinAction }>;

export type ChapterFlow = Readonly<{ number: number; title: string; goal: string; reached: number; total: number }>;

export type GoalPin = Readonly<{
  title: string;
  /** The criterion the next action serves (its count on the rail), null when every criterion is met. */
  count: Readonly<{ current: number; target: number }> | null;
  next: GoalPinNext | null;
}>;

const GOALS: GoalPinAction = { kind: "goals" };

/** The next action for a resource the stage asks for: the full store holding it back, else the stock ledger. */
function resourceNext(state: GameState, requirement: EraRequirement): GoalPinNext {
  const missing = Math.max(0, Math.ceil(requirement.target - requirement.current));
  if (requirement.key === "coin") return { line: GOAL_PIN_COPY.money(moneyShort(requirement.target), moneyShort(missing)), cta: GOAL_PIN_COPY.cta.ledger, action: { kind: "ledger" } };
  const line = GOAL_PIN_COPY.short(requirement.label, requirement.target, missing, GOAL_PIN_COPY.units[requirement.key] ?? "");
  const heldBy = stuckRows(state).find(row => row.good === requirement.key && row.store !== null)?.store ?? null;
  if (heldBy !== null) {
    const store = state.buildings.find(building => building.id === heldBy.id);
    if (store !== undefined) return { line, cta: GOAL_PIN_COPY.cta.store(BUILDING_CONFIG_BY_KIND[store.kind].name), action: { kind: "inspect", buildingId: store.id, tile: { tx: store.tx, ty: store.ty } } };
  }
  return { line, cta: GOAL_PIN_COPY.cta.ledger, action: { kind: "ledger" } };
}

/** What a stage proclamation still waits on (the era console's rows): the first unmet one, or "선포할 수 있습니다". */
function stageNext(state: GameState): GoalPinNext {
  const unmet = evaluateEraRequirements(state).find(requirement => !requirement.met);
  if (unmet === undefined) return { line: GOAL_PIN_COPY.proclaim, cta: GOAL_PIN_COPY.cta.proclaim, action: GOALS };
  if (unmet.key === "population") return { line: GOAL_PIN_COPY.population(unmet.target, Math.max(0, unmet.target - unmet.current)), cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
  if (unmet.key === "timber" || unmet.key === "stone" || unmet.key === "coin") return resourceNext(state, unmet);
  return { line: GOAL_PIN_COPY.building(unmet.label, unmet.current, unmet.target), cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
}

function criterionNext(state: GameState, item: SettlementCriterion): GoalPinNext {
  const current = Math.floor(item.current);
  switch (item.id) {
    case "population": return { line: GOAL_PIN_COPY.population(item.target, Math.max(0, item.target - current)), cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
    case "supplied": return { line: GOAL_PIN_COPY.supplied(current, item.target), cta: GOAL_PIN_COPY.cta.ledger, action: { kind: "ledger" } };
    case "occupiedL4Lots": return { line: GOAL_PIN_COPY.lots(current, item.target), cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
    case "era": return state.era === "hamlet" ? stageNext(state) : { line: item.label, cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
    case "wall":
    case "stoneWall": {
      if (state.era === "hamlet") return stageNext(state);
      const segments = state.palisade?.segments ?? [];
      return segments.length === 0 ? { line: GOAL_PIN_COPY.wallStart, cta: GOAL_PIN_COPY.cta.wall, action: GOALS }
        : { line: GOAL_PIN_COPY.wall(segments.filter(segment => segment.completed).length, segments.length), cta: GOAL_PIN_COPY.cta.wall, action: GOALS };
    }
    default: return { line: item.label, cta: GOAL_PIN_COPY.cta.goals, action: GOALS };
  }
}

/** The pinned goal for a goal of the settlement view (exported for its tests). */
export function goalPinFor(state: GameState, goal: SettlementGoal): GoalPin {
  const unmet = goal.criteria.find(item => !item.met);
  if (unmet === undefined) {
    const left = Math.max(0, goal.requiredHoldTicks - goal.holdTicks);
    return { title: goal.title, count: null, next: { line: GOAL_PIN_COPY.hold(durationLabel(left)), cta: GOAL_PIN_COPY.cta.goals, action: GOALS } };
  }
  return { title: goal.title, count: { current: Math.floor(unmet.current), target: unmet.target }, next: criterionNext(state, unmet) };
}

/** The town's current goal and its next action; null when the scenario has no goal left (the sandbox, lord mode). */
export function goalPin(state: GameState): GoalPin | null {
  const goal = getSettlementView(state).currentGoal;
  return goal === null ? null : goalPinFor(state, goal);
}

/** The campaign chapter's flow (its title, the goal it is on, how many of its goals are reached); null outside it. */
export function chapterFlow(state: GameState): ChapterFlow | null {
  if (scenarioOf(state).mode !== "campaign") return null;
  const number = state.politics?.chapter.number ?? 1;
  const goals = chapterGoals(state).filter(entry => entry.chapter === number);
  if (goals.length === 0) return null;
  const next = goals.find(entry => entry.reachedTick === null);
  const goal = next === undefined ? CHAPTER_COPY.reached(CHAPTER_COPY.goals[goals.at(-1)!.id] ?? "") : CHAPTER_COPY.goals[next.id] ?? next.id;
  return { number, title: CHAPTER_COPY.card(number), goal, reached: goals.filter(entry => entry.reachedTick !== null).length, total: goals.length };
}
