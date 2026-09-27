import { useEffect, useState } from "react";
import { boundaryV2Enabled, setBoundaryV2Enabled, subscribeBoundaryV2 } from "./renderBoundaryFlag";
import { BOUNDARY_RENDER_COPY } from "./boundaryRenderCopy.ko";
import { RenderScaleToggle } from "./RenderScaleToggle";
import { PlacementPaletteToggle } from "./PlacementPaletteToggle";
import { Button } from "../ui/kit";

/** Settings-menu switch for RENDER_BOUNDARY_V2 (kept per browser; a URL query still overrides it on load), followed by
 * the render scale switch (B9). */
export function BoundaryRenderToggle() {
  const [enabled, setEnabled] = useState(boundaryV2Enabled());
  useEffect(() => subscribeBoundaryV2(setEnabled), []);
  return (
    <>
      <Button className="autoplay-toggle" type="button" aria-pressed={enabled}
        onPress={() => setBoundaryV2Enabled(!enabled, true)} variant="toggle">
        {BOUNDARY_RENDER_COPY.toggle}
      </Button>
      <span className="autoplay-hint">{enabled ? BOUNDARY_RENDER_COPY.on : BOUNDARY_RENDER_COPY.off}</span>
      <RenderScaleToggle />
      <PlacementPaletteToggle />
    </>
  );
}
