import { PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { marketReachView } from "../ui/marketReachModel";
import { cachedExpansionPreview, pendingPastureWarning } from "../ui/wallExpansionModel";
import { tileToScreen } from "./iso";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import { drawMarketReach } from "./placementPredictionOverlay";
import { applyPaletteStroke, withAlpha } from "./style";
import { drawZoneBrushOverlay, type ZoneBrushView } from "./zoneBrushOverlay";

/**
 * The zone brush's overlay, then the UX-0b2 town-plan overlays: a selected market's road reach (MARKET-1), an
 * expansion draft's fields to be taken in, and — once proclaimed — the fields still to turn while zones are painted.
 * (Kept out of renderer.ts, which stays under its line ceiling.)
 */
export function drawTownPlanOverlays(context: CanvasRenderingContext2D, input: Readonly<{ state: GameState; zoom: number; selectedBuildingId: string | null;
  palisadeDraft: PalisadeDraftState | null; zoneBrush: ZoneBrushView | null }>): void {
  if (input.zoneBrush !== null) drawZoneBrushOverlay(context, input.state, input.zoneBrush, input.zoom);
  const market = input.selectedBuildingId === null ? null : marketReachView(input.state, input.selectedBuildingId);
  if (market !== null) drawMarketReach(context, input.state, market, input.zoom);
  if (input.palisadeDraft?.purpose === "expand") {
    const preview = cachedExpansionPreview(input.state, input.palisadeDraft.candidate?.path ?? input.palisadeDraft.path);
    if (preview.ok) drawPastureCells(context, input.state, preview.enclosedArableCells, input.zoom);
  }
  const pasture = input.zoneBrush !== null ? pendingPastureWarning(input.state) : null;
  if (pasture !== null) drawPastureCells(context, input.state, pasture.cells, input.zoom);
}

/**
 * UX-0b2 WALL-2 (WX-4): the fields an expansion takes in, which turn to pasture a season on — tinted in the warning
 * colour, cell by cell, while the expansion is drafted and, once proclaimed, while zones are painted (the remedy is
 * to erase them first).
 */
export function drawPastureCells(context: CanvasRenderingContext2D, state: Pick<GameState, "width">, cells: readonly number[], zoom: number): void {
  if (cells.length === 0) return;
  context.save();
  context.beginPath();
  for (const cell of cells) {
    const tx = cell % state.width; const ty = Math.floor(cell / state.width);
    const corners = [[tx - .5, ty - .5], [tx + .5, ty - .5], [tx + .5, ty + .5], [tx - .5, ty + .5]] as const;
    corners.forEach(([x, y], index) => { const point = tileToScreen(x, y); if (index === 0) context.moveTo(point.sx, point.sy); else context.lineTo(point.sx, point.sy); });
    context.closePath();
  }
  context.fillStyle = withAlpha(PALETTE.vermilion, 0.3);
  context.fill();
  applyPaletteStroke(context, PALETTE.vermilion, zoom);
  context.lineWidth = 1.5 / zoom;
  context.stroke();
  context.restore();
}
