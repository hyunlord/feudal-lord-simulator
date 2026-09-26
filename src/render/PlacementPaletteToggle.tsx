import { useEffect, useState } from "react";
import { colorblindEnabled, setColorblindEnabled, subscribeColorblind } from "./placementPaletteFlag";
import { PLACEMENT_PALETTE_COPY } from "./placementPaletteCopy.ko";

/** Settings switch for the placement colourblind palette (UX-3 S-52), kept per browser. */
export function PlacementPaletteToggle() {
  const [enabled, setEnabled] = useState(colorblindEnabled());
  useEffect(() => subscribeColorblind(setEnabled), []);
  return (
    <>
      <button className="autoplay-toggle" type="button" aria-pressed={enabled} data-colorblind={enabled ? "on" : "off"}
        onClick={() => setColorblindEnabled(!enabled, true)}>
        {PLACEMENT_PALETTE_COPY.toggle}
      </button>
      <span className="autoplay-hint">{enabled ? PLACEMENT_PALETTE_COPY.on : PLACEMENT_PALETTE_COPY.off}</span>
    </>
  );
}
