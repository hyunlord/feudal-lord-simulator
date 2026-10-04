import type { ReactElement } from "react";

import type { GameState } from "../engine/engine.types";
import { INSPECTOR_COPY } from "./inspectorCopy.ko";
import { inspectorModel } from "./inspectorModel";
import { UiIcon } from "./UiIcon";
import { StoreInspectorBody } from "./StoreInspector";
import { storeInspectorModel } from "./storeInspectorModel";
import type { StoreStockHistory } from "./storeStockHistory";
import type { StuckRow } from "./hud/stuckStockView";
import { platformServices } from "../platform/platform";
import { burntHouseView } from "./burntHouseModel";
import { BurntHouseSection } from "./MapCardExtras";
import { householdRows } from "./persons/personModels";
import { PersonList } from "./persons/PersonViews";
import { PERSONS_COPY } from "./persons/personsCopy.ko";
import { Button } from "./kit";
import { LordWhyHere } from "./lord/ReceiptPanel";

export type InspectorProps = Readonly<{
  state: GameState;
  /** UI-5: a house's member opens their person card. */
  onPerson?: (personId: string) => void;
  /** Selected building or construction-site id; null hides the inspector. */
  buildingId: string | null;
  onClose: () => void;
  /** UX-3R2: a store opens as the storage inspector (the ledger's column heads, a crisis icon). */
  storeHistory?: StoreStockHistory | null;
  /** UI-AUDIT-1: the HUD's stuck piles; a piled building's "왜?" and "조치" say what the stuck-goods chip says. */
  stuck?: readonly StuckRow[];
  /** LM-R1: opens another building here (a pile's full store: the camera goes there and its card opens). */
  onInspect?: (buildingId: string) => void;
  /** LM-R1: a burnt house's "다시 짓기" (the `rebuild_house` command). */
  onRebuild?: (buildingId: string) => void;
}>;

/** Markup of the left inspector; `Inspector.tsx` adds its stylesheet (kept apart so node tests can render this). */
export function Inspector({ state, buildingId, onClose, storeHistory = null, onPerson, stuck = [], onInspect, onRebuild }: InspectorProps): ReactElement | null {
  const model = inspectorModel(state, buildingId, stuck);
  if (model === null) return null;
  const store = buildingId === null ? null : storeInspectorModel(state, buildingId, storeHistory);
  const house = buildingId === null || state.persons === undefined ? null : state.houses.find(entry => entry.buildingId === buildingId) ?? null;
  const members = house === null ? [] : householdRows(state, house.buildingId);
  const burnt = buildingId === null ? null : burntHouseView(state, buildingId);
  return (
    <section className="left-inspector" data-frame="light" aria-label={INSPECTOR_COPY.regionLabel} data-target={model.target}>
      <header className="left-inspector-heading">
        <div className="left-inspector-title">
          <h2>{model.name}</h2>
          <p className="left-inspector-state">{model.stateLine}</p>
        </div>
        <Button type="button" className="left-inspector-close" aria-label={INSPECTOR_COPY.close} onPress={() => onClose()} variant="close">
          <UiIcon sheet="prediction" cell="block" />
        </Button>
      </header>
      {/* LM-R1 (Astra B03): lord mode's "왜 여기?" here too — a store opened from the ledger lands in this inspector. */}
      <LordWhyHere state={state} targetId={buildingId} beside="slot" />
      {store !== null ? <div className="left-inspector-body"><StoreInspectorBody model={store} /></div> : <div className="left-inspector-body">
        {burnt === null ? null : <BurntHouseSection view={burnt} onRebuild={id => onRebuild?.(id)} />}
        {house === null ? null : <section className="left-inspector-members" aria-label={PERSONS_COPY.membersHeading}>
          <h3>{PERSONS_COPY.membersHeading}</h3>
          {members.length === 0 ? <p className="left-inspector-empty">{PERSONS_COPY.membersEmpty}</p> : <PersonList key={house.buildingId} rows={members} onOpen={onPerson} />}
        </section>}
        <h3>{INSPECTOR_COPY.whyHeading}</h3>
        <ul className="left-inspector-why">
          {model.why.length === 0
            ? <li className="left-inspector-empty">{INSPECTOR_COPY.noCause}</li>
            : model.why.map((line) => (
              <li key={line.text} className={line.block ? "left-inspector-line left-inspector-line--block" : "left-inspector-line"}>
                {line.text}
              </li>
            ))}
        </ul>
        <h3>{INSPECTOR_COPY.actionHeading}</h3>
        <ul className="left-inspector-actions">
          {model.actions.length === 0
            ? <li className="left-inspector-empty">{INSPECTOR_COPY.noAction}</li>
            : model.actions.map((action) => <li key={action}>{action}</li>)}
        </ul>
        {model.toStore === undefined || onInspect === undefined ? null : <Button type="button" className="left-inspector-to-store" data-action="go-to-store"
          data-store={model.toStore.storeId} aria-label={model.toStore.ariaLabel} variant="secondary" onPress={() => {
            const target = state.buildings.find(entry => entry.id === model.toStore?.storeId);
            if (target !== undefined) platformServices().input.emit({ kind: "lookAt", tile: { tx: target.tx, ty: target.ty } });
            if (model.toStore !== undefined) onInspect(model.toStore.storeId);
          }}><UiIcon sheet="action" cell="look" />{model.toStore.label}</Button>}
      </div>}
    </section>
  );
}
