import { useRef } from "react";

import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import { resourceName } from "../../content/resourceCatalog.ko";
import { STORAGE_KIND_BY_RESOURCE } from "../../content/resourceConfig";
import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { Button } from "../kit";
import { STUCK_GOODS_COPY } from "../stuckGoodsCopy.ko";
import { compassFromCentre, EMPTY_STUCK_MEMORY, observeStuckGoods, stuckGoods, stuckGoodsLookAtIntent,
  type StuckGoods, type StuckGoodsMemory } from "../stuckGoodsModel";
import { wave8ImageStyle } from "../wave8Art";

// UI-AUDIT-1: one short line beside the crisis bells while stock sits piled in one building and cannot leave — the
// worst pile (the largest), its reason, and how many more. A press looks at that building and opens its inspector.

export type StuckGoodsChipView = Readonly<{ row: StuckGoods; line: string; reason: string; more: string | null; label: string }>;

export function stuckGoodsChipView(state: GameState, rows: readonly StuckGoods[]): StuckGoodsChipView | null {
  const row = rows[0];
  if (row === undefined) return null;
  const copy = STUCK_GOODS_COPY;
  const line = copy.line(copy.where[compassFromCentre(state, row.tile)], BUILDING_CONFIG_BY_KIND[row.kind].name, resourceName(row.good), row.amount);
  const cause = copy.reason[row.reason](BUILDING_CONFIG_BY_KIND[STORAGE_KIND_BY_RESOURCE[row.good]].name);
  const reason = row.spoiling ? copy.spoiling(cause) : cause;
  return { row, line, reason, more: rows.length > 1 ? copy.more(rows.length - 1) : null, label: copy.pressLabel(line, reason) };
}

/** The press: the camera to the pile's building, then its inspector. */
export function pressStuckGoods(row: StuckGoods, onInspect: (buildingId: string) => void): void {
  platformServices().input.emit(stuckGoodsLookAtIntent(row));
  onInspect(row.buildingId);
}

/**
 * The stuck piles of `state` with this session's memory (first seen, last drop, last carter). The memory moves on
 * once per state object — App passes the guidance snapshot, a new object every 60 ticks.
 */
export function useStuckGoods(state: GameState): readonly StuckGoods[] {
  const watch = useRef<{ state: GameState | null; memory: StuckGoodsMemory; rows: readonly StuckGoods[] }>({ state: null, memory: EMPTY_STUCK_MEMORY, rows: [] });
  if (watch.current.state !== state) {
    const memory = observeStuckGoods(state, watch.current.memory);
    watch.current = { state, memory, rows: stuckGoods(state, memory) };
  }
  return watch.current.rows;
}

export function StuckGoodsChip({ view, onInspect }: { readonly view: StuckGoodsChipView; readonly onInspect: (buildingId: string) => void }) {
  return (
    <Button type="button" className="stuck-goods-chip" aria-label={view.label} data-stuck-reason={view.row.reason}
      data-stuck-building={view.row.buildingId} onPress={() => pressStuckGoods(view.row, onInspect)} variant="secondary">
      <span className="stuck-goods-bell" aria-hidden="true" style={wave8ImageStyle("icon_alert_bell_bad", 24)} />
      <span className="stuck-goods-line">{view.line}</span>
      <span className="stuck-goods-reason">{view.reason}</span>
      {view.more === null ? null : <span className="stuck-goods-more">{view.more}</span>}
    </Button>
  );
}
