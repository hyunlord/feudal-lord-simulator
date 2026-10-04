import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import { resourceName } from "../../content/resourceCatalog.ko";
import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { stuckReasonText } from "../inspectorModel";
import { Button } from "../kit";
import { STUCK_GOODS_COPY } from "../stuckGoodsCopy.ko";
import { compassFromCentre, stuckGoodsLookAtIntent } from "../stuckGoodsModel";
import { wave8ImageStyle } from "../wave8Art";
import type { StuckRow } from "./stuckStockView";

// UI-AUDIT-1: one short line beside the crisis bells while stock sits piled in one building and cannot leave — the
// worst pile (the largest), its reason, and how many more. A press looks at that building and opens its inspector.
// LM-R1: the piles are the engine's (`stuckRows`); a pile waiting on a full store names that store's fullness.

export type StuckGoodsChipView = Readonly<{ row: StuckRow; line: string; reason: string; more: string | null; label: string }>;

export function stuckGoodsChipView(state: GameState, rows: readonly StuckRow[]): StuckGoodsChipView | null {
  const row = rows[0];
  if (row === undefined) return null;
  const copy = STUCK_GOODS_COPY;
  const line = copy.line(copy.where[compassFromCentre(state, row.tile)], BUILDING_CONFIG_BY_KIND[row.kind].name, resourceName(row.good), row.amount);
  const reason = stuckReasonText(row);
  return { row, line, reason, more: rows.length > 1 ? copy.more(rows.length - 1) : null, label: copy.pressLabel(line, reason) };
}

/** The press: the camera to the pile's building, then its inspector. */
export function pressStuckGoods(row: StuckRow, onInspect: (buildingId: string) => void): void {
  platformServices().input.emit(stuckGoodsLookAtIntent(row));
  onInspect(row.buildingId);
}

export function StuckGoodsChip({ view, onInspect }: { readonly view: StuckGoodsChipView; readonly onInspect: (buildingId: string) => void }) {
  return (
    <Button type="button" className="stuck-goods-chip" aria-label={view.label} data-stuck-reason={view.row.reason}
      data-stuck-building={view.row.buildingId} onPress={() => pressStuckGoods(view.row, onInspect)} variant="secondary">
      <span className="stuck-goods-bell" aria-hidden="true" style={wave8ImageStyle("icon_alert_bell_bad", 16)} />
      <span className="stuck-goods-line">{view.line}</span>
      <span className="stuck-goods-reason">{view.reason}</span>
      {view.more === null ? null : <span className="stuck-goods-more">{view.more}</span>}
    </Button>
  );
}
