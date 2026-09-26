import type { ReactElement } from "react";

import type { GameState } from "../engine/engine.types";
import { INSPECTOR_COPY } from "./inspectorCopy.ko";
import { inspectorModel } from "./inspectorModel";
import { UiIcon } from "./UiIcon";
import { StoreInspectorBody } from "./StoreInspector";
import { storeInspectorModel } from "./storeInspectorModel";
import type { StoreStockHistory } from "./storeStockHistory";

export type InspectorProps = Readonly<{
  state: GameState;
  /** Selected building or construction-site id; null hides the inspector. */
  buildingId: string | null;
  onClose: () => void;
  /** UX-3R2: a store opens as the storage inspector (the ledger's column heads, a crisis icon). */
  storeHistory?: StoreStockHistory | null;
}>;

/** Markup of the left inspector; `Inspector.tsx` adds its stylesheet (kept apart so node tests can render this). */
export function Inspector({ state, buildingId, onClose, storeHistory = null }: InspectorProps): ReactElement | null {
  const model = inspectorModel(state, buildingId);
  if (model === null) return null;
  const store = buildingId === null ? null : storeInspectorModel(state, buildingId, storeHistory);
  return (
    <section className="left-inspector" aria-label={INSPECTOR_COPY.regionLabel} data-target={model.target}>
      <header className="left-inspector-heading">
        <div className="left-inspector-title">
          <h2>{model.name}</h2>
          <p className="left-inspector-state">{model.stateLine}</p>
        </div>
        <button type="button" className="left-inspector-close" aria-label={INSPECTOR_COPY.close} onClick={() => onClose()}>
          <UiIcon sheet="prediction" cell="block" />
        </button>
      </header>
      {store !== null ? <div className="left-inspector-body"><StoreInspectorBody model={store} /></div> : <div className="left-inspector-body">
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
      </div>}
    </section>
  );
}
