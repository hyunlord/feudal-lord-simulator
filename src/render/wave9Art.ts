import { manifestArt } from "./manifestArt";
import { WAVE9_IMAGES } from "./wave9ArtManifest.generated";

// UI-4 Wave 9 event art (public/assets/wave9, scripts/installWave9and16.py) through the shared manifest cache.
export type Wave9Key = keyof typeof WAVE9_IMAGES;
const wave9 = manifestArt<Wave9Key>(WAVE9_IMAGES);

export const wave9Art = wave9.art;
export const preloadWave9Art = wave9.preload;
/** Draws `key` with its pivot at (x, y), `scale` world px per asset px; `frame` picks a sheet cell. False until loaded. */
export const drawWave9 = wave9.draw;
/** Draws a house overlay painted on that house level's own canvas (fire, burnt) into the house's rect. */
export const drawWave9Overlay = wave9.drawOnReference;
export const wave9Meta = (key: Wave9Key) => WAVE9_IMAGES[key];
