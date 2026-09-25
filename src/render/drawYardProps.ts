import type { YardProps } from "../world/boundary/yardProps";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { ZONE_ASSETS, ZONE_VARIANTS } from "./zoneAssetManifest";
import { zoneAssetRaster } from "./zoneAssets";

// Croft beds in the ground chunks (C1e): flat decals on the house yards, drawn after the yard ground and before the
// aprons, at every zoom (a bed's outline must still read at zoom 0.6; spec 4.4 keeps big beds). The hurdles are
// object-pass sprites (zonePropSprites), since the house in front of or behind them decides their order.

export function drawCroftBeds(context: CanvasRenderingContext2D, props: YardProps, bedIndexes: readonly number[]): void {
  for (const index of bedIndexes) {
    const bed = props.beds[index];
    const key = bed === undefined ? undefined : ZONE_VARIANTS.croftBed[bed.variant];
    if (bed === undefined || key === undefined) continue;
    const meta = ZONE_ASSETS.find(asset => asset.key === key);
    const raster = zoneAssetRaster(key);
    if (meta === undefined || !("displayWidth" in meta) || raster === null) continue;
    const width = meta.displayWidth; const height = width * meta.height / meta.width;
    const foot = tileToScreen(bed.anchor.x, bed.anchor.y);
    context.save();
    context.translate(foot.sx, foot.sy);
    // The art's long side runs along +x; a back strip along y takes the mirrored bed.
    if (bed.mirror) context.scale(-1, 1);
    drawCroppedWorldSprite(context, raster.image, raster.source,
      { x: -width * meta.anchorX / meta.width, y: -height * meta.anchorY / meta.height, width, height }, false, true);
    context.restore();
  }
}
