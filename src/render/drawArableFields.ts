import type { GameState } from "../engine/engine.types";
import { RIDGE_PERIOD, RIDGE_ROWS_PER_STRIP, type ArableField } from "../world/boundary/arableFields";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { arableStripStates, type ArableStripState } from "../zones/arableStrips";

/**
 * The strip states the field art draws (C1f): the C1c four plus `harvested` (stubble ridges, Wave 4c), read from the
 * strip's stage (arableStripStates `stage`; `ripe` stays with the growing art, the other stages map as `state`).
 */
export type FieldStripState = ArableStripState | "harvested" | "blighted" | "flooded";
import { zonesOf } from "../zones/zoneEdits";
import { RAMPS } from "../content/palette";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { joinStripImages } from "./stripJoin";
import { withAlpha } from "./style";
import { ZONE_ASSETS, ZONE_VARIANTS, type ZoneAssetKey } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";
import type { ZoneLayer } from "./zoneLayer";
import { wetSummer } from "./wetSummer";
import { wave9Art, type Wave9Key } from "./wave9Art";

// Arable ridge strips in the ground chunks (C1e): after the zone's soil fill, each strip run is drawn as two ridge rows
// of its crop state's a | b strip pair, clipped to the crop area (the headland stays bare soil), then the furrow
// stamps on the joins. The crop state is the engine's read model (`arableStripStates`, C1c Z-18), read every frame;
// the ground chunk key carries the state of every strip run the chunk draws (see stripStateKey), so a crop change
// re-rasters only the chunks of that run.

/** Source px per tile along and across a ridge row (the strip is painted at the game's 128 px per tile). */
const RIDGE_PX_PER_TILE = 128;
const RIDGE_WIDTH = 512;
const RIDGE_HEIGHT = 64;
/** Crossfade at each a | b join (source px): both images wrap on their own, so each is continued across the join. */
const JOIN_FADE = 40;
/** Furrow stamp stroke length at scale 1 (tiles), and its opacity: a furrow is cut into the soil, not laid on it. */
const FURROW_STROKE = 1.4;
const FURROW_ALPHA = 0.75;

const STATE_CODES: Readonly<Record<FieldStripState, string>> = { ploughed: "p", seedling: "s", growing: "g", fallow: "f", harvested: "h", blighted: "b", flooded: "w" };

/**
 * A light wash over each state's ridges so the states read apart at zoom 0.6, where the painted cues (green dots on the
 * seedling ridges, grass blotches on the fallow ones) shrink to 2-3 px and the three brown strips have nearly the same
 * mean colour (ploughed 102/71/44, seedling 111/80/45, fallow 108/82/51): ploughed darker earth, seedling a fresh
 * green haze, growing a little more gold, fallow a dull olive.
 */
const STATE_WASH: Readonly<Record<FieldStripState, string>> = {
  ploughed: withAlpha(RAMPS.earth[0], 0.22),
  seedling: withAlpha(RAMPS.foliage[5], 0.3),
  growing: withAlpha(RAMPS.thatch[5], 0.12),
  fallow: withAlpha(RAMPS.foliage[2], 0.36),
  // C1f: the stubble ridges' mean (119/89/58) sits between fallow and growing; a pale grey straw wash marks the cut field.
  harvested: withAlpha(RAMPS.stone[5], 0.24),
  // UI-4 wet summer (Wave 9 ridges): the blight's grey-brown and the standing water keep their own paint.
  blighted: withAlpha(RAMPS.earth[1], 0.12),
  flooded: withAlpha(RAMPS.water[2], 0.1),
};
/** UI-4: in a wet summer every FLOOD_EVERY-th growing strip stands under water, the rest blight. */
const FLOOD_EVERY = 3;

type StateLookup = ReadonlyMap<string, FieldStripState>;
const lookups = new WeakMap<object, WeakMap<object, WeakMap<object, WeakMap<object, StateLookup>>>>();
const NO_FIELDS: readonly unknown[] = [];

/**
 * Strip id -> crop state for every arable zone. Cache (AGENTS rule 10): (a) keyed on the buildings, construction
 * sites, zones and `arableFields` (C1f: the saved strip records, save v10, which arableStripStates reads for each
 * strip's stage; before C1f a record change with the same buildings, sites and zones could return stale states); every
 * one of them is replaced when it changes. (b) Nothing else is read except the calendar through the tick, which moves
 * with the buildings array (replaced every tick). (c) Unchanged cost: a miss is one arableStripStates pass per arable
 * zone, a hit a map read.
 */
export function arableStripStateLookup(state: GameState): StateLookup {
  const zones = zonesOf(state);
  const fields = (state.arableFields ?? NO_FIELDS) as object;
  let bySites = lookups.get(state.buildings);
  if (bySites === undefined) { bySites = new WeakMap(); lookups.set(state.buildings, bySites); }
  let byZones = bySites.get(state.constructionSites);
  if (byZones === undefined) { byZones = new WeakMap(); bySites.set(state.constructionSites, byZones); }
  let byFields = byZones.get(zones);
  if (byFields === undefined) { byFields = new WeakMap(); byZones.set(zones, byFields); }
  const cached = byFields.get(fields);
  if (cached !== undefined) return cached;
  const lookup = new Map<string, FieldStripState>();
  // UI-4: a wet summer turns the seedling and growing strips blighted (every FLOOD_EVERY-th flooded); the weather is
  // read through the tick, which moves with the buildings array, so the cache key above already covers it.
  const wet = wetSummer(state);
  let crop = 0;
  for (const zone of zones) if (zone.kind === "arable") for (const strip of arableStripStates(zone, state).strips) {
    const stage: FieldStripState = strip.stage === "harvested" ? "harvested" : strip.state;
    const growing = stage === "seedling" || stage === "growing";
    lookup.set(strip.id, wet && growing ? (crop++ % FLOOD_EVERY === FLOOD_EVERY - 1 ? "flooded" : "blighted") : stage);
  }
  byFields.set(fields, lookup);
  return lookup;
}

/** Chunk key part: the crop state of each strip run the chunk draws (in plan order). */
export function stripStateKey(layer: ZoneLayer, bandIndexes: readonly number[], states: StateLookup): string {
  let key = "";
  for (const index of bandIndexes) {
    const band = layer.arableBands[index];
    const state = band === undefined ? null : states.get(band.stripId) ?? "fallow";
    // UI-4: a wet ridge drawn before its Wave 9 art loaded (the growing fallback) re-rasters once it is there.
    const pending = (state === "blighted" || state === "flooded") && WET_RIDGES[state].some(wet => wave9Art(wet) === null);
    key += state === null ? "-" : pending ? STATE_CODES[state].toUpperCase() : STATE_CODES[state];
  }
  return key;
}

export function drawArableFields(context: CanvasRenderingContext2D, layer: ZoneLayer, zoneIndexes: readonly number[], states: StateLookup): void {
  for (const index of zoneIndexes) {
    const field = layer.fields[index];
    if (field === null || field === undefined || field.bands.length === 0) continue;
    context.save();
    context.beginPath();
    for (const rect of field.crop) addQuad(context, [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }]);
    context.clip();
    drawRidgeRows(context, field, states);
    drawFurrowStamps(context, field);
    context.restore();
  }
}

function drawRidgeRows(context: CanvasRenderingContext2D, field: ArableField, states: StateLookup): void {
  if (typeof context.createPattern !== "function") return;
  const rowWidth = 1 / RIDGE_ROWS_PER_STRIP;
  for (const band of field.bands) {
    const state = states.get(band.stripId) ?? "fallow";
    const pair = ridgePair(state);
    if (pair === null) continue;
    const pattern = cachedPattern(context, pair);
    if (pattern === null) continue;
    for (const row of band.rows) {
      const acrossStart = band.line - 0.5 + row.index * rowWidth;
      // Texture u runs along the axis from the row's phase, v across it (0 at the row's -across edge).
      const origin = field.axis === "x" ? { x: row.phase, y: acrossStart } : { x: acrossStart, y: row.phase };
      const uAxis = field.axis === "x" ? { x: 1 / RIDGE_PX_PER_TILE, y: 0 } : { x: 0, y: 1 / RIDGE_PX_PER_TILE };
      const vAxis = field.axis === "x" ? { x: 0, y: 1 / RIDGE_PX_PER_TILE } : { x: 1 / RIDGE_PX_PER_TILE, y: 0 };
      pattern.setTransform(affine(origin, uAxis, vAxis));
      const from = band.from - 0.5; const to = band.to + 0.5; const a = acrossStart; const b = acrossStart + rowWidth;
      context.beginPath();
      addQuad(context, field.axis === "x"
        ? [{ x: from, y: a }, { x: to, y: a }, { x: to, y: b }, { x: from, y: b }]
        : [{ x: a, y: from }, { x: b, y: from }, { x: b, y: to }, { x: a, y: to }]);
      context.fillStyle = pattern;
      context.fill();
      context.fillStyle = STATE_WASH[state];
      context.fill();
    }
  }
}

function drawFurrowStamps(context: CanvasRenderingContext2D, field: ArableField): void {
  for (const stamp of field.stamps) {
    const key = ZONE_VARIANTS.furrow[stamp.variant];
    if (key === undefined) continue;
    const meta = ZONE_ASSETS.find(asset => asset.key === key);
    const raster = zoneAssetRaster(key);
    if (meta === undefined || !("displayWidth" in meta) || raster === null) continue;
    const scale = stamp.length / FURROW_STROKE;
    const width = meta.displayWidth * scale; const height = width * meta.height / meta.width;
    const foot = tileToScreen(stamp.anchor.x, stamp.anchor.y);
    context.save();
    context.translate(foot.sx, foot.sy);
    // Painted along the tile y axis; strips along x join along x, so the stamp is mirrored (no shadow to flip).
    if (field.axis === "x") context.scale(-1, 1);
    context.globalAlpha *= FURROW_ALPHA;
    drawCroppedWorldSprite(context, raster.image, raster.source,
      { x: -width * meta.anchorX / meta.width, y: -height * meta.anchorY / meta.height, width, height }, false, true);
    context.restore();
  }
}

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
function affine(origin: BoundaryPoint, uAxis: BoundaryPoint, vAxis: BoundaryPoint): Matrix {
  const iso = (vector: BoundaryPoint) => ({ x: (vector.x - vector.y) * 32, y: (vector.x + vector.y) * 16 });
  const u = iso(uAxis); const v = iso(vAxis);
  const base = tileToScreen(origin.x, origin.y);
  return { a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx, f: base.sy };
}

function addQuad(context: CanvasRenderingContext2D, points: readonly BoundaryPoint[]): void {
  points.forEach((point, index) => { const screen = tileToScreen(point.x, point.y); if (index === 0) context.moveTo(screen.sx, screen.sy); else context.lineTo(screen.sx, screen.sy); });
  context.closePath();
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();
function cachedPattern(context: CanvasRenderingContext2D, image: CanvasImageSource): CanvasPattern | null {
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat"));
  return map.get(image) ?? null;
}

// Joined a | b canvases per crop state (browser image cache, not simulation state): 1024 x 64, crossfaded at both
// joins so the pair repeats along a row without a seam. Without a DOM (tests) the a image stands in.
const pairs = new Map<string, CanvasImageSource | null>();
const WET_RIDGES: Readonly<Record<"blighted" | "flooded", readonly Wave9Key[]>> = {
  blighted: ["field_ridge_blighted_a", "field_ridge_blighted_b"], flooded: ["field_ridge_flooded", "field_ridge_flooded"],
};
function ridgePair(state: FieldStripState): CanvasImageSource | null {
  if (state === "blighted" || state === "flooded") {
    const images = WET_RIDGES[state].map(key => wave9Art(key));
    if (images.some(image => image === null)) return ridgePair("growing");
    const id = WET_RIDGES[state].join("+");
    const cached = pairs.get(id);
    if (cached !== undefined) return cached;
    const joined = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStrips(images as HTMLImageElement[]);
    pairs.set(id, joined);
    return joined;
  }
  const keys = ZONE_VARIANTS.ridge[state] as readonly ZoneAssetKey[];
  const images = keys.map(key => zoneAsset(key));
  if (images.some(image => image === null)) return null;
  const id = keys.join("+");
  const cached = pairs.get(id);
  if (cached !== undefined) return cached;
  const joined = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStrips(images as HTMLImageElement[]);
  pairs.set(id, joined);
  return joined;
}

/** Proof tools (seam check): the joined a | b canvas the rows repeat. */
export function joinRidgeStripsForProof(images: readonly HTMLImageElement[]): CanvasImageSource | null {
  return joinStrips(images);
}

function joinStrips(images: readonly HTMLImageElement[]): CanvasImageSource | null {
  return joinStripImages(images, RIDGE_WIDTH, RIDGE_HEIGHT, JOIN_FADE);
}

/** Tests and proof tools: one row's texture period in tiles. */
export const RIDGE_ROW_PERIOD_TILES = RIDGE_PERIOD;
