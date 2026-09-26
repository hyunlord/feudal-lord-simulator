import { manifestArt } from "./manifestArt";
import { WAVE11_ART } from "./wave11ArtManifest.generated";

// INSTALL-11 Wave 11 art (public/assets/wave11, scripts/installWave11.py): construction kits, site props, workers.
export type Wave11Key = keyof typeof WAVE11_ART;
const wave11 = manifestArt<Wave11Key>(WAVE11_ART);

export const wave11Art = wave11.art;
export const preloadWave11Art = wave11.preload;
export const drawWave11 = wave11.draw;
/** A kit stage painted on a finished building's canvas, drawn into that building's rect and crop. */
export const drawWave11OnReference = wave11.drawOnReference;
