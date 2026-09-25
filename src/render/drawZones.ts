import { PALETTE, RAMPS, type PaletteColor } from "../content/palette";
import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { ZoneKind } from "../zones/zone.types";
import { tileToScreen } from "./iso";
import { applyPaletteStroke, withAlpha } from "./style";
import { zoneAsset } from "./zoneAssets";
import type { ZoneLayer } from "./zoneLayer";

// Zone layer in the ground chunks (C1b). Fills sit under the field clusters and the road chunks; outlines, plot
// lines and frontage marks sit on top of the fields. Every fill is one even-odd path per zone from its shared-edge
// rings, and every outline chain is stroked once, so two zones that touch draw exactly one line between them.
// Patterns are world-aligned (the chunk raster draws in world coordinates) and only used with path fill.

type ZoneStyle = { readonly tone: PaletteColor; readonly toneAlpha: number; readonly line: PaletteColor; readonly textureAlpha: number; readonly hatch: boolean };

export const ZONE_STYLES: Readonly<Record<ZoneKind, ZoneStyle>> = {
  // Plots: warm earth tone; arable: its soil fill (C1e; brown with a light furrow hatch until the art loads); pasture
  // and orchard: their Wave 4 floors. The floor variant of each zone is chosen in the zone layer.
  burgage: { tone: RAMPS.earth[4], toneAlpha: 0.32, line: RAMPS.earth[2], textureAlpha: 0.9, hatch: false },
  arable: { tone: RAMPS.earth[2], toneAlpha: 0.32, line: RAMPS.earth[1], textureAlpha: 1, hatch: true },
  pasture: { tone: RAMPS.foliage[4], toneAlpha: 0.2, line: RAMPS.foliage[2], textureAlpha: 0.9, hatch: false },
  orchard: { tone: RAMPS.foliage[3], toneAlpha: 0.2, line: RAMPS.foliage[1], textureAlpha: 0.9, hatch: false },
  hay_meadow: { tone: RAMPS.thatch[4], toneAlpha: 0.2, line: RAMPS.thatch[2], textureAlpha: 0.9, hatch: false },
  woodland_common: { tone: RAMPS.foliage[2], toneAlpha: 0.2, line: RAMPS.foliage[0], textureAlpha: 0.9, hatch: false },
};
const OUTLINE_ALPHA = 0.75;
const SHARED_OUTLINE_ALPHA = 0.55;

export function drawZoneFills(context: CanvasRenderingContext2D, layer: ZoneLayer, zoneIndexes: readonly number[]): void {
  for (const index of zoneIndexes) {
    const zone = layer.zones[index]; const rings = layer.outlines.rings[index];
    if (zone === undefined || rings === undefined || rings.length === 0) continue;
    const style = ZONE_STYLES[zone.kind];
    const texture = zone.floor === null ? null : zoneAsset(zone.floor);
    const pattern = texture === null ? null : cachedPattern(context, texture);
    traceRings(context, rings);
    const previousAlpha = context.globalAlpha;
    if (pattern !== null) {
      // 256x128 source = 2x2 tiles: half scale in screen space, anchored at the world origin plus the zone's offset.
      // Texture fills keep a soft join with the grass around them (textureAlpha < 1), except arable soil.
      const offset = tileToScreen(zone.floorOffset.x, zone.floorOffset.y);
      pattern.setTransform({ a: 0.5, b: 0, c: 0, d: 0.5, e: offset.sx, f: offset.sy });
      context.globalAlpha = previousAlpha * style.textureAlpha;
      context.fillStyle = pattern;
      context.fill("evenodd");
    } else {
      context.fillStyle = withAlpha(style.tone, style.toneAlpha);
      context.fill("evenodd");
      if (style.hatch) {
        const hatch = hatchPattern(context);
        if (hatch !== null) { context.fillStyle = hatch; context.fill("evenodd"); }
      }
    }
    context.globalAlpha = previousAlpha;
  }
}

export function drawZoneLines(context: CanvasRenderingContext2D, layer: ZoneLayer, chainIndexes: readonly number[], bounds: BoundaryBounds, zoom: number): void {
  const near = (point: BoundaryPoint): boolean => point.x >= bounds.left - 1 && point.x <= bounds.right + 1 && point.y >= bounds.top - 1 && point.y <= bounds.bottom + 1;
  // Plot lines first (thin, straight tile edges), then the frontage marks, then the zone outlines on top.
  for (const built of [false, true]) {
    const edges = layer.parcelEdges.filter(edge => edge.built === built && near(edge.a));
    if (edges.length === 0) continue;
    applyPaletteStroke(context, RAMPS.earth[1], zoom);
    context.lineWidth = 1 / zoom;
    const previousAlpha = context.globalAlpha;
    context.globalAlpha = previousAlpha * (built ? 0.2 : 0.5);
    context.beginPath();
    for (const edge of edges) { moveTo(context, edge.a); lineTo(context, edge.b); }
    context.stroke();
    context.globalAlpha = previousAlpha;
  }
  for (const mark of layer.frontage) {
    if (!near({ x: mark.cell.tx, y: mark.cell.ty })) continue;
    // A short tick on the road side of every frontage cell.
    const centre = { x: mark.cell.tx + mark.toward.x * 0.32, y: mark.cell.ty + mark.toward.y * 0.32 };
    const along = { x: -mark.toward.y * 0.14, y: mark.toward.x * 0.14 };
    context.fillStyle = withAlpha(PALETTE.ink, mark.built ? 0.18 : 0.45);
    context.beginPath();
    for (const [index, corner] of [
      { x: centre.x - along.x - mark.toward.x * 0.04, y: centre.y - along.y - mark.toward.y * 0.04 },
      { x: centre.x + along.x - mark.toward.x * 0.04, y: centre.y + along.y - mark.toward.y * 0.04 },
      { x: centre.x + along.x + mark.toward.x * 0.04, y: centre.y + along.y + mark.toward.y * 0.04 },
      { x: centre.x - along.x + mark.toward.x * 0.04, y: centre.y - along.y + mark.toward.y * 0.04 },
    ].entries()) { if (index === 0) moveTo(context, corner); else lineTo(context, corner); }
    context.closePath();
    context.fill();
  }
  for (const index of chainIndexes) {
    const chain = layer.outlines.chains[index];
    if (chain === undefined) continue;
    const [a, b] = chain.labels;
    const owner = layer.zones[b] ?? layer.zones[a];
    if (owner === undefined) continue;
    const shared = a >= 0;
    applyPaletteStroke(context, shared ? PALETTE.ink : ZONE_STYLES[owner.kind].line, zoom);
    context.lineWidth = (shared ? 1 : 1.6) / zoom;
    const previousAlpha = context.globalAlpha;
    context.globalAlpha = previousAlpha * (shared ? SHARED_OUTLINE_ALPHA * 0.6 : OUTLINE_ALPHA);
    context.beginPath();
    chain.points.forEach((point, pointIndex) => { if (pointIndex === 0) moveTo(context, point); else lineTo(context, point); });
    if (chain.closed) context.closePath();
    context.stroke();
    context.globalAlpha = previousAlpha;
  }
}

function traceRings(context: CanvasRenderingContext2D, rings: readonly (readonly BoundaryPoint[])[]): void {
  context.beginPath();
  for (const ring of rings) {
    ring.forEach((point, index) => { if (index === 0) moveTo(context, point); else lineTo(context, point); });
    context.closePath();
  }
}

function moveTo(context: CanvasRenderingContext2D, point: BoundaryPoint): void {
  const screen = tileToScreen(point.x, point.y); context.moveTo(screen.sx, screen.sy);
}

function lineTo(context: CanvasRenderingContext2D, point: BoundaryPoint): void {
  const screen = tileToScreen(point.x, point.y); context.lineTo(screen.sx, screen.sy);
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();
function cachedPattern(context: CanvasRenderingContext2D, image: CanvasImageSource): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat"));
  return map.get(image) ?? null;
}

/** Arable hatch: thin furrow lines along the tile x axis, every quarter tile, drawn once into a small canvas. */
let hatchCanvas: HTMLCanvasElement | null | undefined;
function hatchPattern(context: CanvasRenderingContext2D): CanvasPattern | null {
  if (typeof document === "undefined") return null;
  if (hatchCanvas === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 16;
    const paint = canvas.getContext("2d");
    if (paint === null) { hatchCanvas = null; return null; }
    // Iso furrows run along +x: screen direction (32, 16). Two thin parallelogram bands per 32x16 cell.
    paint.fillStyle = withAlpha(RAMPS.earth[1], 0.28);
    for (const offset of [0, 8]) {
      paint.beginPath();
      paint.moveTo(0, offset); paint.lineTo(32, offset + 16); paint.lineTo(32, offset + 17); paint.lineTo(0, offset + 1);
      paint.closePath(); paint.fill();
      paint.beginPath();
      paint.moveTo(0, offset - 16); paint.lineTo(32, offset); paint.lineTo(32, offset + 1); paint.lineTo(0, offset - 15);
      paint.closePath(); paint.fill();
    }
    hatchCanvas = canvas;
  }
  return hatchCanvas === null ? null : cachedPattern(context, hatchCanvas);
}
