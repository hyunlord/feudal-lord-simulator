import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { buildingVariantsEnabled } from "./buildingVariants";
import { loadVariantImage, variantImage, variantSprite } from "./buildingVariantAssets";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";
import { houseBodyAssignments, houseBodyEntries, houseCompletions, houseStateLayer, type Wave26Variant } from "./houseVariantChoice";
import { manifestArt } from "./manifestArt";
import { WAVE26_HOUSE_IMAGES, WAVE26_HOUSE_VARIANTS, type Wave26HouseKey } from "./wave26HouseManifest.generated";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-26 Wave 26 house art on the map (public/assets/wave26/house, scripts/installWave26.py). A painting is drawn in
// the approved house's frame through its own crop (the approved alpha bounds widened to the painting), so it keeps the
// approved registration; its state layers go through the same crop into the same rect. The paintings share the Wave 2
// variant image cache (rasterized like the approved house); the layers the manifest cache (manifestArt), like Wave 7's.
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const layers = manifestArt<Wave26HouseKey>(WAVE26_HOUSE_IMAGES);
const DECLARED = new Map(historicalHouseAssetManifest.map(meta => [meta.level, meta]));

// Per-frame choice cache (the object pass calls beginHouseVariantFrame once a frame, like beginBuildingVariantFrame).
// Key: the eligible houses' (id, tx, ty, built level, raw pick) and the world seed; the entries are remade only when
// the buildings, houses, persons, events or seed objects change, and the neighbour push only when the key changes.
// Measured (tests/wave26HouseVariants.test.ts, 400 houses, 2,000 persons, dev laptop): entries 0.30 ms, the push
// 0.83 ms, a held frame 0.012 ms, a new houses array (entries + key, push skipped) 0.25 ms; the key holds across ticks
// that change no level, wealth, fire or ale-stake.
let frame: { readonly key: string; readonly assignments: ReadonlyMap<string, Wave26Variant | null> } | null = null;
let inputs: readonly unknown[] = [];
// Completion ticks by house, from the history ledger. Key: the records array (append-only, replaced on every append).
let completions: { readonly records: unknown; readonly map: ReturnType<typeof houseCompletions> } | null = null;

type FrameState = Pick<GameState, "seed" | "buildings" | "houses"> & Partial<Pick<GameState, "persons" | "events">>;

export function beginHouseVariantFrame(state: FrameState): void {
  const next = [state.buildings, state.houses, state.persons, state.events, state.seed];
  if (next.every((value, index) => value === inputs[index])) return;
  inputs = next;
  const entries = houseBodyEntries(state);
  const key = `${state.seed}|${entries.map(entry => `${entry.building.id}:${entry.building.tx}:${entry.building.ty}:${entry.level}:${entry.raw.variant?.variant ?? "-"}`).join(";")}`;
  if (frame?.key !== key) frame = { key, assignments: houseBodyAssignments(state, entries) };
}

/**
 * This frame's Wave 26 painting for the house, when it is loaded and (given `level`) painted for that level (null: the
 * approved painting and its variants).
 */
export function shownHouseVariant(building: Pick<Building, "id">, level?: number): Wave26Variant | null {
  if (!buildingVariantsEnabled()) return null;
  const chosen = frame?.assignments.get(building.id) ?? null;
  const variant = chosen !== null && (level === undefined || chosen.level === level) ? chosen : null;
  const declared = variant === null ? undefined : DECLARED.get(variant.level);
  return variant === null || declared === undefined || variantImage(WAVE26_HOUSE_IMAGES[variant.key].url, declared.width, declared.height) === null ? null : variant;
}

/** The painting's url for anchors keyed by art (roof smoke, the birds' ridge), or null. */
export function shownHouseVariantUrl(building: Pick<Building, "id">, level: number): string | null {
  const variant = shownHouseVariant(building, level);
  return variant === null ? null : WAVE26_HOUSE_IMAGES[variant.key].url;
}

/** The painting's rect: the approved rect (laid on `bounds`) grown to the painting's crop at the same scale. */
export function wave26HouseRect(variant: Wave26Variant, bounds: Rect, rect: Rect): Rect {
  const kx = rect.width / bounds.width, ky = rect.height / bounds.height;
  return { x: rect.x + (variant.crop.x - bounds.x) * kx, y: rect.y + (variant.crop.y - bounds.y) * ky,
    width: variant.crop.width * kx, height: variant.crop.height * ky };
}

/** Draws the painting where the approved house would be (`rect` on `bounds`). False while it loads. */
export function drawWave26House(context: CanvasRenderingContext2D, variant: Wave26Variant, bounds: Rect, rect: Rect): boolean {
  const declared = DECLARED.get(variant.level);
  if (declared === undefined) return false;
  const target = wave26HouseRect(variant, bounds, rect);
  const sprite = variantSprite(WAVE26_HOUSE_IMAGES[variant.key].url, declared.width, declared.height, variant.crop, Math.ceil(target.height * 2));
  if (sprite === null) return false;
  drawCroppedWorldSprite(context, sprite.image, sprite.source, target, false, true);
  return true;
}

/** The house's weathered / fresh layer now (completion ticks from the ledger, cached by its records array). */
export function houseStateLayerNow(state: Pick<GameState, "tick"> & Partial<Pick<GameState, "history">>, house: House) {
  const records = state.history?.records;
  const cached = completions?.records === records && completions !== null ? completions : { records, map: houseCompletions(state.history) };
  completions = cached;
  return houseStateLayer(state.tick, house, cached.map.get(house.buildingId));
}

/** The painting's own layers over it: its weathered or fresh, then boarded (abandoned), then snow (winter). */
export function drawWave26HouseLayers(context: CanvasRenderingContext2D, variant: Wave26Variant, bounds: Rect, rect: Rect,
  shown: { readonly state: "fresh" | "weathered" | null; readonly boarded: boolean; readonly snow: boolean }): void {
  const declared = DECLARED.get(variant.level);
  if (declared === undefined) return;
  const target = wave26HouseRect(variant, bounds, rect);
  const keys = [shown.state === null ? null : `${variant.key}_${shown.state}`, shown.boarded ? `${variant.key}_boarded` : null,
    shown.snow ? `${variant.key}_snow` : null];
  for (const key of keys) if (key !== null) layers.drawOnReference(context, key as Wave26HouseKey, variant.crop, declared, target);
}

/** Starts loading the paintings in the approved frame (awaited with the Wave 2 variants: a capture's first frame has them). */
export function preloadWave26HousePaintings(): Promise<void> {
  return Promise.all(WAVE26_HOUSE_VARIANTS.map(variant => {
    const declared = DECLARED.get(variant.level);
    return declared === undefined ? undefined : loadVariantImage(WAVE26_HOUSE_IMAGES[variant.key].url, declared.width, declared.height);
  })).then(() => undefined);
}

/** The state layers (not awaited, like Wave 7's overlays). */
export const preloadWave26HouseLayers = layers.preload;
