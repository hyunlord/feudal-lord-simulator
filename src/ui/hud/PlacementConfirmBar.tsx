import { platformServices } from "../../platform/platform";
import { UiIcon } from "../UiIcon";
import { PLACEMENT_CONFIRM_COPY } from "./placementConfirmCopy.ko";

// UX-3R2 tablet confirm bar (UX3R 8절): shown while a tap has left a building ghost waiting; ✓ = `confirm` (build
// there, the tool stays for the next), ✕ = `cancel` (drop the ghost's spot, one step back). 64 px touch targets.
export function PlacementConfirmBar() {
  return (
    <div className="placement-confirm-bar" role="group" aria-label={PLACEMENT_CONFIRM_COPY.label}>
      <button type="button" className="placement-confirm-button" data-confirm="ok" onClick={() => { platformServices().input.emit({ kind: "confirm" }); }}>
        <UiIcon sheet="prediction" cell="ok" size={32} />{PLACEMENT_CONFIRM_COPY.confirm}</button>
      <button type="button" className="placement-confirm-button" data-confirm="cancel" onClick={() => { platformServices().input.emit({ kind: "cancel" }); }}>
        <UiIcon sheet="prediction" cell="block" size={32} />{PLACEMENT_CONFIRM_COPY.cancel}</button>
      <p className="placement-confirm-hint">{PLACEMENT_CONFIRM_COPY.hint}</p>
    </div>
  );
}
