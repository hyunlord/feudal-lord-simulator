import { createArtAdapters } from "./art/artAdapters";
import type { UiImageEntry } from "./art/artContract";
import { ART_REGISTRY } from "./art/wave42Registry";
import { TILE_H, TILE_W } from "./iso";
import type { TileMarkReason } from "./placementTileMarks";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-18: the Wave 18 pictures the map canvas draws (the placement reasons, the placement patterns, the service
// edge), from the art catalog's `hud-wave18` bundle (ui-image, renderer B's contract). Each draw returns false until its
// picture has loaded at its declared size — and when it is missing or fails — so the caller keeps its own drawing (the
// P0 icon, the code hatch, the gold line). Patterns are laid one per tile at the tile's own 64 × 32 diamond (the lattice
// the records give: top vertex (32,0), left (0,16)); nothing is stretched or mirrored.
// Cache (AGENTS rule 10): the loader's (a) key is the asset id; (b) nothing else enters — the registry is the startup
// catalog snapshot, fixed for the session; (c) so each picture is requested and decoded once.
const adapters = createArtAdapters(ART_REGISTRY);

type Canvas = Parameters<typeof drawCroppedWorldSprite>[0] & Pick<CanvasRenderingContext2D, "translate" | "rotate" | "globalAlpha">;

/** The six placement reasons Wave 18 drew; the others (and `road`: a road lies on the tile, the opposite of the picture's
 * missing road) keep their P0 icon. */
export const HUD_REASON_ART: Readonly<Partial<Record<TileMarkReason, string>>> = {
  building: "hud.reasons.reason_overlap", water: "hud.reasons.reason_water", wall: "hud.reasons.reason_wall_forbidden",
  needs_road: "hud.reasons.reason_no_road", materials: "hud.reasons.reason_material_shortage", zone: "hud.reasons.reason_zone_forbidden",
};
export const HUD_PATTERN_ART = { ok: "hud.patterns.pattern_ok", hatch: "hud.patterns.pattern_blocked_hatch", cross: "hud.patterns.pattern_blocked_cross" } as const;
const SERVICE_EDGE = "hud.patterns.pattern_service_range_edge";
/** The edge strip's dash period in source pixels (records: eight dashes in 128). */
const EDGE_PERIOD = 16;

function ready(id: string): { readonly image: HTMLImageElement; readonly entry: UiImageEntry } | null {
  const placed = adapters.placement(id, { at: { x: 0, y: 0 } });
  if (placed?.type !== "ui-handoff" || placed.entry.kind !== "ui-image") return null;
  const image = adapters.image(id);
  return image === null ? null : { image, entry: placed.entry };
}

/** A square HUD picture centred on (x, y) at `size` world px (the caller divides by the zoom for a screen size). */
export function drawHudCanvasIcon(context: Canvas, id: string, x: number, y: number, size: number): boolean {
  const art = ready(id);
  if (art === null) return false;
  drawCroppedWorldSprite(context, art.image, { x: 0, y: 0, width: art.entry.image.width, height: art.entry.image.height },
    { x: x - size / 2, y: y - size / 2, width: size, height: size }, false, true);
  return true;
}

/** One pattern diamond over the tile whose centre is (sx, sy), at the tile's world size. */
export function drawTilePattern(context: Canvas, id: string, sx: number, sy: number, alpha = 1): boolean {
  const art = ready(id);
  if (art === null || art.entry.image.width !== TILE_W || art.entry.image.height !== TILE_H) return false;
  const previous = context.globalAlpha;
  context.globalAlpha = previous * alpha;
  drawCroppedWorldSprite(context, art.image, { x: 0, y: 0, width: TILE_W, height: TILE_H },
    { x: sx - TILE_W / 2, y: sy - TILE_H / 2, width: TILE_W, height: TILE_H }, false, true);
  context.globalAlpha = previous;
  return true;
}

/**
 * The service range's edge: the dashed strip laid along the range ellipse, one dash period at a time, each piece turned
 * to the curve and drawn at its source size on screen (1 / zoom world px per source px, like the line it sits on).
 */
export function drawServiceEdge(context: Canvas, cx: number, cy: number, rx: number, ry: number, zoom: number): boolean {
  const art = ready(SERVICE_EDGE);
  if (art === null) return false;
  const { width, height } = art.entry.image;
  const step = EDGE_PERIOD / zoom;
  const samples = 720;
  const point = (index: number) => { const angle = index / samples * Math.PI * 2; return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }; };
  // A piece starts where the last one ended once the curve has run one period; the last, shorter stretch stays empty.
  let start = point(0); let previous = start; let carried = 0; let piece = 0;
  for (let index = 1; index <= samples; index += 1) {
    const next = point(index);
    carried += Math.hypot(next.x - previous.x, next.y - previous.y);
    previous = next;
    if (carried < step) continue;
    context.save();
    context.translate(start.x, start.y);
    context.rotate(Math.atan2(next.y - start.y, next.x - start.x));
    drawCroppedWorldSprite(context, art.image, { x: (piece * EDGE_PERIOD) % width, y: 0, width: EDGE_PERIOD, height },
      { x: 0, y: -height / 2 / zoom, width: step, height: height / zoom }, false, true);
    context.restore();
    start = next; carried = 0; piece += 1;
  }
  return true;
}
