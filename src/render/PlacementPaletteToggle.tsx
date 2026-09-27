import { useEffect, useState } from "react";
import { colorblindEnabled, setColorblindEnabled, subscribeColorblind } from "./placementPaletteFlag";
import { PLACEMENT_PALETTE_COPY } from "./placementPaletteCopy.ko";
import { Button } from "../ui/kit";

/** Settings switch for the placement colourblind palette (UX-3 S-52), kept per browser. */
export function PlacementPaletteToggle() {
  const [enabled, setEnabled] = useState(colorblindEnabled());
  useEffect(() => subscribeColorblind(setEnabled), []);
  return (
    <>
      <Button className="autoplay-toggle" type="button" aria-pressed={enabled} data-colorblind={enabled ? "on" : "off"}
        onPress={() => setColorblindEnabled(!enabled, true)} variant="toggle">
        {PLACEMENT_PALETTE_COPY.toggle}
      </Button>
      <span className="autoplay-hint">{enabled ? PLACEMENT_PALETTE_COPY.on : PLACEMENT_PALETTE_COPY.off}</span>
    </>
  );
}
