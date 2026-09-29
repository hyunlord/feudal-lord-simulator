import { manifestArt } from "./manifestArt";
import { WAVE3_CLOTH_IMAGES, type Wave3ClothKey } from "./wave3ClothManifest.generated";

// CLOTH-UI Wave 3's cloth chain + Wave 2 pastoral farm (public/assets/wave3, public/assets/wave2,
// scripts/installWave3Cloth.py) through the shared manifest cache (manifestArt). Pivots are Astra's
// registration records (assets-inbox/wave3/candidates-20260926/records, wave2/provenance-wave2.csv):
//  - bld: weaver house a / b keep house_l2's 137 x 137 canvas and pivot (70.96, 132.08);
//    fulling mill nesw / nwse use a 200 x 160 canvas, bottom-centre pivot (100, 152);
//    dyehouse a / b, woolhouse, shepherd hut use the storehouse's 160 x 136 canvas, pivot (80, 128);
//    farm_pastoral spring / summer / winter use a 384 x 192 canvas, ground pivot (192, 184)
//    (provenance-wave2.csv `placement` / `pivot`).
//  - yard: tenter frames a / b / dyed use a 384 x 192 canvas, ground pivot (192, 184).
//  - pile: 96 x 64, ground (48, 59).
//  - loads: the load's base (48, 48) on the cart deck.
//  - workers: top-left (0, 0) (sheets cut by cell; go through the walker composer).
export type { Wave3ClothKey } from "./wave3ClothManifest.generated";

const PIVOTS: Readonly<Record<(typeof WAVE3_CLOTH_IMAGES)[Wave3ClothKey]["folder"], (key: Wave3ClothKey) => { readonly x: number; readonly y: number }>> = {
  bld: key => {
    if (key.startsWith("weaver_house")) return { x: 70.9581339713, y: 132.0837320574 };
    if (key.startsWith("fulling_mill_wheel")) return { x: 0, y: 0 };
    if (key.startsWith("fulling_mill")) return { x: 100, y: 152 };
    if (key.startsWith("farm_pastoral")) return { x: 192, y: 184 };
    return { x: 80, y: 128 };
  },
  yard: () => ({ x: 192, y: 184 }),
  pile: () => ({ x: 48, y: 59 }),
  loads: () => ({ x: 48, y: 48 }),
  workers: () => ({ x: 0, y: 0 }),
};

const MANIFEST = Object.fromEntries((Object.keys(WAVE3_CLOTH_IMAGES) as Wave3ClothKey[]).map(key => {
  const meta = WAVE3_CLOTH_IMAGES[key];
  return [key, { url: meta.url, width: meta.width, height: meta.height, pivot: PIVOTS[meta.folder](key) }];
})) as Readonly<Record<Wave3ClothKey, { readonly url: string; readonly width: number; readonly height: number; readonly pivot: { readonly x: number; readonly y: number } }>>;

const wave3Cloth = manifestArt<Wave3ClothKey>(MANIFEST);

export const wave3ClothArt = wave3Cloth.art;
export const preloadWave3ClothArt = wave3Cloth.preload;
/** Draws `key` with its pivot at (x, y), `scale` world px per asset px. False until loaded (always in Node). */
export const drawWave3Cloth = wave3Cloth.draw;
export const wave3ClothPivot = (key: Wave3ClothKey) => MANIFEST[key].pivot;
