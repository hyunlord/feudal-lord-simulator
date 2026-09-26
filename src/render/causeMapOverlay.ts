import { applyPaletteStroke } from './style';
import type { GameState } from '../engine/engine.types';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { SEMANTIC_PALETTE } from '../content/palette';
import { CAUSE_REGISTRY, causeMarkerSeverity, type CauseMarkerSeverity } from '../ui/causeRegistry';
import { buildingCauseSnapshot } from '../ui/houseProgressModel';
import { tileToScreen } from './iso';
import { groupCauseMarkers, type CauseMarker } from './causeMarkerLayout';
import { CAUSE_ICON, drawUiIcon } from '../ui/uiArt';

/** The shape carries the severity (UX1): ▲ act now, ◆ caution. The cause stays in the colour and the glyph. */
const SEVERITY_SHAPES: Readonly<Record<CauseMarkerSeverity, { readonly points: readonly (readonly [number, number])[]; readonly textY: number }>> = {
  block: { points: [[0,-15],[15,11],[-15,11]], textY: 4 },
  warn: { points: [[0,-15],[15,0],[0,15],[-15,0]], textY: 1 },
};

/**
 * One marker per building, for its first cause and only when that cause needs the player (causeMarkerSeverity);
 * a house waiting out its promotion keeps its progress ring. Zoomed out, groupCauseMarkers clusters them by cell.
 */
export function causeMarkersForState(state: GameState, zoom: number): readonly CauseMarker[] {
  const snapshot = buildingCauseSnapshot(state);
  return groupCauseMarkers([...state.buildings].sort((a,b) => a.id.localeCompare(b.id)).flatMap(building => {
    const cause = snapshot.get(building.id);
    if (cause === undefined) return [];
    const severity = causeMarkerSeverity(cause);
    if (severity === null && cause.status !== 'ready') return [];
    const size = buildingFootprint(building);
    const anchor = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
    return [{ x: anchor.sx + 16, y: anchor.sy - 42, buildingIds: [building.id], tile: { tx: building.tx, ty: building.ty },
      causeId: severity === null ? null : cause.blocker?.causeId ?? null, severity,
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
    if (cause?.blocker === undefined || cause.blocker === null || causeMarkerSeverity(cause) === null) continue;
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
    if (entry === undefined || marker.severity === null) {
      applyPaletteStroke(context, SEMANTIC_PALETTE.sage, 0.5);
      context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.stroke();
      if (marker.progressFraction !== undefined) {
        applyPaletteStroke(context, SEMANTIC_PALETTE.gold, 0.33);
        context.beginPath(); context.arc(0, 0, 8, -Math.PI / 2,
          -Math.PI / 2 + Math.max(0, Math.min(1, marker.progressFraction)) * Math.PI * 2); context.stroke();
      }
    } else if (drawPaintedMarker(context, marker, marker.causeId)) {
      // UX-2: the painted marker (triangle act now / diamond caution) with the cause icon beside it.
    } else {
      const shape = SEVERITY_SHAPES[marker.severity];
      context.beginPath();
      shape.points.forEach(([x,y], index) => { if (index === 0) context.moveTo(x,y); else context.lineTo(x,y); });
      context.closePath(); context.fillStyle = SEMANTIC_PALETTE.vellum; context.fill();
      applyPaletteStroke(context, entry.color, 0.5); context.stroke();
      context.fillStyle = SEMANTIC_PALETTE.ink;
      context.font = 'bold 12px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(marker.buildingIds.length > 1 ? String(marker.buildingIds.length) : entry.glyphText, 0, shape.textY);
    }
    context.restore();
  }
  context.restore();
}

/** UX-2 painted marker: the severity sprite (its pointer on the anchor), the cause icon to its right, a cluster's count
 * on a vellum chip. False until the sheets have loaded (the vector shape draws meanwhile). */
function drawPaintedMarker(context: CanvasRenderingContext2D, marker: CauseMarker, causeId: string | null): boolean {
  if (marker.severity === null) return false;
  if (!drawUiIcon(context, 'marker', marker.severity === 'block' ? 'urgent' : 'warn', 0, -4, 34)) return false;
  const causeIcon = causeId === null ? undefined : CAUSE_ICON[causeId];
  if (marker.buildingIds.length > 1) {
    context.fillStyle = SEMANTIC_PALETTE.vellum;
    context.beginPath(); context.arc(17, -14, 9, 0, Math.PI * 2); context.fill();
    applyPaletteStroke(context, SEMANTIC_PALETTE.ink, 0.5); context.stroke();
    context.fillStyle = SEMANTIC_PALETTE.ink;
    context.font = 'bold 12px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(String(marker.buildingIds.length), 17, -13);
  } else if (causeIcon !== undefined) {
    drawUiIcon(context, 'cause', causeIcon, 22, -6, 22);
  }
  return true;
}
