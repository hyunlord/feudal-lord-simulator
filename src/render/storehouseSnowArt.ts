import type { Building } from "../content/buildingConfig";
import { worldSpriteVariantImage } from "./buildingVariantAssets";
import { frameBuildingVariant } from "./buildingVariants";
import { fittedBuildingSpriteRect } from "./buildingSpriteFit";
import { manifestArt } from "./manifestArt";

// NAT-5 (RUN-02, decision N4-D3, user 2026-10-03): a storehouse's roof snow in winter. Astra's three layers
// (scripts/installStorehouseSnow.py) are painted on the storehouse picture's own canvas (160 x 136, the picture's
// pivot, offset (0, 0)), one for each picture: `a` for storehouse.png, `b` and `c` for the Wave 2 variants. The layer
// follows the picture on screen (a chosen variant still loading shows storehouse.png, so it takes `a`) and is drawn
// whole-canvas into the same fitted rect as the picture (buildingSpriteFit.ts), like the granary's Wave 32 layers.
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const CANVAS: Rect = { x: 0, y: 0, width: 160, height: 136 };
const LAYER = (variant: "a" | "b" | "c") => ({
  url: `assets/storehouse-snow/storehouse_${variant}_snow.png`, width: 160, height: 136, pivot: { x: 80, y: 120 } });
export const STOREHOUSE_SNOW_IMAGES = { a: LAYER("a"), b: LAYER("b"), c: LAYER("c") } as const;
export type StorehouseSnowKey = keyof typeof STOREHOUSE_SNOW_IMAGES;
const layers = manifestArt<StorehouseSnowKey>(STOREHOUSE_SNOW_IMAGES);

/** The snow layer for the storehouse picture this frame shows: the variant's family once its image is loaded, else `a`. */
export function storehouseSnowKey(building: Pick<Building, "id">, variantShown = worldSpriteVariantImage(building, "storehouse") !== null): StorehouseSnowKey {
  if (!variantShown) return "a";
  const family = frameBuildingVariant(building)?.family;
  return family === "b" || family === "c" ? family : "a";
}

/** Draws the roof snow over a finished storehouse; false until the layer has loaded (the roof stays bare meanwhile). */
export function drawStorehouseSnow(context: CanvasRenderingContext2D, building: Building): boolean {
  return layers.drawOnReference(context, storehouseSnowKey(building), CANVAS, CANVAS, fittedBuildingSpriteRect("storehouse", building));
}

/** Starts loading the three layers with the rest of the world art (preloadGameArt.ts). */
export function preloadStorehouseSnow(): void {
  layers.preload();
}
