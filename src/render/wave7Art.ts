import { manifestArt } from "./manifestArt";
import { WAVE7_ART } from "./wave7ArtManifest.generated";

// INSTALL-7 Wave 7 art (public/assets/wave7, scripts/installWave7.py) through the shared manifest cache (manifestArt).
export type Wave7Key = keyof typeof WAVE7_ART;
const wave7 = manifestArt<Wave7Key>(WAVE7_ART);

export const wave7Art = wave7.art;
export const preloadWave7Art = wave7.preload;
/** Draws `key` with its pivot at (x, y), `scale` world px per asset px; `frame` picks a sheet cell. False until loaded. */
export const drawWave7 = wave7.draw;
/** Draws an overlay painted on the same canvas as the art it covers (roof snow, boarded windows) into that art's rect. */
export const drawWave7Overlay = wave7.drawOnReference;
