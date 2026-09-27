import { useEffect, useState } from "react";
import { colorblindEnabled, setColorblindEnabled, subscribeColorblind } from "./placementPaletteFlag";
import { PLACEMENT_PALETTE_COPY } from "./placementPaletteCopy.ko";
import { Button } from "../ui/kit";

/** Settings switch for the placement colourblind palette (UX-3 S-52), kept per browser. */
export function PlacementPaletteToggle() {
  const [enabled, setEnabled] = useState(colorblindEnabled());
  useEffect(() => subscribeColorblind(setEnabled), []);
  return (
    // UI-KIT-1b: the switch and its line are one setting (they flowed apart and the line ran under the next button).
    <span className="setting-pair">
      <Button className="autoplay-toggle" type="button" aria-pressed={enabled} data-colorblind={enabled ? "on" : "off"}
        onPress={() => setColorblindEnabled(!enabled, true)} variant="toggle">
        {PLACEMENT_PALETTE_COPY.toggle}
      </Button>
      <span className="autoplay-hint">{enabled ? PLACEMENT_PALETTE_COPY.on : PLACEMENT_PALETTE_COPY.off}</span>
    </span>
  );
}
