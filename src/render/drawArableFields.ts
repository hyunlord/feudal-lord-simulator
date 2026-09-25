import type { GameState } from "../engine/engine.types";
import { RIDGE_PERIOD, RIDGE_ROWS_PER_STRIP, type ArableField } from "../world/boundary/arableFields";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { arableStripStates, type ArableStripState } from "../zones/arableStrips";
import { zonesOf } from "../zones/zoneEdits";
import { PALETTE, RAMPS } from "../content/palette";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { withAlpha } from "./style";
import { ZONE_ASSETS, ZONE_VARIANTS, type ZoneAssetKey } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";
import type { ZoneLayer } from "./zoneLayer";

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

const STATE_CODES: Readonly<Record<ArableStripState, string>> = { ploughed: "p", seedling: "s", growing: "g", fallow: "f" };

/**
 * A light wash over each state's ridges so the four read apart at zoom 0.6, where the painted cues (green dots on the
 * seedling ridges, grass blotches on the fallow ones) shrink to 2-3 px and the three brown strips have nearly the same
 * mean colour (ploughed 102/71/44, seedling 111/80/45, fallow 108/82/51): ploughed darker earth, seedling a fresh
 * green haze, growing a little more gold, fallow a dull olive.
 */
const STATE_WASH: Readonly<Record<ArableStripState, string>> = {
  ploughed: withAlpha(RAMPS.earth[0], 0.22),
  seedling: withAlpha(RAMPS.foliage[5], 0.3),
  growing: withAlpha(RAMPS.thatch[5], 0.12),
  fallow: withAlpha(RAMPS.foliage[2], 0.36),
};

type StateLookup = ReadonlyMap<string, ArableStripState>;
const lookups = new WeakMap<object, WeakMap<object, WeakMap<object, StateLookup>>>();

/** Strip id -> crop state for every arable zone, cached on the buildings, construction sites and zones it reads. */
export function arableStripStateLookup(state: GameState): StateLookup {
  const zones = zonesOf(state);
  let bySites = lookups.get(state.buildings);
  if (bySites === undefined) { bySites = new WeakMap(); lookups.set(state.buildings, bySites); }
  let byZones = bySites.get(state.constructionSites);
  if (byZones === undefined) { byZones = new WeakMap(); bySites.set(state.constructionSites, byZones); }
  const cached = byZones.get(zones);
  if (cached !== undefined) return cached;
  const lookup = new Map<string, ArableStripState>();
  for (const zone of zones) if (zone.kind === "arable") for (const strip of arableStripStates(zone, state).strips) lookup.set(strip.id, strip.state);
  byZones.set(zones, lookup);
  return lookup;
}

/** Chunk key part: the crop state of each strip run the chunk draws (in plan order). */
export function stripStateKey(layer: ZoneLayer, bandIndexes: readonly number[], states: StateLookup): string {
  let key = "";
  for (const index of bandIndexes) {
    const band = layer.arableBands[index];
    key += band === undefined ? "-" : STATE_CODES[states.get(band.stripId) ?? "fallow"];
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
function ridgePair(state: ArableStripState): CanvasImageSource | null {
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
  const width = RIDGE_WIDTH * images.length;
  const joined = canvas2d(width, RIDGE_HEIGHT);
  if (joined === null) return images[0] ?? null;
  images.forEach((image, index) => blit(joined.context, image, 0, 0, RIDGE_WIDTH, RIDGE_HEIGHT, index * RIDGE_WIDTH, 0));
  images.forEach((left, index) => {
    const right = images[(index + 1) % images.length] as HTMLImageElement;
    const join = ((index + 1) * RIDGE_WIDTH) % width;
    const outgoing = canvas2d(JOIN_FADE * 2, RIDGE_HEIGHT); const incoming = canvas2d(JOIN_FADE * 2, RIDGE_HEIGHT);
    if (outgoing === null || incoming === null) return;
    // Each image continued across the join (both wrap on their own), weighted 1 -> 0 and 0 -> 1: summed in
    // premultiplied space ("lighter") that is a straight crossfade.
    for (const [target, image] of [[outgoing, left], [incoming, right]] as const) {
      blit(target.context, image, RIDGE_WIDTH - JOIN_FADE, 0, JOIN_FADE, RIDGE_HEIGHT, 0, 0);
      blit(target.context, image, 0, 0, JOIN_FADE, RIDGE_HEIGHT, JOIN_FADE, 0);
    }
    maskX(outgoing.context, JOIN_FADE * 2, RIDGE_HEIGHT, 1, 0);
    maskX(incoming.context, JOIN_FADE * 2, RIDGE_HEIGHT, 0, 1);
    for (const offset of join === 0 ? [width - JOIN_FADE, -JOIN_FADE] : [join - JOIN_FADE]) {
      joined.context.clearRect(offset, 0, JOIN_FADE * 2, RIDGE_HEIGHT);
      joined.context.globalCompositeOperation = "lighter";
      blit(joined.context, outgoing.canvas, 0, 0, JOIN_FADE * 2, RIDGE_HEIGHT, offset, 0);
      blit(joined.context, incoming.canvas, 0, 0, JOIN_FADE * 2, RIDGE_HEIGHT, offset, 0);
      joined.context.globalCompositeOperation = "source-over";
    }
  });
  return joined.canvas;
}

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  return context === null ? null : { canvas, context };
}

function blit(context: CanvasRenderingContext2D, image: CanvasImageSource, sx: number, sy: number, width: number, height: number, dx: number, dy: number): void {
  drawCroppedWorldSprite(context, image, { x: sx, y: sy, width, height }, { x: dx, y: dy, width, height }, false, false);
}

/** Multiplies alpha by a linear ramp along x, one texel column at a time (the render guards keep gradients out). */
function maskX(context: CanvasRenderingContext2D, width: number, height: number, from: number, to: number): void {
  context.globalCompositeOperation = "destination-in";
  for (let column = 0; column < width; column += 1) {
    context.fillStyle = withAlpha(PALETTE.ink, from + (to - from) * (column + 0.5) / width);
    context.beginPath(); context.rect(column, 0, 1, height); context.fill();
  }
  context.globalCompositeOperation = "source-over";
}

/** Tests and proof tools: one row's texture period in tiles. */
export const RIDGE_ROW_PERIOD_TILES = RIDGE_PERIOD;
