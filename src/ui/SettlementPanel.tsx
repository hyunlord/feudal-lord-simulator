import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { SETTLEMENT_CONFIG } from "../content/settlementConfig";
import type { GameState } from "../engine/engine.types";
import { getSettlementView } from "../engine/settlementView";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { calendarLabel, historicalEra, scenarioOf } from "../engine/scenarioState";

export function SettlementPanel({ state, onRestart, developmentContent }: {
  readonly state: GameState;
  readonly onRestart: () => void;
  readonly developmentContent?: ReactNode;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const view = getSettlementView(state);
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
  const seconds = (ticks: number) => Math.floor(ticks / BALANCE.TICKS_PER_SECOND);
  const scenario = scenarioOf(state);
  const title = view.outcome === "abandoned" ? "정착지가 비었습니다"
    : view.outcome === "victory" ? SCENARIO_COPY.victoryTitle(SCENARIO_COPY.objectives.prosperity.title) : goal?.title ?? "영지의 기록";
  const milestoneTotal = scenario.objectives.length + (scenario.victory === null ? 0 : 1);
  const stoneReserve = scenario.walls.stoneWall === "off" ? undefined
    : scenario.walls.stoneWallPrereq?.all.find(condition => condition.kind === "spendable_resource_at_least" && condition.resource === "stone");
  return <section className={`settlement-progress${highlight ? " settlement-progress--changed" : ""}`} aria-label="영지 목표와 수급">
    <details onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary><strong>{title} · 도시 발전 조건</strong><span>물·빵 {view.metrics.suppliedHouses}/{view.metrics.occupiedHouses}가구</span><span className="settlement-disclosure">{expanded ? "접기" : "펼치기"}</span></summary>
      <div className="settlement-progress-body">
        <p className="settlement-calendar">{calendarLabel(state)} · {SCENARIO_COPY.eraLabel(historicalEra(state).name)}</p>
        <p>가구 비축 빵 {bread} · {seconds(HOUSE_FOOD_INTERVAL)}초마다 소비 {ration}</p>
        <p>가구별 세 끼를 비축합니다. 가구가 늘면 밀밭·방앗간·배급 길도 함께 늘리세요.</p>
        {goal === null ? <p>{view.mode === "sandbox" ? SCENARIO_COPY.sandboxGoal : SCENARIO_COPY.allGoalsDone}</p> : <>
          <ul>{goal.criteria.map(item => <li key={item.id}>
            <span>{item.label}</span><strong>{Math.floor(item.current)}/{item.target}{item.met ? " 충족" : ""}</strong>
          </li>)}</ul>
          {goal.requiredHoldTicks > 0 ? <label className="settlement-hold">
            연속 유지 {seconds(goal.holdTicks)}/{seconds(goal.requiredHoldTicks)}초 (게임 시간)
            <progress value={goal.holdTicks} max={goal.requiredHoldTicks} />
          </label> : <p>{SCENARIO_COPY.proclaimAndBuildWall}</p>}
        </>}
        {milestoneTotal > 0 ? <p>{SCENARIO_COPY.milestonesDone(Object.values(view.progress.milestones).filter(tick => tick !== null).length, milestoneTotal)}</p> : null}
        {view.outcome === "victory" && view.metrics.completedStoneWall ? <p>{SCENARIO_COPY.stoneWallBonus}</p> : null}
        {state.era === "palisade" && stoneReserve?.kind === "spendable_resource_at_least" ? <p>{SCENARIO_COPY.stoneReserve(stoneReserve.value)}</p> : null}
        {developmentContent}
      </div>
    </details>
    <div className="settlement-crisis-slot" aria-live="polite">
      {view.crisis === "food_shortage" ? <p className="settlement-crisis" role="status">배급 부족이 이어집니다. 밀밭·방앗간의 일손과 곡창에서 집까지의 길을 확인하세요.</p> : null}
      {view.crisis === "abandonment_risk" && view.outcome !== "abandoned" ? <p className="settlement-crisis" role="status">주민이 모두 떠났습니다. 집에 물과 빵을 공급해 입주를 회복하세요. {Math.max(0, seconds(SETTLEMENT_CONFIG.abandonmentTicks - view.progress.emptyTicks))}초 남음.</p> : null}
    </div>
    {view.outcome === "abandoned" ? <div className="settlement-restart">
      <p>주민 없는 상태가 이어져 영지 운영이 멈췄습니다.</p>
      {confirmRestart ? <><p>현재 영지를 끝내고 처음부터 시작합니다.</p><button type="button" onClick={() => onRestart()}>처음부터 시작</button><button type="button" onClick={() => setConfirmRestart(false)}>취소</button></>
        : <button type="button" onClick={() => setConfirmRestart(true)}>새 영지 시작</button>}
    </div> : null}
  </section>;
}
