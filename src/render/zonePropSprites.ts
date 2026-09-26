import { tileToScreen } from "./iso";
import { townLandscapeSprite } from "./townLandscapeAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { ZONE_ASSETS } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";
import type { ZoneProp } from "./zoneLayer";
import { seasonPropRaster, seasonVariant, type SeasonIndex } from "./seasonArt";
import { seasonForObject, type SeasonBlend } from "./seasonTransition";

// Object-pass sprites for zone props (C1b) and yard hurdles (C1e): the existing orchard tree (phase16 landscape), the
// Wave 4 / 4b orchard trees and haycocks (never mirrored: they are real variants), and the hurdle panels (mirrored for
// the +x run, spec 0-A of C1e). Anchored at the manifest's (anchorX, anchorY); a mirrored sprite mirrors about it.
// INSTALL-15: orchard trees blossom in spring and stand bare in winter (Wave 15, same canvas and anchor; autumn keeps
// the fruiting summer art), each turning at its own moment while the season changes.

export function drawZoneProp(context: CanvasRenderingContext2D, prop: ZoneProp, season?: SeasonBlend): void {
  drawZonePropIn(context, prop, season === undefined ? 1 : seasonForObject(season, Math.round(prop.x * 31 + prop.y * 17)));
}

function drawZonePropIn(context: CanvasRenderingContext2D, prop: ZoneProp, season: SeasonIndex): void {
  const foot = tileToScreen(prop.x, prop.y);
  const sprite = seasonalProp(propSprite(prop.kind), prop.kind, season);
  if (sprite === null) return;
  const width = sprite.displayWidth * prop.scale; const height = width * sprite.height / sprite.width;
  if (!prop.flip) {
    drawCroppedWorldSprite(context, sprite.image, sprite.source, { x: foot.sx - width * sprite.anchorX, y: foot.sy - height * sprite.anchorY, width, height }, false, true);
    return;
  }
  context.save();
  context.translate(foot.sx, 0);
  context.scale(-1, 1);
  drawCroppedWorldSprite(context, sprite.image, sprite.source, { x: -width * sprite.anchorX, y: foot.sy - height * sprite.anchorY, width, height }, false, true);
  context.restore();
}

function seasonalProp(sprite: PropSprite | null, kind: ZoneProp["kind"], season: SeasonIndex): PropSprite | null {
  const variant = sprite === null ? null : seasonVariant(kind, season);
  const raster = variant === null ? null : seasonPropRaster(variant, sprite?.displayWidth);
  return sprite === null || raster === null ? sprite : { ...sprite, image: raster.image, source: raster.source };
}

type PropSprite = { image: CanvasImageSource; source: { x: number; y: number; width: number; height: number }; width: number; height: number; displayWidth: number; anchorX: number; anchorY: number };

function propSprite(kind: ZoneProp["kind"]): PropSprite | null {
  if (kind === "orchard_tree") {
    const sprite = townLandscapeSprite("orchard");
    return sprite === null ? null : { ...sprite, anchorX: 0.5 };
  }
  const meta = ZONE_ASSETS.find(asset => asset.key === kind);
  const image = zoneAsset(kind);
  if (meta === undefined || (meta.role !== "prop" && meta.role !== "module") || image === null) return null;
  const raster = zoneAssetRaster(kind);
  return { image: raster?.image ?? image, source: raster?.source ?? { x: 0, y: 0, width: meta.width, height: meta.height },
    width: meta.width, height: meta.height, displayWidth: meta.displayWidth, anchorX: meta.anchorX / meta.width, anchorY: meta.anchorY / meta.height };
}
