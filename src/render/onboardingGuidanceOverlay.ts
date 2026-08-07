import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { OnboardingGuidanceTarget } from "../ui/onboardingWorldGuidance";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, applyPaletteStroke, snapToPixel, withAlpha } from "./style";

export type OnboardingGuidanceOverlayInput = {
  readonly targets: readonly OnboardingGuidanceTarget[];
  readonly zoom: number;
  readonly safeRightInset?: number;
};

type PlaqueBounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export function drawOnboardingGuidanceOverlay(
  context: CanvasRenderingContext2D,
  input: OnboardingGuidanceOverlayInput,
): void {
  if (input.targets.length === 0) return;

  context.save();
  for (const target of input.targets) {
    drawTargetDiamond(context, target, input.zoom);
    drawTargetPlaque(context, target, input);
  }
  context.restore();
}

function drawTargetDiamond(
  context: CanvasRenderingContext2D,
  target: OnboardingGuidanceTarget,
  zoom: number,
): void {
  const center = tileToScreen(target.origin.tx, target.origin.ty);
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.parchment, 0.72);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
  context.fill();
  applyPaletteStroke(context, PALETTE.gold, zoom);
  context.stroke();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawTargetPlaque(
  context: CanvasRenderingContext2D,
  target: OnboardingGuidanceTarget,
  input: OnboardingGuidanceOverlayInput,
): void {
  const { zoom } = input;
  const center = tileToScreen(target.origin.tx, target.origin.ty);
  const fontSize = 14 / zoom;
  const padding = 5 / zoom;
  const labelX = snapToPixel(center.sx + TILE_W / 2);
  const labelY = snapToPixel(center.sy - TILE_H / 2 - 6 / zoom);
  context.font = `${fontSize}px Georgia, serif`;

  const plaqueWidth = snapToPixel(context.measureText(target.label).width + padding * 2);
  const plaqueHeight = snapToPixel(fontSize + padding * 2);
  const bounds = plaqueBounds(context, input.safeRightInset);
  const usableWidth = Math.max(0, bounds.right - bounds.left);
  const usableHeight = Math.max(0, bounds.bottom - bounds.top);
  if (plaqueWidth > usableWidth || plaqueHeight > usableHeight) return;

  const rawPlaqueX = labelX - padding;
  const rawPlaqueY = labelY - fontSize - padding;
  const plaqueX = snapToPixel(
    Math.min(Math.max(bounds.left, rawPlaqueX), Math.max(bounds.left, bounds.right - plaqueWidth)),
  );
  const plaqueY = snapToPixel(
    Math.min(Math.max(bounds.top, rawPlaqueY), Math.max(bounds.top, bounds.bottom - plaqueHeight)),
  );
  const textX = snapToPixel(plaqueX + padding);
  const textY = snapToPixel(plaqueY + fontSize + padding);

  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  applyInkOutline(context, zoom);
  context.strokeRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  context.fillStyle = SEMANTIC_PALETTE.ink;
  context.fillText(target.label, textX, textY);
}

function plaqueBounds(context: CanvasRenderingContext2D, explicitInset: number | undefined): PlaqueBounds {
  const canvasWidth = context.canvas?.clientWidth ?? context.canvas?.width ?? Number.POSITIVE_INFINITY;
  const canvasHeight = context.canvas?.clientHeight ?? context.canvas?.height ?? Number.POSITIVE_INFINITY;
  const safeScreenRight = Math.max(0, canvasWidth - safeRightInset(context, explicitInset));
  const transform = context.getTransform?.() ?? null;
  if (transform === null || transform.a === 0 || transform.d === 0 || transform.b !== 0 || transform.c !== 0) {
    return { left: 0, top: 0, right: safeScreenRight, bottom: canvasHeight };
  }

  return {
    left: (0 - transform.e) / transform.a,
    top: (0 - transform.f) / transform.d,
    right: (safeScreenRight - transform.e) / transform.a,
    bottom: (canvasHeight - transform.f) / transform.d,
  };
}

function safeRightInset(context: CanvasRenderingContext2D, explicitInset: number | undefined): number {
  if (explicitInset !== undefined) return Math.max(0, explicitInset);

  const canvas = context.canvas;
  if (canvas === undefined) return 0;

  const rail = canvas.parentElement?.querySelector(".right-info-rail") ?? null;
  if (rail === null) return 0;

  const canvasBounds = canvas.getBoundingClientRect();
  const railBounds = rail.getBoundingClientRect();
  const overlapsCanvas =
    railBounds.right > canvasBounds.left &&
    railBounds.left < canvasBounds.right &&
    railBounds.bottom > canvasBounds.top &&
    railBounds.top < canvasBounds.bottom;
  if (!overlapsCanvas) return 0;

  return Math.max(0, canvasBounds.right - Math.max(canvasBounds.left, railBounds.left));
}
