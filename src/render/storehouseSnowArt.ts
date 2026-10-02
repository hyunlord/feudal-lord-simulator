import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { worldSpriteVariantImage } from "./buildingVariantAssets";
import { frameBuildingVariant } from "./buildingVariants";
import { fittedBuildingSpriteRect } from "./buildingSpriteFit";
import { manifestArt } from "./manifestArt";
import { seasonBlend, seasonForObject } from "./seasonTransition";
import { STOREHOUSE_SNOW_IMAGES, type StorehouseSnowKey } from "./storehouseSnowManifest.generated";

// NAT-5 RUN-02 (decision N4-D3): winter snow on the storehouse roof (scripts/installStorehouseSnow.py). Each layer is
// painted on its body's own 160 x 136 canvas at offset (0, 0), so it is drawn whole into the body's fitted rect
// (buildingSpriteFit.ts, the "storehouse" key), as the granaries' layers are into theirs. The layer follows the body
// actually drawn: a Wave 2 variant (b, c) once its image is loaded (drawBuildingSprite falls back to storehouse.png
// until then), else the base storehouse.png (a). The snow comes and goes at the roof's own moment, with the houses'
// (`seasonForObject`, same salt). The layers load on the first winter draw that needs them, not at startup.
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const layers = manifestArt<StorehouseSnowKey>(STOREHOUSE_SNOW_IMAGES);
const CANVAS: Rect = { x: 0, y: 0, width: 160, height: 136 };

/** The snow layer for the storehouse body drawn this frame (null: a variant with no layer). */
export function storehouseSnowKey(building: Pick<Building, "id">): StorehouseSnowKey | null {
  const variant = frameBuildingVariant(building);
  if (variant === null || worldSpriteVariantImage(building, "storehouse") === null) return "a";
  return variant.id in STOREHOUSE_SNOW_IMAGES ? variant.id as StorehouseSnowKey : null;
}

/** Whether the storehouse's roof shows snow now (the house roofs' rule, buildingOverlays.ts). */
export function storehouseSnowNow(state: Pick<GameState, "tick" | "scenarioId">, building: Pick<Building, "tx" | "ty">): boolean {
  return seasonForObject(seasonBlend(state), building.tx * 31 + building.ty * 17) === 3;
}

/** The roof snow into the body's fitted rect, in winter. */
export function drawStorehouseSnow(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  if (!storehouseSnowNow(state, building)) return;
  const key = storehouseSnowKey(building);
  if (key !== null) layers.drawOnReference(context, key, CANVAS, CANVAS, fittedBuildingSpriteRect("storehouse", building));
}
