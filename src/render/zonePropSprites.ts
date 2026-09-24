import { tileToScreen } from "./iso";
import { townLandscapeSprite } from "./townLandscapeAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { ZONE_ASSETS } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";
import type { ZoneProp } from "./zoneLayer";

// Object-pass sprites for zone props (C1b): the existing orchard tree (phase16 landscape, optionally mirrored), the
// Wave 4 apple tree c and the two haycocks (never mirrored: they are real variants). Bottom-centre anchored.

export function drawZoneProp(context: CanvasRenderingContext2D, prop: ZoneProp): void {
  const foot = tileToScreen(prop.x, prop.y);
  const sprite = propSprite(prop.kind);
  if (sprite === null) return;
  const width = sprite.displayWidth * prop.scale; const height = width * sprite.height / sprite.width;
  const destination = { x: foot.sx - width / 2, y: foot.sy - height * sprite.anchorY, width, height };
  if (!prop.flip) { drawCroppedWorldSprite(context, sprite.image, sprite.source, destination, false, true); return; }
  context.save();
  context.translate(foot.sx * 2, 0);
  context.scale(-1, 1);
  drawCroppedWorldSprite(context, sprite.image, sprite.source, destination, false, true);
  context.restore();
}

type PropSprite = { image: CanvasImageSource; source: { x: number; y: number; width: number; height: number }; width: number; height: number; displayWidth: number; anchorY: number };

function propSprite(kind: ZoneProp["kind"]): PropSprite | null {
  if (kind === "orchard_tree") return townLandscapeSprite("orchard");
  const meta = ZONE_ASSETS.find(asset => asset.key === kind);
  const image = zoneAsset(kind);
  if (meta === undefined || meta.role !== "prop" || image === null) return null;
  const raster = zoneAssetRaster(kind);
  return { image: raster?.image ?? image, source: raster?.source ?? { x: 0, y: 0, width: meta.width, height: meta.height },
    width: meta.width, height: meta.height, displayWidth: meta.displayWidth, anchorY: meta.anchorY / meta.height };
}
