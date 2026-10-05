import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { buildingVariantsEnabled } from "./buildingVariants";
import { loadVariantImage, variantImage, variantSprite } from "./buildingVariantAssets";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";
import { houseCompoundAssetManifest } from "./houseCompoundAssetManifest.generated";
import { houseBodyAssignments, houseBodyEntries, houseCompletions, houseStateLayer, type HousePainting } from "./houseVariantChoice";
import { manifestArt } from "./manifestArt";
import { WAVE26_HOUSE_IMAGES, WAVE26_HOUSE_VARIANTS } from "./wave26HouseManifest.generated";
import { WAVE30_PAIR_HOUSE_IMAGES, WAVE30_PAIR_HOUSE_VARIANTS } from "./wave30PairHouseManifest.generated";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-26 Wave 26 house art on the map (public/assets/wave26/house, scripts/installWave26.py). A painting is drawn in
// the approved house's frame through its own crop (the approved alpha bounds widened to the painting), so it keeps the
// approved registration; its state layers go through the same crop into the same rect. The paintings share the Wave 2
// variant image cache (rasterized like the approved house); the layers the manifest cache (manifestArt), like Wave 7's.
// INSTALL-30: the Wave 30 pair paintings (public/assets/wave30/house_pair, scripts/installWave30.py) the same way, in the
// approved pair's frame (houseCompoundAssets.ts) with their own layers.
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const IMAGES = { ...WAVE26_HOUSE_IMAGES, ...WAVE30_PAIR_HOUSE_IMAGES };
type HouseImageKey = keyof typeof IMAGES;
const layers = manifestArt<HouseImageKey>(IMAGES);
const DECLARED = new Map<string, { readonly width: number; readonly height: number }>([
  ...historicalHouseAssetManifest.map(meta => [`${meta.level}:single`, meta] as const),
  ...houseCompoundAssetManifest.map(meta => [`${meta.level}:${meta.axis}`, meta] as const),
]);
/** The approved frame a painting is registered in: its level's single house, or its level and lot's pair. */
const declaredFrame = (variant: HousePainting) => DECLARED.get(`${variant.level}:${"lot" in variant ? variant.lot : "single"}`);

// Per-frame choice cache (the object pass calls beginHouseVariantFrame once a frame, like beginBuildingVariantFrame).
// Key: the eligible houses' (id, tx, ty, built level, raw pick) and the world seed; the entries are remade only when
// the buildings, houses, persons, events or seed objects change, and the neighbour push only when the key changes.
// Measured (tests/wave26HouseVariants.test.ts, 400 houses, 2,000 persons, dev laptop): entries 0.30 ms, the push
// 0.83 ms, a held frame 0.012 ms, a new houses array (entries + key, push skipped) 0.25 ms; the key holds across ticks
// that change no level, wealth, fire or ale-stake.
let frame: { readonly key: string; readonly assignments: ReadonlyMap<string, HousePainting | null> } | null = null;
let inputs: readonly unknown[] = [];
// Completion ticks by house, from the history ledger. Key: the records array (append-only, replaced on every append).
let completions: { readonly records: unknown; readonly map: ReturnType<typeof houseCompletions> } | null = null;

type FrameState = Pick<GameState, "seed" | "buildings" | "houses"> & Partial<Pick<GameState, "persons" | "events">>;

export function beginHouseVariantFrame(state: FrameState): void {
  const next = [state.buildings, state.houses, state.persons, state.events, state.seed];
  if (next.every((value, index) => value === inputs[index])) return;
  inputs = next;
  const entries = houseBodyEntries(state);
  const key = `${state.seed}|${entries.map(entry => `${entry.building.id}:${entry.building.tx}:${entry.building.ty}:${entry.level}:${entry.lot}:${entry.raw.variant?.variant ?? "-"}`).join(";")}`;
  if (frame?.key !== key) frame = { key, assignments: houseBodyAssignments(state, entries) };
}

/**
 * This frame's Wave 26 (single lot) or Wave 30 (pair lot) painting for the house, when it is loaded and (given `level`)
 * painted for that level and the building's lot (null: the approved painting and its variants).
 */
export function shownHouseVariant(building: Pick<Building, "id"> & Partial<Pick<Building, "houseLot">>, level?: number): HousePainting | null {
  if (!buildingVariantsEnabled()) return null;
  const chosen = frame?.assignments.get(building.id) ?? null;
  const lot = chosen === null ? undefined : "lot" in chosen ? chosen.lot : undefined;
  const variant = chosen !== null && (level === undefined || (chosen.level === level && lot === building.houseLot)) ? chosen : null;
  const declared = variant === null ? undefined : declaredFrame(variant);
  return variant === null || declared === undefined || variantImage(IMAGES[variant.key].url, declared.width, declared.height) === null ? null : variant;
}

/** The painting's url for anchors keyed by art (roof smoke, the birds' ridge), or null. */
export function shownHouseVariantUrl(building: Pick<Building, "id"> & Partial<Pick<Building, "houseLot">>, level: number): string | null {
  const variant = shownHouseVariant(building, level);
  return variant === null ? null : IMAGES[variant.key].url;
}

/** The painting's rect: the approved rect (laid on `bounds`) grown to the painting's crop at the same scale. */
export function wave26HouseRect(variant: HousePainting, bounds: Rect, rect: Rect): Rect {
  const kx = rect.width / bounds.width, ky = rect.height / bounds.height;
  return { x: rect.x + (variant.crop.x - bounds.x) * kx, y: rect.y + (variant.crop.y - bounds.y) * ky,
    width: variant.crop.width * kx, height: variant.crop.height * ky };
}

/** Draws the painting where the approved house would be (`rect` on `bounds`). False while it loads. */
export function drawWave26House(context: CanvasRenderingContext2D, variant: HousePainting, bounds: Rect, rect: Rect): boolean {
  const declared = declaredFrame(variant);
  if (declared === undefined) return false;
  const target = wave26HouseRect(variant, bounds, rect);
  const sprite = variantSprite(IMAGES[variant.key].url, declared.width, declared.height, variant.crop, Math.ceil(target.height * 2));
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
export function drawWave26HouseLayers(context: CanvasRenderingContext2D, variant: HousePainting, bounds: Rect, rect: Rect,
  shown: { readonly state: "fresh" | "weathered" | null; readonly boarded: boolean; readonly snow: boolean; readonly snowAlpha?: number }): void {
  const declared = declaredFrame(variant);
  if (declared === undefined) return;
  const target = wave26HouseRect(variant, bounds, rect);
  const keys = [shown.state === null ? null : `${variant.key}_${shown.state}`, shown.boarded ? `${variant.key}_boarded` : null,
    shown.snow ? `${variant.key}_snow` : null];
  for (const key of keys) if (key !== null) {
    const alpha = context.globalAlpha;
    if (key.endsWith("_snow")) context.globalAlpha = alpha * (shown.snowAlpha ?? 1);
    try { layers.drawOnReference(context, key as HouseImageKey, variant.crop, declared, target); }
    finally { context.globalAlpha = alpha; }
  }
}

/** Starts loading the paintings in the approved frame (awaited with the Wave 2 variants: a capture's first frame has them). */
export function preloadWave26HousePaintings(): Promise<void> {
  return Promise.all([...WAVE26_HOUSE_VARIANTS, ...WAVE30_PAIR_HOUSE_VARIANTS].map(variant => {
    const declared = declaredFrame(variant);
    return declared === undefined ? undefined : loadVariantImage(IMAGES[variant.key].url, declared.width, declared.height);
  })).then(() => undefined);
}

/** The state layers (not awaited, like Wave 7's overlays). */
export const preloadWave26HouseLayers = layers.preload;
