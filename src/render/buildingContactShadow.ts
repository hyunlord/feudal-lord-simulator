import type { Building } from "../content/buildingConfig";
import { SEMANTIC_PALETTE } from "../content/palette";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { tileToScreen } from "./iso";
import { withAlpha } from "./style";

// Contact shadow of a building with curved ground on (C1d, asset spec 4.5 "접지"): one soft ellipse directly under
// the body, drawn in the object pass just before the building itself. It is never baked into a ground chunk, so it
// leaves with the building on the frame it is demolished. Fields (wheat farms) are flat and get none.

/** Fraction of the footprint diamond the ellipse spans (the diamond's inscribed ellipse is 1 / sqrt 2). */
const CONTACT_SPAN = 0.5;
const CONTACT_ALPHA = 0.24;

export function buildingContactEllipse(building: Building): { readonly x: number; readonly y: number; readonly radiusX: number; readonly radiusY: number } | null {
  if (building.kind === "wheat_farm") return null;
  const size = buildingFootprint(building);
  const centre = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const halfWidth = (size.width + size.height) * 16;
  return { x: centre.sx, y: centre.sy, radiusX: halfWidth * CONTACT_SPAN, radiusY: halfWidth * 0.5 * CONTACT_SPAN };
}

export function drawBuildingContactShadowV2(context: CanvasRenderingContext2D, building: Building): void {
  const ellipse = buildingContactEllipse(building);
  if (ellipse === null) return;
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, CONTACT_ALPHA);
  context.beginPath();
  context.ellipse(ellipse.x, ellipse.y, ellipse.radiusX, ellipse.radiusY, 0, 0, Math.PI * 2);
  context.fill();
}
