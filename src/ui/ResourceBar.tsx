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
import { calendarArrivalLabel } from "./calendarArrival";
import { scenarioOf } from "../engine/scenarioState";
import { UiIcon } from "./UiIcon";
import { Button, Disclosure } from "./kit";

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
    return value ? RESOURCE_BAR_COPY.trend(value.delta, value.ticks) : paused ? "" : RESOURCE_BAR_COPY.observing;
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
  // F0-V: the stock reads as the calendar point it lasts until, never as a duration.
  const breadLabel = portions === null ? RESOURCE_BAR_COPY.noOccupiedHouseholds
    : RESOURCE_BAR_COPY.breadUntil(occupiedLots, calendarArrivalLabel(state.tick, state.tick + durationTicks, scenarioOf(state).startYear));
  const breadTitle = RESOURCE_BAR_COPY.breadDetail(HOUSE_FOOD_INTERVAL);
  return (
    <section className="resource-bar" data-frame="strip-top" aria-label={RESOURCE_BAR_COPY.regionLabel}>
      <Button type="button" className="resource-bar__cell resource-bar__population" aria-label={RESOURCE_BAR_COPY.populationRecord} aria-expanded={populationDrawerOpen} aria-controls="population-ledger-drawer" onPress={() => onPopulationDrawerToggle()} variant="surface">
        <ResourceArtwork kind="population" />
        <span className="resource-bar__detail">
          <span className="resource-bar__primary"><span>{RESOURCE_BAR_COPY.populationLabel}</span><strong>{state.population}</strong></span>
          <span className="resource-bar__trend">{trend("population")}</span>
          <span className="resource-bar__secondary">{RESOURCE_BAR_COPY.idleWorkers} <b>{state.labour?.idle ?? state.idleWorkers}</b><UiIcon sheet="action" cell="up" className="resource-bar__disclosure" /></span>
        </span>
      </Button>
      <ResourceCell kind="bread" label={RESOURCE_BAR_COPY.breadLabel} value={stock.bread} secondary={`${breadLabel}${breadFull ? RESOURCE_BAR_COPY.full : ""}`} trend={trend("bread")} />
      <ResourceCell kind="timber" label={RESOURCE_BAR_COPY.timberLabel} value={timber} trend={trend("timber")} secondary={`${RESOURCE_BAR_COPY.timberReserved(timberReserved)}${woodFull ? RESOURCE_BAR_COPY.full : ""}`} />
      <ResourceCell kind="stone" label={RESOURCE_BAR_COPY.stoneLabel} value={stone} trend={trend("stone")} secondaryKind="stone_raw" secondary={`${RESOURCE_BAR_COPY.rawStone(stock.stone_raw)}${stoneFull ? RESOURCE_BAR_COPY.full : ""}`} />
      <Button type="button" className="resource-bar__cell resource-bar__coin" aria-label={RESOURCE_BAR_COPY.coinDetail} aria-expanded={coinOpen} aria-controls="resource-coin-detail" onPress={() => setCoinOpen(!coinOpen)} variant="surface">
        <ResourceArtwork kind="coin" />
        <span className="resource-bar__detail"><span className="resource-bar__primary"><span>{RESOURCE_BAR_COPY.coinLabel}</span><strong>{stock.coin}</strong></span>
          <span className="resource-bar__trend">{trend("coin")}</span><span className="resource-bar__secondary">{coinSecondary}<UiIcon sheet="action" cell="up" className="resource-bar__disclosure" /></span></span>
      </Button>
      {/* UX-1: the date moved beside the speed controls (App `hud-time-cluster`). */}
      {coinOpen ? <LedgerPanel id="resource-coin-detail" state={state} onHighlightBuildings={onHighlightBuildings} /> : null}
      <Disclosure className="resource-bar__more" summary={RESOURCE_BAR_COPY.moreSummary}><p>{RESOURCE_BAR_COPY.rawStock(stock.wheat, stock.logs, stock.stone_raw)}</p><p>{breadTitle}</p><p>{RESOURCE_BAR_COPY.timberDetail(stock.timber, timber)}</p><p>{RESOURCE_BAR_COPY.stoneDetail(stock.stone, stone)}</p><p>{RESOURCE_BAR_COPY.trendDetail(RESOURCE_TREND_WINDOW)}</p><p>{RESOURCE_BAR_COPY.populationTrend}</p></Disclosure>
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
