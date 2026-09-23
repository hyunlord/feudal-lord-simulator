import { PALETTE, SEMANTIC_PALETTE } from '../content/palette';
import { palisadeScreenPath, type PalisadeRenderPath } from './palisadeRenderGeometry';
import { applyPaletteStroke, snapToPixel, type PaletteStrokeContext } from './style';

export type PalisadeRoutePreviewContext = PaletteStrokeContext & Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'setLineDash'
  >;

export function drawPalisadeRoutePreviewOverlay(
  context: PalisadeRoutePreviewContext,
  unreachablePaths: readonly PalisadeRenderPath[],
  zoom: number,
): void {
  for (const path of unreachablePaths) {
    const points = palisadeScreenPath(path);
    const first = points[0];
    if (first === undefined || points.length < 2) continue;

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(snapToPixel(first.x), snapToPixel(first.y));
    for (const point of points.slice(1)) {
      context.lineTo(snapToPixel(point.x), snapToPixel(point.y));
    }
    applyPaletteStroke(context, PALETTE.ink, zoom);
    context.lineWidth = 8 / zoom;
    context.stroke();
    applyPaletteStroke(context, PALETTE.vermilion, zoom);
    context.lineWidth = 5 / zoom;
    context.setLineDash([8 / zoom, 6 / zoom]);
    context.stroke();
    context.setLineDash([]);

    const middleIndex = Math.floor((points.length - 1) / 2);
    const start = points[middleIndex];
    const end = points[middleIndex + 1];
    if (start !== undefined && end !== undefined) {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const half = 5 / zoom;
      context.beginPath();
      context.moveTo(snapToPixel(centerX - half), snapToPixel(centerY - half));
      context.lineTo(snapToPixel(centerX + half), snapToPixel(centerY + half));
      context.moveTo(snapToPixel(centerX - half), snapToPixel(centerY + half));
      context.lineTo(snapToPixel(centerX + half), snapToPixel(centerY - half));
      applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
      context.lineWidth = 3 / zoom;
      context.stroke();
    }
    context.restore();
  }
}
