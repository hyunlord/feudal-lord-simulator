import { useEffect, useState } from "react";
import { platformServices } from "../platform/platform";
import { RENDER_SCALES, type RenderScale } from "../platform/PlatformServices";
import { RENDER_SCALE_COPY } from "./renderScaleCopy.ko";
import { Button } from "../ui/kit";

/** Settings-menu switch for the render scale (B9): cycles 0.75 -> 1 -> 1.25, kept in the platform preferences. */
export function RenderScaleToggle() {
  const platform = platformServices().window;
  const [scale, setScale] = useState<RenderScale>(platform.renderScale());
  useEffect(() => platform.subscribeRenderScale(setScale), [platform]);
  const next = RENDER_SCALES[(RENDER_SCALES.indexOf(scale) + 1) % RENDER_SCALES.length] ?? 1;
  return (
    <>
      <Button className="autoplay-toggle" type="button" data-render-scale={scale} onPress={() => platform.setRenderScale(next)} variant="toggle">
        {RENDER_SCALE_COPY.toggle}
      </Button>
      <span className="autoplay-hint">{RENDER_SCALE_COPY.value[scale]}</span>
    </>
  );
}
