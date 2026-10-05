import { manifestArt } from "./manifestArt";
import { WAVE7_ART } from "./wave7ArtManifest.generated";
import { isSeasonalGroundKey, SEASONAL_GROUND_ART } from "./art/seasonalGroundArt";

// INSTALL-7 Wave 7 art (public/assets/wave7, scripts/installWave7.py) through the shared manifest cache (manifestArt).
export type Wave7Key = keyof typeof WAVE7_ART;
const wave7 = manifestArt<Wave7Key>(WAVE7_ART);

export const wave7Art = (key: Wave7Key): HTMLImageElement | null => isSeasonalGroundKey(key) ? SEASONAL_GROUND_ART.image(key) : wave7.art(key);
export const preloadWave7Art = (include?: (url: string) => boolean): void => {
  for (const key of Object.keys(WAVE7_ART) as Wave7Key[]) {
    const url = WAVE7_ART[key].url;
    if (include !== undefined && !include(url)) continue;
    if (isSeasonalGroundKey(key)) SEASONAL_GROUND_ART.preloadKey(key);
    else wave7.art(key);
  }
};
/** Draws `key` with its pivot at (x, y), `scale` world px per asset px; `frame` picks a sheet cell. False until loaded. */
export const drawWave7 = (context: CanvasRenderingContext2D, key: Wave7Key, x: number, y: number, scale: number, frame = 0): boolean => isSeasonalGroundKey(key)
  ? SEASONAL_GROUND_ART.draw(context, key, x, y, scale, frame)
  : wave7.draw(context, key, x, y, scale, frame);
/** Draws an overlay painted on the same canvas as the art it covers (roof snow, boarded windows) into that art's rect. */
export const drawWave7Overlay = (context: CanvasRenderingContext2D, key: Wave7Key, crop: Parameters<typeof wave7.drawOnReference>[2], declared: Parameters<typeof wave7.drawOnReference>[3], rect: Parameters<typeof wave7.drawOnReference>[4]): boolean => isSeasonalGroundKey(key)
  ? SEASONAL_GROUND_ART.drawOnReference(context, key, crop, declared, rect)
  : wave7.drawOnReference(context, key, crop, declared, rect);
