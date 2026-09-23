import { CAUSE_REGISTRY } from '../ui/causeRegistry';
import { constructionAccessModel } from '../ui/constructionAccessModel';
import type { GameState } from '../engine/engine.types';
import { tileToScreen } from './iso';
import { TILE_H, TILE_W } from './iso';
import { PALETTE, SEMANTIC_PALETTE } from '../content/palette';
import { applyPaletteStroke, withAlpha } from './style';

export function drawConstructionAccessOverlay(
  context: CanvasRenderingContext2D,
  state: GameState,
  siteId: string,
  zoom = 1,
): void {
  const site = state.constructionSites.find(candidate => candidate.id === siteId);
  if (site === undefined) return;
  const model = constructionAccessModel(state, site);
  if (model.accessTiles.length === 0) return;
  const color = CAUSE_REGISTRY.construction_access.color;
  context.save();
  applyPaletteStroke(context, color, zoom);
  context.fillStyle = color;
  context.setLineDash([5, 5]);
  const path = model.suggestedRoad;
  if (path.length > 1) {
    const first = path[0];
    if (first !== undefined) {
      const start = tileToScreen(first.tx + 0.5, first.ty + 0.5);
      context.beginPath();
      context.moveTo(start.sx, start.sy);
      for (const tile of path.slice(1)) {
        const point = tileToScreen(tile.tx + 0.5, tile.ty + 0.5);
        context.lineTo(point.sx, point.sy);
      }
      context.stroke();
    }
  }
  context.setLineDash([]);
  for (const tile of model.missingRoadTiles) {
    const center = tileToScreen(tile.tx, tile.ty);
    context.beginPath();
    context.moveTo(center.sx, center.sy - TILE_H / 2);
    context.lineTo(center.sx + TILE_W / 2, center.sy);
    context.lineTo(center.sx, center.sy + TILE_H / 2);
    context.lineTo(center.sx - TILE_W / 2, center.sy);
    context.closePath();
    context.fillStyle = withAlpha(SEMANTIC_PALETTE.sage, 0.45);
    context.fill();
    applyPaletteStroke(context, PALETTE.gold, zoom);
    context.lineWidth = 3 / zoom;
    context.stroke();
  }
  context.fillStyle = color;
  applyPaletteStroke(context, color, zoom);
  for (const tile of model.accessTiles) {
    const point = tileToScreen(tile.tx + 0.5, tile.ty + 0.5);
    context.globalAlpha = 0.3;
    context.beginPath();
    context.ellipse(point.sx, point.sy, 15, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.stroke();
  }
  context.restore();
}
