import { useEffect, useRef, useState } from "react";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { MONEY_RULE_COPY } from "../content/moneyCopy.ko";
import { outstandingArrears } from "../engine/moneyRules";
import { recentNetChange } from "../ledger/ledgerView";
import { LedgerPanel } from "./LedgerPanel";
import { constructionReservedMaterial } from "../engine/constructionReserve";
import { storageCapacityBlock } from "../economy/storage";
import { houseLotArea } from "../geometry/buildingFootprint";
import { advanceResourceHistory, breadHouseholdPortions, RESOURCE_TREND_WINDOW, resourceSample, resourceTrend, type ResourceSample, type ResourceTrendKind } from "./resourceTrend";
import type { GameState } from "../engine/engine.types";
import { placementSpendableResource } from "../world/placement";
import { economyStockTotals } from "./ledgerModel";
import { ResourceArtwork, type ResourceArtworkKind } from "./ResourceArtwork";
import { RESOURCE_BAR_COPY } from "./resourceBarCopy.ko";

type ResourceBarProps = {
  readonly state: GameState;
  readonly paused?: boolean;
  readonly populationDrawerOpen: boolean;
  readonly onPopulationDrawerToggle: () => void;
  /** Ledger source rows outline their buildings through the map highlight (spec L-8). */
  readonly onHighlightBuildings?: (buildingIds: readonly string[]) => void;
};

export function ResourceBar({ state, paused = false, populationDrawerOpen, onPopulationDrawerToggle, onHighlightBuildings = () => undefined }: ResourceBarProps) {
  const [coinOpen, setCoinOpen] = useState(false);
  const historyRef = useRef<readonly ResourceSample[]>([]);
  const history = advanceResourceHistory(historyRef.current, resourceSample(state));
  useEffect(() => { historyRef.current = history; });
  const trend = (kind: ResourceTrendKind) => {
    const value = resourceTrend(history, kind, paused);
    return value ? RESOURCE_BAR_COPY.trend(value.delta, value.ticks) : paused ? "" : "— 관측 중";
  };
  const stock = economyStockTotals(state);
  // M-8: the finance cell shows the recent period's net change and any unpaid upkeep.
  const owed = outstandingArrears(state).total;
  const coinSecondary = owed > 0
    ? `${MONEY_RULE_COPY.cellNet(recentNetChange(state))} · ${MONEY_RULE_COPY.cellArrears(owed)}`
    : MONEY_RULE_COPY.cellNet(recentNetChange(state));
  const timber = placementSpendableResource(state, "timber");
  const stone = placementSpendableResource(state, "stone");
  const timberReserved = constructionReservedMaterial(state, "timber");
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
  const durationTicks = ration > 0 ? Math.floor(stock.bread * HOUSE_FOOD_INTERVAL / ration) : 0;
  const breadLabel = portions === null ? "입주 가구 없음" : RESOURCE_BAR_COPY.breadDuration(occupiedLots, durationTicks);
  const breadTitle = RESOURCE_BAR_COPY.breadDetail(HOUSE_FOOD_INTERVAL);
  return (
    <section className="resource-bar" aria-label="영지 자원 현황">
      <button type="button" className="resource-bar__cell resource-bar__population" aria-label="인구 기록" aria-expanded={populationDrawerOpen} aria-controls="population-ledger-drawer" onClick={() => onPopulationDrawerToggle()}>
        <ResourceArtwork kind="population" />
        <span className="resource-bar__detail">
          <span className="resource-bar__primary"><span>인구</span><strong>{state.population}</strong></span>
          <span className="resource-bar__trend">{trend("population")}</span>
          <span className="resource-bar__secondary">유휴 일꾼 <b>{state.labour?.idle ?? state.idleWorkers}</b><span className="resource-bar__disclosure" aria-hidden="true">⌄</span></span>
        </span>
      </button>
      <ResourceCell kind="bread" label="빵" value={stock.bread} secondary={`${breadLabel}${breadFull ? " · 가득" : ""}`} trend={trend("bread")} />
      <ResourceCell kind="timber" label="가용 목재" value={timber} trend={trend("timber")} secondary={`공사 예약 ${timberReserved}${woodFull ? " · 가득" : ""}`} />
      <ResourceCell kind="stone" label="가용 석재" value={stone} trend={trend("stone")} secondaryKind="stone_raw" secondary={`원석 ${stock.stone_raw}${stoneFull ? " · 가득" : ""}`} />
      <button type="button" className="resource-bar__cell resource-bar__coin" aria-label="재정 수입과 지출 상세" aria-expanded={coinOpen} aria-controls="resource-coin-detail" onClick={() => setCoinOpen(!coinOpen)}>
        <ResourceArtwork kind="coin" />
        <span className="resource-bar__detail"><span className="resource-bar__primary"><span>재정</span><strong>{stock.coin}</strong></span>
          <span className="resource-bar__trend">{trend("coin")}</span><span className="resource-bar__secondary">{coinSecondary}<span className="resource-bar__disclosure" aria-hidden="true">⌄</span></span></span>
      </button>
      {/* UX-1: the date moved beside the speed controls (App `hud-time-cluster`). */}
      {coinOpen ? <LedgerPanel id="resource-coin-detail" state={state} onHighlightBuildings={onHighlightBuildings} /> : null}
      <details className="resource-bar__more"><summary>자원 상세</summary><p>밀 {stock.wheat} · 원목 {stock.logs} · 원석 {stock.stone_raw}</p><p>{breadTitle}</p><p>{RESOURCE_BAR_COPY.timberDetail(stock.timber, timber)}</p><p>{RESOURCE_BAR_COPY.stoneDetail(stock.stone, stone)}</p><p>{RESOURCE_BAR_COPY.trendDetail(RESOURCE_TREND_WINDOW)}</p><p>{RESOURCE_BAR_COPY.populationTrend}</p></details>
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
};

function ResourceCell({ kind, label, value, trend, secondary, secondaryKind }: ResourceCellProps) {
  return (
    <div className="resource-bar__cell">
      <ResourceArtwork kind={kind} />
      <span className="resource-bar__detail">
        <span className="resource-bar__primary"><span>{label}</span><strong>{value}</strong></span>
        <span className="resource-bar__trend">{trend}</span>
        <span className="resource-bar__secondary">{secondaryKind && <ResourceArtwork kind={secondaryKind} small />}{secondary}</span>
      </span>
    </div>
  );
}
