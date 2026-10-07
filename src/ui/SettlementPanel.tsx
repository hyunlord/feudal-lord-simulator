import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { SETTLEMENT_CONFIG } from "../content/settlementConfig";
import type { GameState } from "../engine/engine.types";
import { getSettlementView } from "../engine/settlementView";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { calendarLabel, historicalEra, scenarioOf } from "../engine/scenarioState";
import { calendarDays, durationLabel, humanizeTicks } from "./gameTimeCopy.ko";
import { SETTLEMENT_PANEL_COPY } from "./settlementPanelCopy.ko";
import { Button, Disclosure } from "./kit";
import { LORD_SLICE_GOAL_YEARS } from "../content/lordSliceConfig";
import { lordMode } from "../engine/townAgency";
import { LORD_ADVICE_COPY } from "./lord/advice/lordAdviceCopy.ko";
import { TITLE_COPY } from "./titleCopy.ko";

export function SettlementPanel({ state, onRestart, developmentContent }: {
  readonly state: GameState;
  readonly onRestart: () => void;
  readonly developmentContent?: ReactNode;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const view = getSettlementView(state);
  const lord = lordMode(state);
  const goal = view.currentGoal;
  const changeKey = JSON.stringify([view.outcome, view.crisis, goal?.id, view.metrics.suppliedHouses, view.metrics.occupiedHouses,
    goal?.criteria.map(item => [item.id, Math.floor(item.current), item.met]),
    goal ? Math.floor(goal.holdTicks / Math.max(1, goal.requiredHoldTicks) * 4) : 0]);
  const previousKey = useRef(changeKey);
  const [highlight, setHighlight] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (changeKey === previousKey.current) return;
    previousKey.current = changeKey;
    setHighlight(true);
    const timeout = window.setTimeout(() => setHighlight(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [changeKey]);
  const bread = state.houses.reduce((total, house) => total + house.breadStock, 0);
  const ration = state.houses.reduce((total, house) => total + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  const scenario = scenarioOf(state);
  const title = view.outcome === "abandoned" ? SETTLEMENT_PANEL_COPY.abandonedTitle
    : view.outcome === "victory" ? SCENARIO_COPY.victoryTitle(SCENARIO_COPY.objectives.prosperity.title) : goal?.title ?? SETTLEMENT_PANEL_COPY.recordTitle;
  const milestoneTotal = scenario.objectives.length + (scenario.victory === null ? 0 : 1);
  const stoneReserve = scenario.walls.stoneWall === "off" ? undefined
    : scenario.walls.stoneWallPrereq?.all.find(condition => condition.kind === "spendable_resource_at_least" && condition.resource === "stone");
  return <section className={`settlement-progress${highlight ? " settlement-progress--changed" : ""}`} data-frame="flat" aria-label={SETTLEMENT_PANEL_COPY.regionLabel}>
    <Disclosure onToggle={open => setExpanded(open)}
      summary={<><strong>{SETTLEMENT_PANEL_COPY.summaryTitle(title)}</strong><span>{SETTLEMENT_PANEL_COPY.suppliedHouses(view.metrics.suppliedHouses, view.metrics.occupiedHouses)}</span><span className="settlement-disclosure">{expanded ? SETTLEMENT_PANEL_COPY.collapse : SETTLEMENT_PANEL_COPY.expand}</span></>}>
      <div className="settlement-progress-body">
        <p className="settlement-calendar">{calendarLabel(state)} · {SCENARIO_COPY.eraLabel(historicalEra(state).name)}</p>
        <p>{SETTLEMENT_PANEL_COPY.householdBread(bread, calendarDays(HOUSE_FOOD_INTERVAL), ration)}</p>
        {/* DEC-CARD A1: lord mode is no free-building sandbox — the town builds, the lord sets its conditions. */}
        <p>{lord ? LORD_ADVICE_COPY.larderRule : SETTLEMENT_PANEL_COPY.larderRule}</p>
        {goal === null ? <p>{lord ? TITLE_COPY.lordGoal(LORD_SLICE_GOAL_YEARS.min, LORD_SLICE_GOAL_YEARS.max) : view.mode === "sandbox" ? SCENARIO_COPY.sandboxGoal : SCENARIO_COPY.allGoalsDone}</p> : <>
          <ul>{goal.criteria.map(item => <li key={item.id}>
            <span>{humanizeTicks(item.label)}</span><strong>{Math.floor(item.current)}/{item.target}{item.met ? SETTLEMENT_PANEL_COPY.met : ""}</strong>
          </li>)}</ul>
          {goal.requiredHoldTicks > 0 ? <label className="settlement-hold">
            {SETTLEMENT_PANEL_COPY.hold(durationLabel(goal.holdTicks), durationLabel(goal.requiredHoldTicks))}
            <progress value={goal.holdTicks} max={goal.requiredHoldTicks} />
          </label> : <p>{SCENARIO_COPY.proclaimAndBuildWall}</p>}
        </>}
        {milestoneTotal > 0 ? <p>{SCENARIO_COPY.milestonesDone(Object.values(view.progress.milestones).filter(tick => tick !== null).length, milestoneTotal)}</p> : null}
        {view.outcome === "victory" && view.metrics.completedStoneWall ? <p>{SCENARIO_COPY.stoneWallBonus}</p> : null}
        {state.era === "palisade" && stoneReserve?.kind === "spendable_resource_at_least" ? <p>{SCENARIO_COPY.stoneReserve(stoneReserve.value)}</p> : null}
        {developmentContent}
      </div>
    </Disclosure>
    <div className="settlement-crisis-slot" aria-live="polite">
      {view.crisis === "food_shortage" ? <p className="settlement-crisis" data-frame="toast" role="status">{SETTLEMENT_PANEL_COPY.foodShortage}</p> : null}
      {view.crisis === "abandonment_risk" && view.outcome !== "abandoned" ? <p className="settlement-crisis" data-frame="toast" role="status">{SETTLEMENT_PANEL_COPY.abandonmentRisk(durationLabel(SETTLEMENT_CONFIG.abandonmentTicks - view.progress.emptyTicks))}</p> : null}
    </div>
    {view.outcome === "abandoned" ? <div className="settlement-restart">
      <p>{SETTLEMENT_PANEL_COPY.stopped}</p>
      {confirmRestart ? <><p>{SETTLEMENT_PANEL_COPY.restartConfirm}</p><Button type="button" onPress={() => onRestart()} variant="secondary">{SETTLEMENT_PANEL_COPY.restart}</Button><Button type="button" onPress={() => setConfirmRestart(false)} variant="secondary">{SETTLEMENT_PANEL_COPY.cancel}</Button></>
        : <Button type="button" onPress={() => setConfirmRestart(true)} variant="secondary">{SETTLEMENT_PANEL_COPY.newSettlement}</Button>}
    </div> : null}
  </section>;
}
