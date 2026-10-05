import { isRegionTexture, type ArtSeason, type RegionGroundTextureEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { createArtImageLoader, type ArtImageEnvironment } from './artImageLoader';
import { ART_REGISTRY } from './wave42Registry';

export type RegionTextureRequest = { readonly baseId: string; readonly season: ArtSeason };
type Pair = readonly [RegionGroundTextureEntry, RegionGroundTextureEntry];
export type RegionPatterns = readonly [CanvasPattern | null, CanvasPattern | null];
/** One lazy loader; context-owned pattern preparation is supplied by the existing land painter. */
export function createRegionTextureArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  let loaded: ReturnType<typeof createArtImageLoader> | undefined;
  const loader = () => loaded ??= createArtImageLoader(registry, environment);
  const pair = (role: 'base' | 'season', request: RegionTextureRequest): Pair | null => {
    const a = registry.select('ground-texture', `land-region-${role}-a`, request, 0);
    const b = registry.select('ground-texture', `land-region-${role}-b`, request, 0);
    return a !== null && b !== null && isRegionTexture(a) && isRegionTexture(b) ? [a, b] : null;
  };
  const selection = (request: RegionTextureRequest) => ({ base: pair('base', request), seasonal: pair('season', request) });
  const ids = (request: RegionTextureRequest): readonly string[] => {
    const selected = selection(request);
    return [...new Set([...(selected.base ?? []), ...(selected.seasonal ?? [])].map(e => e.id))];
  };
  const patterns = (request: RegionTextureRequest, prepare: (image: HTMLImageElement) => CanvasPattern | null): RegionPatterns => {
    const selected = selection(request);
    const prepared = (entries: Pair): RegionPatterns => {
      const images = entries.map(e => loader().image(e.id));
      const a = images[0]; const b = images[1];
      return [a == null ? null : prepare(a), b == null ? null : prepare(b)];
    };
    if (selected.seasonal !== null) {
      // Both patterns, including their transforms, are prepared before the consumer performs its first fill.
      const optional = prepared(selected.seasonal);
      if (optional[0] !== null && optional[1] !== null) return optional;
    }
    // Base images intentionally keep independent readiness; decode readiness strengthens the old onload gate.
    return selected.base === null ? [null, null] : prepared(selected.base);
  };
  return { selection, ids, patterns, image: (id: string) => loader().image(id), status: (id: string) => loader().status(id) };
}
export const REGION_TEXTURE_ART = createRegionTextureArt(ART_REGISTRY);
