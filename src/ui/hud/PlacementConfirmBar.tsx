import { platformServices } from "../../platform/platform";
import { UiIcon } from "../UiIcon";
import { PLACEMENT_CONFIRM_COPY } from "./placementConfirmCopy.ko";
import { Button } from "../kit";
import { HUD_ART, HudArt } from "./hudArt";

// UX-3R2 tablet confirm bar (UX3R 8절): shown while a tap has left a building ghost waiting; ✓ = `confirm` (build
// there, the tool stays for the next), ✕ = `cancel` (drop the ghost's spot, one step back). 64 px touch targets.
// INSTALL-18: Wave 18's touch check and cross at the icons' 32 px once loaded (the P0 marks until then).
export function PlacementConfirmBar() {
  return (
    <div className="placement-confirm-bar" data-frame="flat" role="group" aria-label={PLACEMENT_CONFIRM_COPY.label}>
      <Button type="button" className="placement-confirm-button" data-confirm="ok" onPress={() => { platformServices().input.emit({ kind: "confirm" }); }} variant="primary">
        <HudArt id={HUD_ART.confirm} width={32} className="ui-icon" fallback={<UiIcon sheet="prediction" cell="ok" size={32} />} />{PLACEMENT_CONFIRM_COPY.confirm}</Button>
      <Button type="button" className="placement-confirm-button" data-confirm="cancel" onPress={() => { platformServices().input.emit({ kind: "cancel" }); }} variant="secondary">
        <HudArt id={HUD_ART.cancel} width={32} className="ui-icon" fallback={<UiIcon sheet="prediction" cell="block" size={32} />} />{PLACEMENT_CONFIRM_COPY.cancel}</Button>
      <p className="placement-confirm-hint">{PLACEMENT_CONFIRM_COPY.hint}</p>
    </div>
  );
}
