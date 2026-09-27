import { buildingEntry, buildingSpriteKeyOf } from "../content/buildingCatalog";
import { buildingCopy } from "../content/buildingCatalog.ko";
import type { BuildingKind } from "../content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { applyInkOutline, snapToPixel } from "./style";
import { spriteMeta } from "./worldAssets";

// BLD-REG: a building kind with no picture yet (no facility art, no runtime sprite, not a house or the farmstead's own
// sprite) is drawn as the plain body the catalog gives it (`nonHouseBodyProfile`) with its name on a chip above, in the
// construction plaque's hand (vellum, ink outline, 12 px serif at every zoom).
const FONT = '12px "Noto Serif KR", Georgia, serif';

export function buildingHasPicture(kind: BuildingKind): boolean {
  return kind === "house" || kind === "farmstead" || buildingEntry(kind).facilityArt !== undefined || spriteMeta(buildingSpriteKeyOf(kind)) !== null;
}

/** The name chip, its bottom `lift` screen px above `center` (the body's top). */
export function drawBuildingNameChip(context: CanvasRenderingContext2D, kind: BuildingKind, center: { readonly x: number; readonly y: number }, lift: number, zoom: number): void {
  const scale = 1 / Math.max(zoom, 0.5);
  const name = buildingCopy(kind).name;
  context.save();
  context.font = FONT.replace("12px", `${12 * scale}px`);
  const width = context.measureText(name).width + 10 * scale;
  const height = 17 * scale;
  const x = center.x - width / 2;
  const y = center.y - lift - height - 4 * scale;
  applyInkOutline(context, zoom);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(snapToPixel(x), snapToPixel(y), snapToPixel(width), snapToPixel(height));
  context.strokeRect(snapToPixel(x), snapToPixel(y), snapToPixel(width), snapToPixel(height));
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = PALETTE.ink;
  context.fillText(name, center.x, y + 13 * scale);
  context.restore();
}
