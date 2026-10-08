import { PALETTE, RAMPS, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import { drawUiIcon, type UiIconCell, type UiIconSheet } from "../ui/uiArt";
import { drawHudCanvasIcon, drawTilePattern, HUD_PATTERN_ART, HUD_REASON_ART } from "./hudCanvasArt";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { colorblindEnabled } from "./placementPaletteFlag";
import type { TileMark, TileMarkReason } from "./placementTileMarks";
import { applyInkOutline, applyPaletteStroke, snapToPixel, withAlpha } from "./style";

// UX-3 S-52: fine = a green fill (blue in colourblind mode); blocked = vermilion + 45° hatch + the reason's icon in the
// tile's middle. The hatch and the icon carry the difference, so a grey-scale view still tells the two apart. The ring
// is outline only: the road / forest the building touches is filled lightly in the fine colour, a missing contact
// (or wall clearance) hatches the ring thinly. Palette colours only (every literal lives in content/palette.ts): the
// work order's blue and orange-red map to the water ramp's light blue and the palette vermilion.
// INSTALL-18: Wave 18's patterns lie over the fills, one per tile (fine = dots; blocked by what is on the tile = the 45°
// hatch; a whole-building reason = the cross-hatch), and six reasons draw their Wave 18 picture; until a picture loads
// (or when it fails) the code hatch and the P0 icon stay.
// INSTALL-18 grey check (user 2026-10-08): the outline itself says it — a placeable tile has a solid outline, a blocked
// tile a thick dashed one and a big ✕ across its middle (code, not a picture), so the two part without colour or pattern.
const HATCH_SPACING_PX = 6;
const DASH_PX = [7, 5] as const;
const CROSS_HALF = 0.32; // the ✕'s half-span as a share of the tile's half-width / half-height
const ICON_PX = 20;

const REASON_ICON: Readonly<Record<TileMarkReason, readonly [UiIconSheet, string]>> = {
  building: ["building", "hut"], road: ["building", "road"], water: ["cause", "water"], edge: ["prediction", "block"],
  wall: ["building", "palisade"], needs_road: ["building", "road"], needs_forest: ["resource", "timber"],
  needs_water: ["cause", "water"], needs_flowing_water: ["cause", "water"], needs_rock: ["resource", "stone"],
  materials: ["resource", "timber"], zone: ["layer", "zone"], locked: ["lock", "locked"],
};
/** The reasons that come from the tile itself (placementTileMarks tileReason); the rest fail the whole building. */
const TILE_REASONS: ReadonlySet<TileMarkReason> = new Set(["building", "road", "water", "edge"]);

// The fine fill is the lightest foliage / water step: the mid greens vanish on grass.
export const placementFineColour = (): PaletteColor => colorblindEnabled() ? RAMPS.water[5] : RAMPS.foliage[5];

function traceDiamond(context: CanvasRenderingContext2D, tx: number, ty: number): void {
  const center = tileToScreen(tx, ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}

/** 45° lines across the current path (clipped to it); spacing is kept in screen pixels. */
function hatch(context: CanvasRenderingContext2D, tx: number, ty: number, zoom: number, alpha: number): void {
  const center = tileToScreen(tx, ty);
  const step = HATCH_SPACING_PX / zoom;
  context.save();
  context.clip();
  context.beginPath();
  for (let offset = -TILE_W; offset <= TILE_W; offset += step) {
    context.moveTo(center.sx + offset - TILE_H, center.sy + TILE_H);
    context.lineTo(center.sx + offset + TILE_H, center.sy - TILE_H);
  }
  context.globalAlpha *= alpha;
  applyPaletteStroke(context, PALETTE.ink, zoom);
  context.lineWidth = 1.5 / zoom;
  context.stroke();
  context.restore();
}

/** A thick dashed outline on the current path: a light rim under an ink dash (screen pixels kept at any zoom). */
function dashedOutline(context: CanvasRenderingContext2D, zoom: number, width: number): void {
  context.setLineDash?.(DASH_PX.map(px => px / zoom));
  applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
  context.lineWidth = (width + 2) / zoom;
  context.stroke();
  applyPaletteStroke(context, PALETTE.ink, zoom);
  context.lineWidth = width / zoom;
  context.stroke();
  context.setLineDash?.([]);
}

/** A big ✕ across the tile's middle, light rim under ink. */
function cross(context: CanvasRenderingContext2D, tx: number, ty: number, zoom: number): void {
  const centre = tileToScreen(tx, ty);
  const dx = (TILE_W / 2) * CROSS_HALF; const dy = (TILE_H / 2) * CROSS_HALF * 2;
  context.beginPath();
  context.moveTo(centre.sx - dx, centre.sy - dy); context.lineTo(centre.sx + dx, centre.sy + dy);
  context.moveTo(centre.sx + dx, centre.sy - dy); context.lineTo(centre.sx - dx, centre.sy + dy);
  context.lineCap = "round";
  applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
  context.lineWidth = 6 / zoom;
  context.stroke();
  applyPaletteStroke(context, PALETTE.ink, zoom);
  context.lineWidth = 3 / zoom;
  context.stroke();
}

export function drawMarkTile(context: CanvasRenderingContext2D, mark: TileMark, zoom: number): void {
  const centre = tileToScreen(mark.tx, mark.ty);
  context.save();
  traceDiamond(context, mark.tx, mark.ty);
  if (mark.ring) {
    if (mark.contact === true) { context.fillStyle = withAlpha(placementFineColour(), 0.3); context.fill(); }
    if (!mark.ok && !drawTilePattern(context, HUD_PATTERN_ART.hatch, centre.sx, centre.sy, 0.35)) hatch(context, mark.tx, mark.ty, zoom, 0.35);
    traceDiamond(context, mark.tx, mark.ty);
    if (mark.ok) {
      context.globalAlpha *= 0.35;
      applyPaletteStroke(context, PALETTE.ink, zoom);
      context.stroke();
    } else dashedOutline(context, zoom, 2);
    context.restore();
    return;
  }
  context.fillStyle = withAlpha(mark.ok ? placementFineColour() : PALETTE.vermilion, mark.ok ? 0.6 : 0.55);
  context.fill();
  const pattern = mark.ok ? HUD_PATTERN_ART.ok : mark.reason === null || TILE_REASONS.has(mark.reason) ? HUD_PATTERN_ART.hatch : HUD_PATTERN_ART.cross;
  if (!drawTilePattern(context, pattern, centre.sx, centre.sy) && !mark.ok) hatch(context, mark.tx, mark.ty, zoom, 0.75);
  traceDiamond(context, mark.tx, mark.ty);
  if (mark.ok) {
    // A light rim reads on grass and forest alike; the ink outline sits inside it — solid: this tile takes the building.
    applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
    context.lineWidth = 3 / zoom;
    context.stroke();
    applyInkOutline(context, zoom);
    context.stroke();
  } else {
    dashedOutline(context, zoom, 3);
    cross(context, mark.tx, mark.ty, zoom);
  }
  context.restore();
  if (mark.icon && mark.reason !== null) {
    const [sheet, cell] = REASON_ICON[mark.reason];
    const art = HUD_REASON_ART[mark.reason];
    if (art === undefined || !drawHudCanvasIcon(context, art, centre.sx, centre.sy, ICON_PX / zoom)) {
      drawUiIcon(context, sheet, cell as UiIconCell<typeof sheet>, centre.sx, centre.sy, ICON_PX / zoom);
    }
  }
}

/** Ring first (under), then the footprint. */
export function drawTileMarks(context: CanvasRenderingContext2D, marks: readonly TileMark[], zoom: number): void {
  for (const mark of marks) if (mark.ring) drawMarkTile(context, mark, zoom);
  for (const mark of marks) if (!mark.ring) drawMarkTile(context, mark, zoom);
}
