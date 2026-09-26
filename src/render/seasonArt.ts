import type { GameState } from "../engine/engine.types";
import { stateCalendar } from "../engine/scenarioState";
import { SEASON_IMAGES } from "./seasonArtManifest.generated";
import { townLandscapeManifest } from "./townLandscapeManifest.generated";
import { ZONE_ASSETS } from "./zoneAssetManifest";
import { assetUrlForBase, spriteMeta } from "./worldAssets";
import { scaledWorldAssetSource } from "./worldAssetScaleCache";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-15 seasonal nature (Wave 15, scripts/installWave15.py): the picture chooser and the browser image cache.
// A variant replaces its base art on the same canvas and registration (records/README.md "파일 사용 계약"), so a draw
// site only swaps the image: `seasonVariant(base, season)` names the variant, or null for the base art (summer, and
// every base without a variant that season: pines and stumps change in winter only, orchards have no autumn).
// Winter oaks come bare and with thin snow: the tree's own salt picks one, so about half the oaks carry snow.
export type SeasonKey = keyof typeof SEASON_IMAGES;
/** Calendar seasons (stateCalendar): 0 spring, 1 summer, 2 autumn, 3 winter. */
export type SeasonIndex = 0 | 1 | 2 | 3;
type Entry = (typeof SEASON_IMAGES)[SeasonKey];
type VariantEntry = Extract<Entry, { readonly bases: readonly string[] }>;

const SEASON_NAMES = { spring: 0, autumn: 2, winter: 3, winter_snow: 3 } as const;
const variantsByBase = new Map<string, Map<SeasonIndex, SeasonKey[]>>();
for (const key of (Object.keys(SEASON_IMAGES) as SeasonKey[]).sort()) {
  const entry = SEASON_IMAGES[key] as Entry;
  if (!("bases" in entry)) continue;
  for (const base of (entry as VariantEntry).bases) {
    const bySeason = variantsByBase.get(base) ?? new Map<SeasonIndex, SeasonKey[]>();
    const season = SEASON_NAMES[(entry as VariantEntry).season];
    bySeason.set(season, [...(bySeason.get(season) ?? []), key]);
    variantsByBase.set(base, bySeason);
  }
}

export function seasonOf(state: Pick<GameState, "tick" | "scenarioId">): SeasonIndex {
  return stateCalendar(state).season as SeasonIndex;
}

/** The variant of `base` for `season` (null: the base art). `salt` picks among several (winter oaks: bare or snow). */
export function seasonVariant(base: string, season: SeasonIndex, salt = 0): SeasonKey | null {
  const choices = variantsByBase.get(base)?.get(season);
  if (choices === undefined || choices.length === 0) return null;
  return choices[Math.abs(Math.trunc(salt)) % choices.length] ?? null;
}

/** Every variant key one season draws (the chunk art's readiness, the tests). */
export function seasonVariants(season: SeasonIndex): readonly SeasonKey[] {
  const keys = new Set<SeasonKey>();
  for (const bySeason of variantsByBase.values()) for (const key of bySeason.get(season) ?? []) keys.add(key);
  return [...keys].sort();
}

// Display widths of the props a variant replaces (the zone orchard trees and the phase16 orchard tree they started from).
const PROP_WIDTHS = new Map<string, number>([
  ...ZONE_ASSETS.flatMap(asset => asset.role === "prop" && "displayWidth" in asset ? [[asset.key, asset.displayWidth] as [string, number]] : []),
  ["orchard_tree", townLandscapeManifest.find(meta => meta.id === "orchard")?.displayWidth ?? 40],
]);

type Loaded = { status: "loading" | "ready" | "missing"; image: HTMLImageElement | null;
  sprite: CanvasImageSource | null; raster: RasterizedWorldSprite | null };
// Browser image cache, not game state: 65 images, 1.5 MB, all requested the first time any season art is asked for
// (the renderer asks on its first frame). The render-scale copy of a world sprite and the downscaled prop raster are
// made when the image loads, not on the frame the season turns.
const loaded = new Map<SeasonKey, Loaded>();

export function preloadSeasonArt(): void {
  if (typeof Image !== "function" || loaded.size > 0) return;
  for (const key of Object.keys(SEASON_IMAGES) as SeasonKey[]) {
    const meta = SEASON_IMAGES[key] as Entry;
    const entry: Loaded = { status: "loading", image: null, sprite: null, raster: null };
    loaded.set(key, entry);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== meta.width || image.naturalHeight !== meta.height) { entry.status = "missing"; return; }
      entry.image = image; entry.status = "ready";
      const base = "bases" in meta ? (meta as VariantEntry).bases[0] ?? "" : "";
      if (spriteMeta(base) !== null) seasonSprite(key);
      const width = PROP_WIDTHS.get(base);
      if (width !== undefined) seasonPropRaster(key, width);
    };
    image.onerror = () => { entry.status = "missing"; };
    image.src = assetUrlForBase(meta.url, import.meta.env?.BASE_URL ?? "/");
  }
}

/** The received image (fills, strips, fringe and edge decals, season decals, fx sheets); null until loaded. */
export function seasonImage(key: SeasonKey): HTMLImageElement | null {
  preloadSeasonArt();
  const entry = loaded.get(key);
  return entry?.status === "ready" ? entry.image : null;
}

/** A world-sprite variant (trees, shrubs, stumps, tufts, stones) at its base's render scale, as getSprite returns it. */
export function seasonSprite(key: SeasonKey): CanvasImageSource | null {
  const image = seasonImage(key); const entry = loaded.get(key);
  if (image === null || entry === undefined) return null;
  if (entry.sprite === null) {
    const meta = SEASON_IMAGES[key] as Entry; const base = "bases" in meta ? spriteMeta((meta as VariantEntry).bases[0] ?? "") : null;
    entry.sprite = scaledWorldAssetSource({ source: image, width: meta.width, height: meta.height, renderScale: base?.renderScale ?? 1 });
  }
  return entry.sprite;
}

/** A prop variant (orchard trees), downscaled once to twice its display height like the zone props it replaces. */
export function seasonPropRaster(key: SeasonKey, displayWidth = PROP_WIDTHS.get(baseOf(key)) ?? 40): RasterizedWorldSprite | null {
  const image = seasonImage(key); const entry = loaded.get(key);
  if (image === null || entry === undefined) return null;
  if (entry.raster === null) {
    const meta = SEASON_IMAGES[key] as Entry;
    try { entry.raster = rasterizeWorldSprite(image, { x: 0, y: 0, width: meta.width, height: meta.height }, Math.ceil(displayWidth * meta.height / meta.width * 2)); }
    catch (error) { if (!(error instanceof Error)) throw error; entry.raster = null; }
  }
  return entry.raster;
}

/** One character per key (1 = ready): part of the ground chunk key, so a chunk re-rasters when its season art loads. */
export function seasonArtReadiness(keys: readonly SeasonKey[]): string {
  preloadSeasonArt();
  return keys.map(key => loaded.get(key)?.status === "ready" ? "1" : "0").join("");
}

export function seasonArtStatuses(): readonly { readonly key: SeasonKey; readonly status: Loaded["status"] | "idle" }[] {
  return (Object.keys(SEASON_IMAGES) as SeasonKey[]).map(key => ({ key, status: loaded.get(key)?.status ?? "idle" }));
}

/** Draws a season decal or fx frame with its pivot at (x, y), `scale` world px per asset px. False until loaded. */
export function drawSeasonArt(context: CanvasRenderingContext2D, key: SeasonKey, x: number, y: number, scale: number, frame = 0): boolean {
  const image = seasonImage(key);
  if (image === null) return false;
  const meta = SEASON_IMAGES[key] as Entry;
  const pivot = "pivot" in meta ? meta.pivot : { x: meta.width / 2, y: meta.height / 2 };
  const cell = "frames" in meta ? meta.frames : { width: meta.width, height: meta.height, count: 1 };
  const index = ((frame % cell.count) + cell.count) % cell.count;
  drawCroppedWorldSprite(context, image, { x: index * cell.width, y: 0, width: cell.width, height: cell.height },
    { x: x - pivot.x * scale, y: y - pivot.y * scale, width: cell.width * scale, height: cell.height * scale }, false, true);
  return true;
}

function baseOf(key: SeasonKey): string {
  const meta = SEASON_IMAGES[key] as Entry;
  return "bases" in meta ? (meta as VariantEntry).bases[0] ?? "" : "";
}

/** Tests only: install stand-in images for every variant (null clears them), ready as sprite and prop raster too. */
export function setSeasonArtForTest(image: ((key: SeasonKey) => HTMLImageElement) | null): void {
  loaded.clear();
  if (image === null) return;
  for (const key of Object.keys(SEASON_IMAGES) as SeasonKey[]) {
    const meta = SEASON_IMAGES[key] as Entry; const stand = image(key);
    loaded.set(key, { status: "ready", image: stand, sprite: stand, raster: { image: stand, source: { x: 0, y: 0, width: meta.width, height: meta.height } } });
  }
}

export function seasonMeta<K extends SeasonKey>(key: K): (typeof SEASON_IMAGES)[K] {
  return SEASON_IMAGES[key];
}
