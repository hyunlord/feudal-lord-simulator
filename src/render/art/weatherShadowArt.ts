import type { WeatherKind } from '../../content/eventConfig';
import type { ArtPoint, WeatherShadowEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { createArtImageLoader, type ArtImageEnvironment } from './artImageLoader';
import { drawCroppedWorldSprite } from '../worldSprite';
import { ART_REGISTRY } from './wave42Registry';

type ReadyShadow = { readonly entry: WeatherShadowEntry; readonly image: HTMLImageElement };
export type WeatherShadowReceipt = {
  readonly family: 'base' | 'variant'; readonly lower: ReadyShadow | null; readonly upper: ReadyShadow | null;
};
export type WeatherShadowPlacement = { readonly origin: ArtPoint; readonly size: number };

/** The only cloud image owner. One synchronous receipt fixes both deck choices for this frame. */
export function createWeatherShadowArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  let loaded: ReturnType<typeof createArtImageLoader> | undefined;
  const loader = () => loaded ??= createArtImageLoader(registry, environment);
  const ready = (role: string): ReadyShadow | null => {
    const entry = registry.select('weather-shadow', role, { weather: 'normal' }, 0);
    if (entry?.kind !== 'weather-shadow') return null;
    const image = loader().image(entry.id);
    return image === null ? null : Object.freeze({ entry, image });
  };
  const resolve = (weather: WeatherKind | null): WeatherShadowReceipt | null => {
    if (weather !== 'normal') return null;
    const lower = ready('cloud-base-lower'); const upper = ready('cloud-base-upper');
    const variantLower = ready('cloud-variant-lower'); const variantUpper = ready('cloud-variant-upper');
    return variantLower !== null && variantUpper !== null
      ? Object.freeze({ family: 'variant', lower: variantLower, upper: variantUpper })
      : Object.freeze({ family: 'base', lower, upper });
  };
  // The context, fixed frame receipt and deck placement are separate draw protocol inputs.
  const drawResolved = (context: CanvasRenderingContext2D, receipt: WeatherShadowReceipt, deck: WeatherShadowEntry['deck'], placement: WeatherShadowPlacement): boolean => {
    const ready = receipt[deck];
    if (ready === null) return false;
    const { entry, image } = ready;
    const factor = placement.size / entry.image.width;
    const rect = { x: placement.origin.x + (placement.size / 2 - entry.geometry.pivot.x * factor), y: placement.origin.y + (placement.size / 2 - entry.geometry.pivot.y * factor),
      width: placement.size, height: entry.image.height * factor };
    if (![placement.size, factor, ...Object.values(rect)].every(Number.isFinite) || placement.size <= 0) throw new RangeError('Cloud placement must be finite and positive');
    drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: entry.image.width, height: entry.image.height }, rect, false, true);
    return true;
  };
  return { resolve, drawResolved };
}
export const WEATHER_SHADOW_ART = createWeatherShadowArt(ART_REGISTRY);
