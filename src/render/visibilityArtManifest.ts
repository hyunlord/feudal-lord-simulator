import { assetUrlForBase } from "./worldAssets";

// F0-V construction visibility art (Astra Wave 6, public/assets/visibility-v1, scripts/installWave6.py). Sizes and
// anchors are the Wave 6 records' registrations: piles and the sign post stand on a ground baseline at y 56 of their
// 96 x 64 / 32 x 64 canvas; the well stages are three 72 x 80 cells with the pivot (36, 64); the effects and smoke are
// bottom-centred; the work props are four 32 x 32 direction cells (NE SE SW NW).
export const VISIBILITY_ART = {
  pile_wood_1: { "url": "assets/visibility-v1/construction/pile_wood_1-v1.png", width: 96, height: 64, groundY: 56 },
  pile_wood_2: { "url": "assets/visibility-v1/construction/pile_wood_2-v1.png", width: 96, height: 64, groundY: 56 },
  pile_wood_3: { "url": "assets/visibility-v1/construction/pile_wood_3-v1.png", width: 96, height: 64, groundY: 56 },
  pile_stone_1: { "url": "assets/visibility-v1/construction/pile_stone_1-v1.png", width: 96, height: 64, groundY: 56 },
  pile_stone_2: { "url": "assets/visibility-v1/construction/pile_stone_2-v1.png", width: 96, height: 64, groundY: 56 },
  pile_stone_3: { "url": "assets/visibility-v1/construction/pile_stone_3-v1.png", width: 96, height: 64, groundY: 56 },
  sign_post: { "url": "assets/visibility-v1/construction/sign_post-v1.png", width: 32, height: 64, groundY: 56 },
  well_stages: { "url": "assets/visibility-v1/construction/well_stages-v1.png", width: 216, height: 80, groundY: 64 },
  roof_frame_thatch: { "url": "assets/visibility-v1/construction/roof_frame_thatch-v1.png", width: 512, height: 256, groundY: 237 },
  completion_burst: { "url": "assets/visibility-v1/fx/completion_burst-v1.png", width: 384, height: 128, groundY: 128 },
  dust_puff: { "url": "assets/visibility-v1/fx/dust_puff.png", width: 32, height: 32, groundY: 32 },
  fire_large: { "url": "assets/visibility-v1/fx/fire_large.png", width: 96, height: 96, groundY: 96 },
  fire_small: { "url": "assets/visibility-v1/fx/fire_small.png", width: 48, height: 64, groundY: 64 },
  hammer_sparks: { "url": "assets/visibility-v1/fx/hammer_sparks-v1.png", width: 32, height: 32, groundY: 32 },
  smoke_a: { "url": "assets/visibility-v1/fx/smoke_chimney_a.png", width: 32, height: 64, groundY: 64 },
  smoke_b: { "url": "assets/visibility-v1/fx/smoke_chimney_b.png", width: 32, height: 64, groundY: 64 },
  stake_empty_plot: { "url": "assets/visibility-v1/marker/stake_empty_plot.png", width: 32, height: 48, groundY: 48 },
  work_carry_beam: { "url": "assets/visibility-v1/work/work_carry_beam-v1.png", width: 128, height: 32, groundY: 32 },
  work_hammer: { "url": "assets/visibility-v1/work/work_hammer-v1.png", width: 128, height: 32, groundY: 32 },
  work_pose_overlay_m: { "url": "assets/visibility-v1/work/work_pose_overlay_m.png", width: 74, height: 74, groundY: 67 },
  work_shovel: { "url": "assets/visibility-v1/work/work_shovel-v1.png", width: 128, height: 32, groundY: 32 },
  work_sickle: { "url": "assets/visibility-v1/work/work_sickle-v1.png", width: 128, height: 32, groundY: 32 },
} as const;

export type VisibilityArtKey = keyof typeof VISIBILITY_ART;

// Browser image cache (loaded on first use; Node has no Image, so every caller keeps its fallback there).
type Entry = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
const entries = new Map<VisibilityArtKey, Entry>();

export function visibilityArt(key: VisibilityArtKey): HTMLImageElement | null {
  if (typeof Image !== "function") return null;
  let entry = entries.get(key);
  if (entry === undefined) {
    const image = new Image();
    const created: Entry = { image, status: "loading" };
    image.onload = () => { created.status = "ready"; };
    image.onerror = () => { created.status = "missing"; };
    image.src = assetUrlForBase(VISIBILITY_ART[key].url, import.meta.env?.BASE_URL ?? "/");
    entries.set(key, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.image : null;
}

/** Starts loading every visibility image (the first frames draw their fallbacks). */
export function preloadVisibilityArt(): void {
  for (const key of Object.keys(VISIBILITY_ART) as VisibilityArtKey[]) visibilityArt(key);
}
