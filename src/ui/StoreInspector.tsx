import { platformServices } from "../platform/platform";
import { STORE_INSPECTOR_COPY } from "./storeInspectorCopy.ko";
import type { StoreInspectorModel } from "./storeInspectorModel";
import { UiIcon } from "./UiIcon";

// UX-3R2 storage inspector body (UX3R 6절): the capacity bar, the items it takes (by rule; no per-store switch yet),
// stock per item with this week's change, the buildings and sites its carts serve, and [위치로].
export function StoreInspectorBody({ model }: { readonly model: StoreInspectorModel }) {
  const fill = model.capacity <= 0 ? 0 : Math.min(1, (model.used + model.incoming) / model.capacity);
  return (
    <div className="store-inspector" data-store={model.buildingId}>
      <div className="store-capacity" role="meter" aria-label={STORE_INSPECTOR_COPY.capacityLabel} aria-valuemin={0} aria-valuemax={model.capacity} aria-valuenow={model.used}>
        <span className="store-capacity-bar"><span className="store-capacity-fill" style={{ width: `${Math.round(fill * 100)}%` }} /></span>
        <span className="store-capacity-text">{STORE_INSPECTOR_COPY.capacity(model.used, model.capacity, model.incoming)}</span>
      </div>
      <h3>{STORE_INSPECTOR_COPY.acceptsHeading}</h3>
      <p className="store-accepts">{model.items.map(item => <span key={item.resource} className="store-accept-chip" data-accepted="true">{item.name}</span>)}</p>
      <p className="store-accepts-note">{STORE_INSPECTOR_COPY.acceptsNote}</p>
      <h3>{STORE_INSPECTOR_COPY.stockHeading}</h3>
      <table className="store-stock"><tbody>{model.items.map(item => (
        <tr key={item.resource} data-resource={item.resource}><th scope="row">{item.name}</th><td>{item.stored}</td><td className="store-week">{item.week}</td></tr>))}</tbody></table>
      <h3>{STORE_INSPECTOR_COPY.usersHeading}</h3>
      <ul className="store-users">
        {model.distributors > 0 ? <li>{STORE_INSPECTOR_COPY.distributors(model.distributors)}</li> : null}
        {model.users.length === 0 && model.distributors === 0 ? <li>{STORE_INSPECTOR_COPY.usersNone}</li> : model.users.map(user => <li key={user.key}>{user.text}</li>)}
      </ul>
      <button type="button" className="store-look" onClick={() => { platformServices().input.emit({ kind: "lookAt", tile: model.tile }); }}>
        <UiIcon sheet="action" cell="look" />{STORE_INSPECTOR_COPY.lookAt}</button>
    </div>
  );
}
