import { PALETTE, RAMPS, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import { drawUiIcon, type UiIconCell, type UiIconSheet } from "../ui/uiArt";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { colorblindEnabled } from "./placementPaletteFlag";
import type { TileMark, TileMarkReason } from "./placementTileMarks";
import { applyInkOutline, applyPaletteStroke, snapToPixel, withAlpha } from "./style";

// UX-3 S-52: fine = a green fill (blue in colourblind mode); blocked = vermilion + 45° hatch + the reason's icon in the
// tile's middle. The hatch and the icon carry the difference, so a grey-scale view still tells the two apart. The ring
// is outline only: the road / forest the building touches is filled lightly in the fine colour, a missing contact
// (or wall clearance) hatches the ring thinly. Palette colours only (every literal lives in content/palette.ts): the
// work order's blue and orange-red map to the water ramp's light blue and the palette vermilion.
const HATCH_SPACING_PX = 6;
const ICON_PX = 20;

const REASON_ICON: Readonly<Record<TileMarkReason, readonly [UiIconSheet, string]>> = {
  building: ["building", "hut"], road: ["building", "road"], water: ["cause", "water"], edge: ["prediction", "block"],
  wall: ["building", "palisade"], needs_road: ["building", "road"], needs_forest: ["resource", "timber"],
  materials: ["resource", "timber"], zone: ["layer", "zone"], locked: ["lock", "locked"],
};

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

export function drawMarkTile(context: CanvasRenderingContext2D, mark: TileMark, zoom: number): void {
  context.save();
  traceDiamond(context, mark.tx, mark.ty);
  if (mark.ring) {
    if (mark.contact === true) { context.fillStyle = withAlpha(placementFineColour(), 0.3); context.fill(); }
    if (!mark.ok) hatch(context, mark.tx, mark.ty, zoom, 0.35);
    traceDiamond(context, mark.tx, mark.ty);
    context.globalAlpha *= mark.ok ? 0.35 : 0.8;
    applyPaletteStroke(context, mark.ok ? PALETTE.ink : PALETTE.vermilion, zoom);
    context.stroke();
    context.restore();
    return;
  }
  context.fillStyle = withAlpha(mark.ok ? placementFineColour() : PALETTE.vermilion, mark.ok ? 0.6 : 0.55);
  context.fill();
  if (!mark.ok) { hatch(context, mark.tx, mark.ty, zoom, 0.75); traceDiamond(context, mark.tx, mark.ty); }
  // A light rim reads on grass and forest alike; the ink outline sits inside it.
  applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
  context.lineWidth = 3 / zoom;
  context.stroke();
  applyInkOutline(context, zoom);
  context.stroke();
  context.restore();
  if (mark.icon && mark.reason !== null) {
    const [sheet, cell] = REASON_ICON[mark.reason];
    const center = tileToScreen(mark.tx, mark.ty);
    drawUiIcon(context, sheet, cell as UiIconCell<typeof sheet>, center.sx, center.sy, ICON_PX / zoom);
  }
}

/** Ring first (under), then the footprint. */
export function drawTileMarks(context: CanvasRenderingContext2D, marks: readonly TileMark[], zoom: number): void {
  for (const mark of marks) if (mark.ring) drawMarkTile(context, mark, zoom);
  for (const mark of marks) if (!mark.ring) drawMarkTile(context, mark, zoom);
}
