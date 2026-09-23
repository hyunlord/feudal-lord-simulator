import { applyPaletteStroke } from './style';
import type { GameState } from '../engine/engine.types';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { SEMANTIC_PALETTE } from '../content/palette';
import { CAUSE_REGISTRY } from '../ui/causeRegistry';
import { buildingCauseSnapshot } from '../ui/houseProgressModel';
import { tileToScreen } from './iso';
import { groupCauseMarkers, type CauseMarker } from './causeMarkerLayout';

const GLYPH_SHAPES: Readonly<Record<keyof typeof CAUSE_REGISTRY, readonly (readonly [number, number])[]>> = {
  water: [[0,-11],[8,1],[6,8],[0,11],[-6,8],[-8,1]],
  bread: [[-10,-6],[-5,-10],[5,-10],[10,-6],[10,8],[-10,8]],
  delivery: [[-11,-7],[3,-7],[3,-11],[12,0],[3,11],[3,7],[-11,7]],
  market: [[-11,-8],[0,-12],[11,-8],[9,10],[-9,10]],
  church: [[0,-13],[11,-3],[11,11],[-11,11],[-11,-3]],
  wall: [[-11,11],[-11,-11],[-5,-11],[-5,-5],[0,-5],[0,-11],[6,-11],[6,-5],[11,-5],[11,11]],
  workers: [[0,-12],[10,-5],[8,10],[-8,10],[-10,-5]],
  construction_access: [[-12,-9],[12,-9],[12,9],[-12,9]],
};

export function causeMarkersForState(state: GameState, zoom: number): readonly CauseMarker[] {
  const snapshot = buildingCauseSnapshot(state);
  return groupCauseMarkers([...state.buildings].sort((a,b) => a.id.localeCompare(b.id)).flatMap(building => {
    const cause = snapshot.get(building.id);
    if (cause === undefined || cause.status === 'normal') return [];
    const size = buildingFootprint(building);
    const anchor = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
    return [{ x: anchor.sx + 16, y: anchor.sy - 42, buildingIds: [building.id],
      causeId: cause.blocker?.causeId ?? null, risk: cause.status === 'risk',
      ...(cause.status === 'ready' && 'requiredTicks' in cause && cause.requiredTicks !== null
        ? { progressFraction: cause.progressTicks / cause.requiredTicks } : {}) }];
  }), zoom);
}

export function causeBuildingAlpha(state: GameState, id: string, problemOnly: boolean): number {
  const status = buildingCauseSnapshot(state).get(id)?.status;
  return problemOnly && status !== 'blocked' && status !== 'risk' ? 0.4 : 1;
}

export function drawCauseMap(context: CanvasRenderingContext2D, state: GameState, zoom: number, problemOnly: boolean): void {
  const snapshot = buildingCauseSnapshot(state);
  context.save();
  if (problemOnly) for (const building of state.buildings) {
    const cause = snapshot.get(building.id);
    if (cause?.blocker === undefined || cause.blocker === null) continue;
    const size = buildingFootprint(building);
    const corners = [[building.tx - .5, building.ty - .5], [building.tx + size.width - .5, building.ty - .5],
      [building.tx + size.width - .5, building.ty + size.height - .5], [building.tx - .5, building.ty + size.height - .5]] as const;
    context.beginPath();
    corners.forEach(([tx, ty], index) => { const p = tileToScreen(tx, ty); if (index === 0) context.moveTo(p.sx, p.sy); else context.lineTo(p.sx, p.sy); });
    context.closePath();
    applyPaletteStroke(context, CAUSE_REGISTRY[cause.blocker.causeId].color, zoom / 2);
    context.stroke();
  }
  for (const marker of causeMarkersForState(state, zoom)) {
    context.save();
    context.translate(marker.x, marker.y);
    context.scale(1 / zoom, 1 / zoom);
    const entry = Object.entries(CAUSE_REGISTRY).find(([id]) => id === marker.causeId)?.[1];
    if (entry === undefined) {
      applyPaletteStroke(context, SEMANTIC_PALETTE.sage, 0.5);
      context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.stroke();
      if (marker.progressFraction !== undefined) {
        applyPaletteStroke(context, SEMANTIC_PALETTE.gold, 0.33);
        context.beginPath(); context.arc(0, 0, 8, -Math.PI / 2,
          -Math.PI / 2 + Math.max(0, Math.min(1, marker.progressFraction)) * Math.PI * 2); context.stroke();
      }
    } else {
      const points = GLYPH_SHAPES[entry.glyphId];
      context.beginPath();
      points.forEach(([x,y], index) => { if (index === 0) context.moveTo(x,y); else context.lineTo(x,y); });
      context.closePath(); context.fillStyle = SEMANTIC_PALETTE.vellum; context.fill();
      applyPaletteStroke(context, entry.color, 0.5); context.stroke();
      if (marker.risk) { applyPaletteStroke(context, SEMANTIC_PALETTE.vermilion, 0.5); context.strokeRect(-15,-15,30,30); }
      context.fillStyle = SEMANTIC_PALETTE.ink;
      context.font = 'bold 11px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(marker.buildingIds.length > 1 ? String(marker.buildingIds.length) : entry.glyphText, 0, 1);
    }
    context.restore();
  }
  context.restore();
}
