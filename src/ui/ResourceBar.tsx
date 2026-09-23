import { useEffect, useRef } from "react";
import { BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL } from "../content/houseFoodConfig";
import { advanceResourceHistory, breadHouseholdPortions, resourceSample, resourceTrend, type ResourceSample, type ResourceTrendKind } from "./resourceTrend";
import type { GameState } from "../engine/engine.types";
import { placementSpendableResource } from "../world/placement";
import { economyStockTotals } from "./ledgerModel";
import { ResourceArtwork, type ResourceArtworkKind } from "./ResourceArtwork";

type ResourceBarProps = {
  readonly state: GameState;
  readonly paused?: boolean;
  readonly populationDrawerOpen: boolean;
  readonly onPopulationDrawerToggle: () => void;
};

export function ResourceBar({ state, paused = false, populationDrawerOpen, onPopulationDrawerToggle }: ResourceBarProps) {
  const historyRef = useRef<readonly ResourceSample[]>([]);
  const history = advanceResourceHistory(historyRef.current, resourceSample(state));
  useEffect(() => { historyRef.current = history; });
  const trend = (kind: ResourceTrendKind) => {
    const value = resourceTrend(history, kind, paused);
    return value ? `${value.delta > 0 ? "+" : ""}${value.delta} / ${value.ticks}틱` : paused ? "— 일시정지" : "— 관측 중";
  };
  const stock = economyStockTotals(state);
  const timber = placementSpendableResource(state, "timber");
  const stone = placementSpendableResource(state, "stone");
  const portions = breadHouseholdPortions(state, stock.bread);
  const breadLabel = portions === null ? "가구분 — 입주 없음" : `${portions}가구분 · 1끼`;
  const breadTitle = `현재 입주 필지당 평균 소비량 기준, ${Math.floor(HOUSE_FOOD_INTERVAL / BALANCE.TICKS_PER_SECOND)}초(게임 시간) 1끼. 합필은 2필지. 운송 중인 물량 포함, 가구 비축 제외. 공급 도달을 보장하지 않음.`;
  return (
    <section className="resource-bar" aria-label="영지 자원 현황">
      <button type="button" className="resource-bar__cell resource-bar__population" aria-label="인구 기록" aria-expanded={populationDrawerOpen} aria-controls="population-ledger-drawer" onClick={onPopulationDrawerToggle}>
        <ResourceArtwork kind="population" />
        <span className="resource-bar__detail">
          <span className="resource-bar__primary"><span>인구</span><strong>{state.population}</strong></span>
          <span className="resource-bar__trend" title="최근 최대 2,400틱 UI 관측 순증감 · 명">{trend("population")}</span>
          <span className="resource-bar__secondary">유휴 일꾼 <b>{state.idleWorkers}</b><span className="resource-bar__disclosure" aria-hidden="true">⌄</span></span>
        </span>
      </button>
      <ResourceCell kind="bread" label="빵" value={stock.bread} secondary={breadLabel} title={breadTitle} trend={trend("bread")} />
      <ResourceCell kind="timber" label="가용 목재" value={timber} trend={trend("timber")} secondaryKind="logs" secondary={`원목 ${stock.logs}`} title={`목재 전체 보유량 ${stock.timber} · 건설 가능 ${timber} · 공사 약정·예약 물량과 운송 중인 물량 제외`} />
      <ResourceCell kind="stone" label="가용 석재" value={stone} trend={trend("stone")} secondaryKind="stone_raw" secondary={`원석 ${stock.stone_raw}`} title={`석재 전체 보유량 ${stock.stone} · 건설 가능 ${stone} · 공사 약정·예약 물량과 운송 중인 물량 제외`} />
      <ResourceCell kind="coin" label="재정" value={stock.coin} trend={trend("coin")} secondary="금화 · 보유량" />
      <details className="resource-bar__more"><summary>자원 상세</summary><p>밀 {stock.wheat} · 원목 {stock.logs} · 원석 {stock.stone_raw}</p><p>{breadTitle}</p><p>추세: 최근 최대 2,400틱 관측 순증감. 일시정지·관측 전은 —. 목재·석재는 건설 가용량 기준입니다.</p></details>
    </section>
  );
}

type ResourceCellProps = {
  readonly kind: "bread" | "timber" | "stone" | "coin";
  readonly label: string;
  readonly value: number;
  readonly secondary: string;
  readonly trend: string;
  readonly secondaryKind?: ResourceArtworkKind;
  readonly title?: string;
};

function ResourceCell({ kind, label, value, trend, secondary, secondaryKind, title = "영지 전체 보유량 · 건물 재고와 운송 중인 물량 포함" }: ResourceCellProps) {
  return (
    <div className="resource-bar__cell" title={title}>
      <ResourceArtwork kind={kind} />
      <span className="resource-bar__detail">
        <span className="resource-bar__primary"><span>{label}</span><strong>{value}</strong></span>
        <span className="resource-bar__trend" title="최근 최대 2,400틱 UI 관측 순증감 · 표시한 보유량과 같은 단위">{trend}</span>
        <span className="resource-bar__secondary">{secondaryKind && <ResourceArtwork kind={secondaryKind} small />}{secondary}</span>
      </span>
    </div>
  );
}
