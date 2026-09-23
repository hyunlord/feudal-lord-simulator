import { useEffect, useRef, useState } from "react";
import { BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { recentCoinIncome } from "../engine/coinLedger";
import { constructionReservedMaterial } from "../engine/constructionReserve";
import { storageCapacityBlock } from "../economy/storage";
import { houseLotArea } from "../geometry/buildingFootprint";
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
  const [coinOpen, setCoinOpen] = useState(false);
  const historyRef = useRef<readonly ResourceSample[]>([]);
  const history = advanceResourceHistory(historyRef.current, resourceSample(state));
  useEffect(() => { historyRef.current = history; });
  const trend = (kind: ResourceTrendKind) => {
    const value = resourceTrend(history, kind, paused);
    return value ? `${value.delta > 0 ? "+" : ""}${value.delta} / ${value.ticks}틱` : paused ? "" : "— 관측 중";
  };
  const stock = economyStockTotals(state);
  const timber = placementSpendableResource(state, "timber");
  const stone = placementSpendableResource(state, "stone");
  const timberReserved = constructionReservedMaterial(state, "timber");
  const coinIncome = recentCoinIncome(state);
  const marketCount = state.buildings.filter(building => building.kind === "market").length;
  const breadFull = storageCapacityBlock(state.buildings, "wheat") !== null || storageCapacityBlock(state.buildings, "bread") !== null;
  const woodFull = storageCapacityBlock(state.buildings, "logs") !== null || storageCapacityBlock(state.buildings, "timber") !== null;
  const stoneFull = storageCapacityBlock(state.buildings, "stone_raw") !== null || storageCapacityBlock(state.buildings, "stone") !== null;
  const portions = breadHouseholdPortions(state, stock.bread);
  const buildingsById = new Map(state.buildings.map(building => [building.id, building]));
  const occupiedLots = state.houses.reduce((total, house) => {
    const building = buildingsById.get(house.buildingId);
    return total + (house.residents > 0 && building !== undefined ? houseLotArea(building) : 0);
  }, 0);
  const ration = state.houses.reduce((total, house) => total + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  const durationSeconds = ration > 0 ? Math.floor(stock.bread * HOUSE_FOOD_INTERVAL / ration / BALANCE.TICKS_PER_SECOND) : 0;
  const breadLabel = portions === null ? "입주 가구 없음" : `${occupiedLots}가구 기준 약 ${durationSeconds}게임초`;
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
      <ResourceCell kind="bread" label="빵" value={stock.bread} secondary={`${breadLabel}${breadFull ? " · 가득" : ""}`} title={breadTitle} trend={trend("bread")} />
      <ResourceCell kind="timber" label="가용 목재" value={timber} trend={trend("timber")} secondary={`공사 예약 ${timberReserved}${woodFull ? " · 가득" : ""}`} title={`목재 전체 보유량 ${stock.timber} · 건설 가능 ${timber} · 실제 예약·운송 중 물량 제외`} />
      <ResourceCell kind="stone" label="가용 석재" value={stone} trend={trend("stone")} secondaryKind="stone_raw" secondary={`원석 ${stock.stone_raw}${stoneFull ? " · 가득" : ""}`} title={`석재 전체 보유량 ${stock.stone} · 건설 가능 ${stone} · 실제 예약·운송 중 물량 제외`} />
      <button type="button" className="resource-bar__cell resource-bar__coin" aria-label="재정 수입과 지출 상세" aria-expanded={coinOpen} aria-controls="resource-coin-detail" onClick={() => setCoinOpen(!coinOpen)}>
        <ResourceArtwork kind="coin" />
        <span className="resource-bar__detail"><span className="resource-bar__primary"><span>재정</span><strong>{stock.coin}</strong></span>
          <span className="resource-bar__trend">{trend("coin")}</span><span className="resource-bar__secondary">금화 · 보유량<span className="resource-bar__disclosure" aria-hidden="true">⌄</span></span></span>
      </button>
      {coinOpen ? <aside id="resource-coin-detail" className="resource-bar__coin-detail" aria-label="재정 출처">
        <strong>최근 2,400틱 재정</strong>
        {coinIncome.bySource.map(source => <p key={source.source}>수입 · {source.label} +{source.amount}</p>)}
        {coinIncome.bySource.length === 0 ? <p>{marketCount === 0 ? "수입원 없음 · 시장이 창고의 남는 물자를 팔 때 들어옵니다" : "시장 판매 0 · 남는 물자와 시장 일손을 확인하세요"}</p> : null}
        <p>지출 · 없음</p>
      </aside> : null}
      <details className="resource-bar__more"><summary>자원 상세</summary><p>밀 {stock.wheat} · 원목 {stock.logs} · 원석 {stock.stone_raw}</p><p>{breadTitle}</p><p>추세: 최근 최대 2,400틱 관측 순증감. 목재·석재는 건설 가용량 기준입니다.</p></details>
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
