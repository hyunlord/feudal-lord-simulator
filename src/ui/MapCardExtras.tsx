import type { ReactElement } from "react";

import { resourceName } from "../content/resourceCatalog.ko";
import type { GameState } from "../engine/engine.types";
import { BURNT_HOUSE_COPY } from "./burntHouseCopy.ko";
import { burntHouseView, type BurntHouseView } from "./burntHouseModel";
import { stuckRows, type StuckRow } from "./hud/stuckStockView";
import { INSPECTOR_COPY } from "./inspectorCopy.ko";
import { stuckReasonText } from "./inspectorModel";
import { Button } from "./kit";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { STUCK_GOODS_COPY } from "./stuckGoodsCopy.ko";
import { UiIcon } from "./UiIcon";

// LM-R1: what the map's building card adds above its own body — a pile here that waits on a full store, with the jump
// to that store (playtest #2: the sawmill said "통나무 운반 대기" and the full store was found only by pressing it),
// and a burnt house's rebuild (#8).

export function StuckStoreJump({ row, onJump }: { readonly row: StuckRow; readonly onJump: (buildingId: string) => void }): ReactElement | null {
  const store = row.store;
  if (store === null) return null;
  const storeName = BUILDING_CONFIG_BY_KIND[store.kind].name;
  return (
    <section className="inspector-actions inspector-stuck-store" data-stuck-store={store.id}>
      <p className="inspector-cause-line">{INSPECTOR_COPY.stuckLine(resourceName(row.good), row.amount, stuckReasonText(row))}</p>
      <Button type="button" className="inspector-stuck-store-jump" data-action="go-to-store"
        aria-label={STUCK_GOODS_COPY.toStoreLabel(STUCK_GOODS_COPY.storeFullness(storeName, store.used, store.capacity))}
        onPress={() => onJump(store.id)} variant="secondary"><UiIcon sheet="action" cell="look" />{STUCK_GOODS_COPY.toStore(storeName)}</Button>
    </section>
  );
}

export function BurntHouseSection({ view, onRebuild }: { readonly view: BurntHouseView; readonly onRebuild: (buildingId: string) => void }): ReactElement {
  return (
    <section className="inspector-burnt" data-burnt-house={view.buildingId} aria-label={BURNT_HOUSE_COPY.heading}>
      <h3>{BURNT_HOUSE_COPY.heading}</h3>
      <dl>
        <div><dt>{BURNT_HOUSE_COPY.statusTerm}</dt><dd data-burnt-status="true">{view.status}</dd></div>
        <div><dt>{BURNT_HOUSE_COPY.conditionsTerm}</dt><dd><ul className="inspector-burnt-conditions">
          {view.conditions.map(condition => <li key={condition.text} data-met={condition.met ? "true" : "false"}>
            <UiIcon sheet="prediction" cell={condition.met ? "ok" : "block"} />{condition.text}</li>)}
        </ul></dd></div>
        <div><dt>{BURNT_HOUSE_COPY.nowTerm}</dt><dd data-burnt-now="true">{view.now}</dd></div>
      </dl>
      {view.canRebuild ? <Button type="button" className="inspector-burnt-rebuild" data-action="rebuild-house" onPress={() => onRebuild(view.buildingId)}
        variant="primary">{BURNT_HOUSE_COPY.rebuild}</Button> : null}
      {view.household === null ? null : <p className="inspector-burnt-household">{view.household}</p>}
    </section>
  );
}

/** The extras for the selected building of the map's card (nothing for most buildings). */
export function MapCardExtras({ state, buildingId, onJump, onRebuild }: {
  readonly state: GameState; readonly buildingId: string; readonly onJump: (buildingId: string) => void; readonly onRebuild: (buildingId: string) => void;
}): ReactElement | null {
  const burnt = burntHouseView(state, buildingId);
  const pile = stuckRows(state).find(row => row.buildingId === buildingId && row.store !== null);
  if (burnt === null && pile === undefined) return null;
  return <>
    {burnt === null ? null : <BurntHouseSection view={burnt} onRebuild={onRebuild} />}
    {pile === undefined ? null : <StuckStoreJump row={pile} onJump={onJump} />}
  </>;
}
