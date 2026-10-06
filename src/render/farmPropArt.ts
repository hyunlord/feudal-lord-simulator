import type { ArtEntry, ArtRect, FarmGroundPropEntry } from './art/artContract';
import { createArtAdapters } from './art/artAdapters';
import type { ArtImageEnvironment } from './art/artImageLoader';
import type { ArtRegistry } from './art/artRegistry';
import { ART_REGISTRY } from './art/wave42Registry';
import type { FarmProp } from './farmProps';
import { tileToScreen } from './iso';
import { drawCroppedWorldSprite } from './worldSprite';
import { ZONE_ASSETS } from './zoneAssetManifest';
import { zoneAsset, zoneAssetRaster } from './zoneAssets';

function isFarmArt(entry: ArtEntry | null): entry is FarmGroundPropEntry {
  return entry?.kind === 'ground-prop' && entry.placement === 'farm-prop';
}
function identitySeed(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i += 1) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619) >>> 0;
  return seed;
}
function legacyBounds(prop: FarmProp): ArtRect | null {
  const meta = ZONE_ASSETS.find(asset => asset.key === prop.kind);
  if (!meta || meta.role !== 'prop') return null;
  const foot = tileToScreen(prop.x, prop.y); const scale = meta.displayWidth / meta.width;
  return { x: foot.sx - meta.anchorX * scale, y: foot.sy - meta.anchorY * scale, width: meta.displayWidth, height: meta.height * scale };
}

/** One unchanged farm-prop identity chooses a static authored view, never a gait or animal count. */
export function createFarmPropArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const select = (prop: FarmProp): FarmGroundPropEntry | null => {
    const entry = registry.select('ground-prop', 'farm-prop', { placement: 'farm-prop', baseId: prop.kind }, identitySeed(prop.id));
    return isFarmArt(entry) && entry.baseId === prop.kind ? entry : null;
  };
  const ready = (prop: FarmProp): FarmGroundPropEntry | null => {
    const entry = select(prop);
    return entry !== null && adapters.image(entry.id) !== null ? entry : null;
  };
  const bounds = (prop: FarmProp): ArtRect | null => {
    const entry = ready(prop); if (!entry) return legacyBounds(prop);
    const foot = tileToScreen(prop.x, prop.y);
    const placement = adapters.placement(entry.id, { at: { x: foot.sx, y: foot.sy } });
    return placement?.type === 'blit' ? placement.targetRect : null;
  };
  const draw = (context: CanvasRenderingContext2D, prop: FarmProp): boolean => {
    const entry = ready(prop); const foot = tileToScreen(prop.x, prop.y);
    if (entry) return adapters.draw(context, entry.id, { at: { x: foot.sx, y: foot.sy } });
    const meta = ZONE_ASSETS.find(asset => asset.key === prop.kind);
    const image = zoneAsset(prop.kind); const target = legacyBounds(prop);
    if (!meta || !image || !target) return false;
    const raster = zoneAssetRaster(prop.kind);
    drawCroppedWorldSprite(context, raster?.image ?? image,
      raster?.source ?? { x: 0, y: 0, width: meta.width, height: meta.height }, target, false, true);
    return true;
  };
  return { select, ready, bounds, draw, loadSettled: adapters.loadSettled };
}
export const FARM_PROP_ART = createFarmPropArt(ART_REGISTRY);
