import type { Building } from "../content/buildingConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { BUILDING_SPRITE_ALPHA } from "./buildingSpriteFit.generated";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { worldSpriteVariantImage } from "./buildingVariantAssets";
import { getSpriteSource } from "./worldAssets";
import { drawCroppedWorldSprite, drawWorldSprite, type WorldSpriteOptions } from "./worldSprite";

// Render fix R0-2: finished buildings drawn from one anchor sprite (well, logging camp, storehouse, barn = granary)
// and the farmstead stand on their footprint. Their authored registration pinned a one-tile painting's ground pivot
// on the footprint's far tile centre: every one floated half a tile row and the 2 x 2 storehouse and granary were a
// one-tile size on a two-by-two plot (scripts/footprintAlignment.ts, tests/footprintAlignment.test.ts). Here the
// art's alpha bounds (scripts/buildBuildingSpriteFit.ts) are fitted instead: centred on the footprint diamond, its
// width FILL of the diamond's, its lowest pixel on the diamond's front vertex drawn in by the same fraction (a small
// well stands on its tile's middle, not on the front edge). Variants share their base's frame and so its fit.
export type FittedSpriteKey = keyof typeof BUILDING_SPRITE_ALPHA;
/** Art width over the footprint diamond's width (the historical houses draw theirs at 0.88). */
export const BUILDING_SPRITE_FILL: Readonly<Record<FittedSpriteKey, number>> = {
  storehouse: 0.87, barn: 0.75, logging_camp: 0.87, farmstead: 0.85, well: 0.52,
};
const HOUSE_FILL = 0.87;

export function isFittedSpriteKey(key: string): key is FittedSpriteKey { return key in BUILDING_SPRITE_ALPHA; }

/** World rect of the whole sprite image (the frame, in meta px scaled), fitted to the building's footprint. */
export function fittedBuildingSpriteRect(key: FittedSpriteKey, building: Pick<Building, "kind" | "tx" | "ty" | "houseLot">) {
  const size = buildingFootprint(building);
  const centre = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const halfWidth = (size.width + size.height) * TILE_W / 4, halfHeight = (size.width + size.height) * TILE_H / 4;
  const fit = BUILDING_SPRITE_ALPHA[key], fill = BUILDING_SPRITE_FILL[key];
  const scale = fill * 2 * halfWidth / fit.alpha.width;
  const ground = centre.sy + halfHeight * Math.min(1, fill / HOUSE_FILL);
  return {
    x: centre.sx - (fit.alpha.x + fit.alpha.width / 2) * scale,
    y: ground - (fit.alpha.y + fit.alpha.height) * scale,
    width: fit.width * scale, height: fit.height * scale,
  };
}

/** A finished building's sprite: fitted keys stand on their footprint; any other key keeps its authored anchor. */
export function drawBuildingSprite(context: CanvasRenderingContext2D, building: Building, spriteKey: string, spriteOptions: WorldSpriteOptions): boolean {
  const variant = worldSpriteVariantImage(building, spriteKey);
  if (!isFittedSpriteKey(spriteKey)) return drawWorldSprite(context, spriteKey, building.tx, building.ty, { ...spriteOptions, image: variant });
  const image = variant ?? getSpriteSource(spriteKey);
  if (image === null) return false;
  drawFittedBuildingSprite(context, spriteKey, building, image);
  return true;
}

/** Draws `image` (the sprite, its render-scale raster, or a same-frame variant) fitted to the building's footprint.
 * The whole image is the frame whatever its resolution (getSprite hands back a raster at the meta's render scale). */
export function drawFittedBuildingSprite(context: CanvasRenderingContext2D, key: FittedSpriteKey, building: Building, image: CanvasImageSource): void {
  const size = image as { readonly width: number; readonly height: number };
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: size.width, height: size.height }, fittedBuildingSpriteRect(key, building), false, true);
}
