import { manifestArt } from "./manifestArt";
import { WAVE3_ALE_IMAGES, type Wave3AleKey } from "./wave3AleManifest.generated";

// INSTALL-3 Wave 3's ale chain (public/assets/wave3, scripts/installWave3Ale.py) through the shared manifest cache
// (manifestArt). The generated manifest carries url and size only; the pivots are Astra's registration records
// (assets-inbox/wave3/candidates-20260926/records), one per folder:
//  - bld: the house L2 edits (alehouse a / b) keep house_l2-v2's 137 px canvas and pivot (70.958, 132.084)
//    (buildings-QA.md); the new 2 x 2 buildings (malthouse a / b, brewhouse) the storehouse's 160 x 136 canvas with
//    the bottom-centre pivot (80, 128);
//  - pile: 96 x 64, ground (48, 59) (piles-QA.md);
//  - loads: the load's base (48, 48) on the cart deck (loads-props-sources.json `loadBasePivot`, as Wave 7's loads);
//  - field: the strip's centre (ground-QA.md; the strips are drawn as ground patterns, not through this pivot);
//  - icons and workers: their top-left (sheets cut by cell; the workers go through the walker composer).
export type { Wave3AleKey } from "./wave3AleManifest.generated";

const PIVOTS: Readonly<Record<(typeof WAVE3_ALE_IMAGES)[Wave3AleKey]["folder"], (key: Wave3AleKey) => { readonly x: number; readonly y: number }>> = {
  bld: key => key.startsWith("alehouse") ? { x: 70.9581339713, y: 132.0837320574 } : { x: 80, y: 128 },
  pile: () => ({ x: 48, y: 59 }),
  loads: () => ({ x: 48, y: 48 }),
  field: () => ({ x: 256, y: 32 }),
  icons: () => ({ x: 0, y: 0 }),
  workers: () => ({ x: 0, y: 0 }),
};

/** The building icon sheet's cells, in Astra's reading order (icons-sources.json: 1 malt kiln, 2 alehouse, 3 brewhouse; the rest the textile chain's). */
export const WAVE3_BUILDING_ICON_CELLS = ["malt_kiln", "alehouse", "brewhouse", "woolhouse", "weaver_house", "fulling_mill", "dyehouse", "cloth_hall"] as const;
export type Wave3BuildingIconCell = (typeof WAVE3_BUILDING_ICON_CELLS)[number];
/** The resource icon sheet's cells (icons-sources.json: 1 barley, 2 malt, 3 ale; the rest the textile chain's). */
export const WAVE3_RESOURCE_ICON_CELLS = ["barley", "malt", "ale", "fleece", "yarn", "raw_cloth", "fulled_cloth", "dyed_cloth", "finished_cloth", "dyes"] as const;
/** Both icon sheets are one row of 96 px cells. */
export const WAVE3_ICON_CELL = 96;

const MANIFEST = Object.fromEntries((Object.keys(WAVE3_ALE_IMAGES) as Wave3AleKey[]).map(key => {
  const meta = WAVE3_ALE_IMAGES[key];
  return [key, { url: meta.url, width: meta.width, height: meta.height, pivot: PIVOTS[meta.folder](key) }];
})) as Readonly<Record<Wave3AleKey, { readonly url: string; readonly width: number; readonly height: number; readonly pivot: { readonly x: number; readonly y: number } }>>;

const wave3 = manifestArt<Wave3AleKey>(MANIFEST);

export const wave3AleArt = wave3.art;
export const preloadWave3AleArt = wave3.preload;
/** Draws `key` with its pivot at (x, y), `scale` world px per asset px. False until loaded (always in Node). */
export const drawWave3Ale = wave3.draw;
/** Draws a picture painted on another art's canvas (the alehouse on house L2's) into that art's rect. */
export const drawWave3AleOnReference = wave3.drawOnReference;
export const wave3AlePivot = (key: Wave3AleKey) => MANIFEST[key].pivot;
