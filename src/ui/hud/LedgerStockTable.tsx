import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../content/buildingConfig";
import { resourceEntry } from "../../content/resourceCatalog";
import { resourceName } from "../../content/resourceCatalog.ko";
import { useState } from "react";

import type { GameState } from "../../engine/engine.types";
import { Button } from "../kit";
import { ResourceGlyph } from "../ResourceArtwork";
import { weeklyTotalChange, type StoreStockHistory } from "../storeStockHistory";
import { HUD_COPY } from "./hudCopy.ko";
import type { ledgerMatrix } from "./statusPillModel";

// NAT-2 (QA-006): the ledger's stock table in five columns that fit the drawer (--box-w-wide) at every size: the good,
// the total, this week, how long it lasts, in how many stores. Astra's 1380 town keeps goods in 49 to 57 stores: one column each
// (UX-0b) put the numbers of the right-hand stores behind a horizontal scroll 3348 px wide. A row's press lights its
// stores on the map as before and lists them under the row (each opens its store card, as the column heads did).
// UI-10: "보관 N곳" is its own button — it unfolds the row to each store's name and amount and folds it again,
// without lighting the map; a row's press (lit, unlit) sets the fold back to follow the light.
export type LedgerFolds = Readonly<Record<string, boolean>>;

/** UI-10: the fold after a press on "보관 N곳" — the row's list shown now (`open`) closes, a closed one opens. */
export function toggledFold(folds: LedgerFolds, resource: string, open: boolean): LedgerFolds {
  return { ...folds, [resource]: !open };
}

/** UI-10: a row's own press (lighting or unlighting its stores) hands its fold back to the light. */
export function foldFollowsLight(folds: LedgerFolds, resource: string): LedgerFolds {
  const { [resource]: _pressed, ...rest } = folds;
  return rest;
}

/** UI-10: a row folds with its light unless its "보관 N곳" was pressed since (`folds`). */
export function ledgerRowOpen(folds: LedgerFolds, resource: string, lit: boolean): boolean {
  return folds[resource] ?? lit;
}

export function LedgerStockTable({ state, matrix, history, food, highlighted, onHighlight, onInspect }: {
  readonly state: GameState; readonly matrix: ReturnType<typeof ledgerMatrix>;
  readonly history: StoreStockHistory | null; readonly food: { readonly days: number | null };
  readonly highlighted: readonly string[]; readonly onHighlight?: ((ids: readonly string[]) => void) | undefined;
  readonly onInspect: (id: string) => void;
}) {
  const [folds, setFolds] = useState<LedgerFolds>({});
  return (
    <div className="ledger-matrix-scroll"><table className="ledger-matrix">
      <thead><tr><th scope="col" /><th scope="col">{HUD_COPY.ledgerTotal}</th><th scope="col">{HUD_COPY.ledgerWeek}</th><th scope="col">{HUD_COPY.ledgerLasts}</th>
        <th scope="col">{HUD_COPY.ledgerHeldIn}</th></tr></thead>
      <tbody>{matrix.rows.map(row => {
        const holders = matrix.stores.flatMap((store, index) => (row.byStore[index] ?? 0) > 0 ? [{ store, amount: row.byStore[index]! }] : []);
        const ids = holders.map(entry => entry.store.id);
        const lit = ids.length > 0 && ids.every(id => highlighted.includes(id)) && highlighted.length === ids.length;
        const week = history === null ? null : weeklyTotalChange(history, row.resource, state);
        const lasts = resourceEntry(row.resource).group === "food" && food.days !== null ? HUD_COPY.ledgerDays(food.days) : HUD_COPY.ledgerNoLasts;
        const open = ids.length > 0 && ledgerRowOpen(folds, row.resource, lit);
        const listId = `ledger-stores-${row.resource}`;
        return [
          <tr key={row.resource} data-resource={row.resource} data-lit={lit ? "true" : undefined}>
            <th scope="row"><Button type="button" className="ledger-row" aria-pressed={lit} aria-label={HUD_COPY.ledgerRowLabel(resourceName(row.resource))}
              onPress={() => { setFolds(current => foldFollowsLight(current, row.resource)); onHighlight?.(lit ? [] : ids); }} variant="surface"><ResourceGlyph resource={row.resource} />{resourceName(row.resource)}</Button></th>
            <td className="ledger-total">{row.total}</td><td className="ledger-week">{HUD_COPY.ledgerWeekValue(week)}</td><td className="ledger-lasts">{lasts}</td>
            <td className="ledger-held">{ids.length === 0 ? HUD_COPY.ledgerHeldCount(0) : <Button type="button" className="ledger-held-toggle" aria-expanded={open}
              aria-controls={open ? listId : undefined} aria-label={HUD_COPY.ledgerHeldToggle(resourceName(row.resource), ids.length)}
              onPress={() => setFolds(current => toggledFold(current, row.resource, open))} variant="surface">{HUD_COPY.ledgerHeldCount(ids.length)}</Button>}</td></tr>,
          open ? <tr key={`${row.resource}:stores`} id={listId} className="ledger-stores-row" data-resource-stores={row.resource}><td colSpan={5}>
            <ul className="ledger-stores" aria-label={HUD_COPY.ledgerStoresOf(resourceName(row.resource))}>{holders.map(({ store, amount }) => (
              <li key={store.id}><Button type="button" className="ledger-store" onPress={() => onInspect(store.id)} variant="secondary">
                {HUD_COPY.ledgerStoreAmount(HUD_COPY.ledgerStore(BUILDING_CONFIG_BY_KIND[store.kind as BuildingKind].name, store.index), amount)}</Button></li>))}</ul>
          </td></tr> : null,
        ];
      })}</tbody>
    </table></div>
  );
}
