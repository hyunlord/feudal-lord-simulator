import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingVariantsEnabled } from "./buildingVariants";
import { loadVariantImage, variantImage } from "./buildingVariantAssets";
import { granaryLayerKeys, granaryLayers, granaryVariantAssignments, type Wave32Granary } from "./granaryVariantChoice";
import { manifestArt } from "./manifestArt";
import { WAVE32_GRANARY_IMAGES, WAVE32_GRANARY_VARIANTS, type Wave32GranaryKey } from "./wave32GranaryManifest.generated";

// INSTALL-32 Wave 32 granary art on the map (public/assets/wave32/granary, scripts/installWave32.py). The three paintings
// are barn.png's replacements on its own canvas (160 x 144, pivot and alpha bounds identical), so a granary keeps the
// barn's R0-2 fit to its 2 x 2 footprint (buildingSpriteFit.ts, the "barn" key), its occlusion rect and its depth; only
// the image differs. A painting shares the Wave 2 variant image cache (like the storehouse's variants); its layers the
// manifest cache (manifestArt, like Wave 26's), drawn whole-canvas into the same rect. No roof smoke (the barn had none).
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const layers = manifestArt<Wave32GranaryKey>(WAVE32_GRANARY_IMAGES);
const CANVAS: Rect = { x: 0, y: 0, width: 160, height: 144 };

// Per-frame choice cache (the object pass calls beginGranaryVariantFrame once a frame, like beginHouseVariantFrame).
// Key: the granaries' (id, tx, ty) and the world seed — all the choice reads; the list is rebuilt when the buildings
// array or the seed changes (every tick moves the buildings array), the neighbour push only when the key changes.
let frame: { readonly key: string; readonly assignments: ReadonlyMap<string, Wave32Granary> } | null = null;
let inputs: readonly unknown[] = [];

export function beginGranaryVariantFrame(state: Pick<GameState, "seed" | "buildings">): void {
  if (state.buildings === inputs[0] && state.seed === inputs[1]) return;
  inputs = [state.buildings, state.seed];
  const key = `${state.seed}|${state.buildings.filter(building => building.kind === "granary").map(building => `${building.id}:${building.tx}:${building.ty}`).join(";")}`;
  if (frame?.key !== key) frame = { key, assignments: granaryVariantAssignments(state) };
}

function paintingImage(variant: Wave32Granary): HTMLImageElement | null {
  const meta = WAVE32_GRANARY_IMAGES[variant.key];
  return variantImage(meta.url, meta.width, meta.height);
}

/** This frame's Wave 32 painting for the granary once it is loaded (null: not a granary, variants off, or loading — barn.png). */
export function shownGranaryVariant(building: Pick<Building, "id">): Wave32Granary | null {
  if (!buildingVariantsEnabled()) return null;
  const chosen = frame?.assignments.get(building.id);
  return chosen === undefined || paintingImage(chosen) === null ? null : chosen;
}

/** The painting's image for the fitted barn draw (null: draw barn.png). */
export function shownGranaryImage(building: Pick<Building, "id">): HTMLImageElement | null {
  const variant = shownGranaryVariant(building);
  return variant === null ? null : paintingImage(variant);
}

/** The painting's own layers (granaryVariantChoice.ts order) into the granary's fitted rect. */
export function drawWave32GranaryLayers(context: CanvasRenderingContext2D, state: Pick<GameState, "tick" | "scenarioId">, building: Building, rect: Rect): void {
  const variant = shownGranaryVariant(building);
  if (variant === null) return;
  for (const key of granaryLayerKeys(variant, granaryLayers(state, building))) layers.drawOnReference(context, key, CANVAS, CANVAS, rect);
}

/** Starts loading the three paintings (awaited with the Wave 2 variants: a capture's first frame has them). */
export function preloadWave32GranaryPaintings(): Promise<void> {
  return Promise.all(WAVE32_GRANARY_VARIANTS.map(variant => {
    const meta = WAVE32_GRANARY_IMAGES[variant.key];
    return loadVariantImage(meta.url, meta.width, meta.height);
  })).then(() => undefined);
}

/** The state layers (not awaited, like Wave 26's); the props are registered only and never requested. */
export function preloadWave32GranaryLayers(): void {
  layers.preload(url => WAVE32_GRANARY_VARIANTS.some(variant => url.startsWith(`assets/wave32/granary/${variant.key}_`)));
}
