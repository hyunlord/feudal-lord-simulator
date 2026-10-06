import type { ViewportSize } from './renderVisibility';

export const devicePixelRatioFor = (
  context: CanvasRenderingContext2D,
  viewport: ViewportSize,
): number => {
  if (viewport.width <= 0) return 1;
  const dpr = context.canvas.width / viewport.width;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
};
