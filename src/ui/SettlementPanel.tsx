import { useState } from "react";
import { BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { SETTLEMENT_CONFIG } from "../content/settlementConfig";
import type { GameState } from "../engine/engine.types";
import { getSettlementView } from "../engine/settlementView";

export function SettlementPanel({ state, onRestart }: {
  readonly state: GameState;
  readonly onRestart: () => void;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const view = getSettlementView(state);
  const goal = view.currentGoal;
  const bread = state.houses.reduce((total, house) => total + house.breadStock, 0);
  const ration = state.houses.reduce((total, house) => total + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  const seconds = (ticks: number) => Math.floor(ticks / BALANCE.TICKS_PER_SECOND);
  const title = view.outcome === "abandoned" ? "정착지가 비었습니다"
    : view.outcome === "victory" ? "번영하는 성곽 도시 달성" : goal?.title ?? "영지의 기록";
  return <section className="settlement-progress" aria-label="영지 목표와 수급">
    <details>
      <summary>{title}<span>물·빵 {view.metrics.suppliedHouses}/{view.metrics.occupiedHouses}가구</span></summary>
      <div className="settlement-progress-body">
        <p>가구 비축 빵 {bread} · {seconds(HOUSE_FOOD_INTERVAL)}초마다 소비 {ration}</p>
        <p>가구별 세 끼를 비축합니다. 가구가 늘면 밀밭·방앗간·배급 길도 함께 늘리세요.</p>
        {goal === null ? <p>모든 목표를 달성했습니다. 계속 도시를 확장할 수 있습니다.</p> : <>
          <ul>{goal.criteria.map(item => <li key={item.id}>
            <span>{item.label}</span><strong>{Math.floor(item.current)}/{item.target}{item.met ? " 충족" : ""}</strong>
          </li>)}</ul>
          {goal.requiredHoldTicks > 0 ? <label className="settlement-hold">
            연속 유지 {seconds(goal.holdTicks)}/{seconds(goal.requiredHoldTicks)}초 (게임 시간)
            <progress value={goal.holdTicks} max={goal.requiredHoldTicks} />
          </label> : <p>도시 발전 조건에서 시대를 선포하고 성벽 공사를 마치세요.</p>}
        </>}
        <p>달성 {Object.values(view.progress.milestones).filter(tick => tick !== null).length}/3</p>
        {state.era === "palisade" ? <p>다음 시대에 필요한 석재 400개는 시장에서 팔지 않고 비축합니다.</p> : null}
      </div>
    </details>
    {view.crisis === "food_shortage" ? <p className="settlement-crisis" role="status">배급 부족이 이어집니다. 밀밭·방앗간의 일손과 곡창에서 집까지의 길을 확인하세요.</p> : null}
    {view.crisis === "abandonment_risk" && view.outcome !== "abandoned" ? <p className="settlement-crisis" role="status">주민이 모두 떠났습니다. 집에 물과 빵을 공급해 입주를 회복하세요. {Math.max(0, seconds(SETTLEMENT_CONFIG.abandonmentTicks - view.progress.emptyTicks))}초 남음.</p> : null}
    {view.outcome === "abandoned" ? <div className="settlement-restart">
      <p>주민 없는 상태가 이어져 영지 운영이 멈췄습니다.</p>
      {confirmRestart ? <><p>현재 영지를 끝내고 처음부터 시작합니다.</p><button type="button" onClick={onRestart}>처음부터 시작</button><button type="button" onClick={() => setConfirmRestart(false)}>취소</button></>
        : <button type="button" onClick={() => setConfirmRestart(true)}>새 영지 시작</button>}
    </div> : null}
  </section>;
}
