import type { GameState } from "../engine/engine.types";
import { placementSpendableResource } from "../world/placement";
import { economyStockTotals } from "./ledgerModel";
import { ResourceArtwork, type ResourceArtworkKind } from "./ResourceArtwork";

type ResourceBarProps = {
  readonly state: GameState;
  readonly populationDrawerOpen: boolean;
  readonly onPopulationDrawerToggle: () => void;
};

export function ResourceBar({ state, populationDrawerOpen, onPopulationDrawerToggle }: ResourceBarProps) {
  const stock = economyStockTotals(state);
  const timber = placementSpendableResource(state, "timber");
  const stone = placementSpendableResource(state, "stone");
  return (
    <section className="resource-bar" aria-label="영지 자원 현황">
      <button type="button" className="resource-bar__cell resource-bar__population" aria-label="인구 기록" aria-expanded={populationDrawerOpen} aria-controls="population-ledger-drawer" onClick={onPopulationDrawerToggle}>
        <ResourceArtwork kind="population" />
        <span className="resource-bar__detail">
          <span className="resource-bar__primary"><span>인구</span><strong>{state.population}</strong></span>
          <span className="resource-bar__secondary">유휴 일꾼 <b>{state.idleWorkers}</b><span className="resource-bar__disclosure" aria-hidden="true">⌄</span></span>
        </span>
      </button>
      <ResourceCell kind="bread" label="빵" value={stock.bread} secondaryKind="wheat" secondary={`밀 ${stock.wheat}`} />
      <ResourceCell kind="timber" label="가용 목재" value={timber} secondaryKind="logs" secondary={`원목 ${stock.logs}`} title={`목재 전체 보유량 ${stock.timber} · 건설 가능 ${timber} · 공사 약정·예약 물량과 운송 중인 물량 제외`} />
      <ResourceCell kind="stone" label="가용 석재" value={stone} secondaryKind="stone_raw" secondary={`원석 ${stock.stone_raw}`} title={`석재 전체 보유량 ${stock.stone} · 건설 가능 ${stone} · 공사 약정·예약 물량과 운송 중인 물량 제외`} />
      <ResourceCell kind="coin" label="재정" value={stock.coin} secondary="금화 · 보유량" />
    </section>
  );
}

type ResourceCellProps = {
  readonly kind: "bread" | "timber" | "stone" | "coin";
  readonly label: string;
  readonly value: number;
  readonly secondary: string;
  readonly secondaryKind?: ResourceArtworkKind;
  readonly title?: string;
};

function ResourceCell({ kind, label, value, secondary, secondaryKind, title = "영지 전체 보유량 · 건물 재고와 운송 중인 물량 포함" }: ResourceCellProps) {
  return (
    <div className="resource-bar__cell" title={title}>
      <ResourceArtwork kind={kind} />
      <span className="resource-bar__detail">
        <span className="resource-bar__primary"><span>{label}</span><strong>{value}</strong></span>
        <span className="resource-bar__secondary">{secondaryKind && <ResourceArtwork kind={secondaryKind} small />}{secondary}</span>
      </span>
    </div>
  );
}
