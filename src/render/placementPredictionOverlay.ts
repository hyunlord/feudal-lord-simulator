import type { PlacementPrediction } from '../ui/predictionTypes';
import type { GameState } from '../engine/engine.types';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { PALETTE, SEMANTIC_PALETTE } from '../content/palette';
import { applyPaletteStroke, withAlpha, type PaletteStrokeContext } from './style';
import { TILE_H, TILE_W, tileToScreen } from './iso';

type PredictionDrawingContext = PaletteStrokeContext & Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'closePath' | 'ellipse' | 'moveTo' | 'lineTo' |
  'fillStyle' | 'fill' | 'stroke' | 'setLineDash'>;

export function drawPlacementPrediction(context: PredictionDrawingContext, state: GameState,
  prediction: PlacementPrediction, zoom: number): void {
  context.save();
  if (prediction.range !== null) {
    const center = tileToScreen(prediction.range.center.tx, prediction.range.center.ty);
    const radius = prediction.range.radius;
    context.beginPath();
    context.ellipse(center.sx, center.sy, radius * TILE_W / Math.SQRT2, radius * TILE_H / Math.SQRT2, 0, 0, Math.PI * 2);
    context.fillStyle = withAlpha(SEMANTIC_PALETTE.sage, 0.16);
    context.fill();
    applyPaletteStroke(context, PALETTE.gold, zoom);
    context.lineWidth = 3 / zoom;
    context.stroke();
    context.setLineDash([]);
  }
  const highlighted = new Set(prediction.houseIds);
  for (const building of state.buildings) {
    if (!highlighted.has(building.id)) continue;
    const size = buildingFootprint(building);
    const corners = [[building.tx - .5, building.ty - .5], [building.tx + size.width - .5, building.ty - .5],
      [building.tx + size.width - .5, building.ty + size.height - .5], [building.tx - .5, building.ty + size.height - .5]] as const;
    context.beginPath();
    corners.forEach(([tx, ty], index) => {
      const point = tileToScreen(tx, ty);
      if (index === 0) context.moveTo(point.sx, point.sy); else context.lineTo(point.sx, point.sy);
    });
    context.closePath();
    context.fillStyle = withAlpha(SEMANTIC_PALETTE.sage, 0.28);
    context.fill();
    applyPaletteStroke(context, PALETTE.gold, zoom);
    context.lineWidth = 3 / zoom;
    context.stroke();
  }
  for (const segment of prediction.roadSegments) {
    const center = tileToScreen(segment.tile.tx, segment.tile.ty);
    applyPaletteStroke(context, segment.kind === 'bridge' ? PALETTE.ultramarine : PALETTE.ink, zoom);
    context.beginPath();
    if (segment.kind === 'bridge') {
      for (const offset of [-6, 0, 6]) {
        context.moveTo(center.sx - 12, center.sy + offset - 4);
        context.lineTo(center.sx + 12, center.sy + offset + 4);
      }
    } else {
      context.moveTo(center.sx - 3, center.sy);
      context.lineTo(center.sx + 3, center.sy);
    }
    context.stroke();
  }
  context.restore();
}
