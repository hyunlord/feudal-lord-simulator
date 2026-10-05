import type { ArtRect, SeasonalGroundPropEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import type { ArtImageEnvironment } from './artImageLoader';
import { createArtImageLoader } from './artImageLoader';
import { drawCroppedWorldSprite } from '../worldSprite';
import { ART_REGISTRY } from './wave42Registry';
import { SEASONAL_GROUND_PLACEMENT, SEASONAL_GROUND_SLOT, SEASONAL_LEAF_IDS } from './seasonalGroundValidation';

export type SeasonalGroundKey = typeof SEASONAL_LEAF_IDS[number];

export function isSeasonalGroundKey(key: string): key is SeasonalGroundKey {
  return SEASONAL_LEAF_IDS.some(id => id === key);
}
function isSeasonalEntry(entry: ReturnType<ArtRegistry['entry']>): entry is SeasonalGroundPropEntry {
  return entry?.kind === 'ground-prop' && entry.placement === SEASONAL_GROUND_PLACEMENT;
}
function fullRect(entry: SeasonalGroundPropEntry): ArtRect {
  return { x: 0, y: 0, width: entry.image.width, height: entry.image.height };
}

/** Legacy Wave7 leaf keys backed by the art catalog. Draw scale remains the caller's absolute legacy scale. */
export function createSeasonalGroundArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  let loaded: ReturnType<typeof createArtImageLoader> | undefined;
  const loader = () => loaded ??= createArtImageLoader(registry, environment);
  const entry = (key: string): SeasonalGroundPropEntry | null => {
    const found = registry.entry(key);
    return isSeasonalEntry(found) ? found : null;
  };
  const selection = (seed: number): SeasonalGroundKey | null => {
    const selected = registry.select('ground-prop', SEASONAL_GROUND_SLOT, { season: 'autumn', placement: SEASONAL_GROUND_PLACEMENT }, seed);
    return selected !== null && isSeasonalGroundKey(selected.id) ? selected.id : null;
  };
  const draw = (context: CanvasRenderingContext2D, key: string, x: number, y: number, scale: number, frame = 0): boolean => {
    const meta = entry(key);
    if (meta === null || !Number.isFinite(frame)) return false;
    const image = loader().image(key);
    if (image === null) return false;
    drawCroppedWorldSprite(context, image, fullRect(meta), { x: x - meta.geometry.pivot.x * scale, y: y - meta.geometry.pivot.y * scale, width: meta.image.width * scale, height: meta.image.height * scale }, false, true);
    return true;
  };
  const drawOnReference = (context: CanvasRenderingContext2D, key: string, crop: ArtRect, declared: { readonly width: number; readonly height: number }, rect: ArtRect): boolean => {
    const meta = entry(key);
    if (meta === null) return false;
    const image = loader().image(key);
    if (image === null) return false;
    const kx = meta.image.width / declared.width;
    const ky = meta.image.height / declared.height;
    drawCroppedWorldSprite(context, image, { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky }, rect, false, true);
    return true;
  };
  return {
    owns: (key: string): boolean => entry(key) !== null,
    keys: (): readonly SeasonalGroundKey[] => SEASONAL_LEAF_IDS.filter(key => entry(key) !== null),
    selection,
    image: (key: string): HTMLImageElement | null => entry(key) === null ? null : loader().image(key),
    preloadKey: (key: string): void => { if (entry(key) !== null) loader().image(key); },
    status: (key: string) => loader().status(key),
    loadSettled: (key: string) => loader().loadSettled(key),
    onReady: (key: string, callback: (image: HTMLImageElement) => void): void => { if (entry(key) !== null) loader().onReady(key, callback); },
    readinessErrors: (key: string) => loader().readinessErrors(key),
    draw,
    drawOnReference,
  };
}
export const SEASONAL_GROUND_ART = createSeasonalGroundArt(ART_REGISTRY);
