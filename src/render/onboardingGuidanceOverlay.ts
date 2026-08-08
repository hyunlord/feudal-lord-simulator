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
    if (target.region === undefined) drawTargetDiamond(context, target.origin, input.zoom);
    else drawTargetRegion(context, target.region);
    drawTargetPlaque(context, target, input);
  }
  context.restore();
}

function drawTargetDiamond(
  context: CanvasRenderingContext2D,
  origin: OnboardingGuidanceTarget["origin"],
  zoom: number,
): void {
  const center = tileToScreen(origin.tx, origin.ty);
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.parchment, 0.72);
  context.beginPath();
  appendTargetDiamond(context, center);
  context.fill();
  applyPaletteStroke(context, PALETTE.gold, zoom);
  context.stroke();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawTargetRegion(
  context: CanvasRenderingContext2D,
  origins: readonly OnboardingGuidanceTarget["origin"][],
): void {
  if (origins.length === 0) return;
  context.fillStyle = withAlpha(PALETTE.gold, 0.12);
  context.beginPath();
  for (const origin of origins) appendTargetDiamond(context, tileToScreen(origin.tx, origin.ty));
  context.fill();
}

function appendTargetDiamond(
  context: CanvasRenderingContext2D,
  center: { readonly sx: number; readonly sy: number },
): void {
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
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
  const canvas = context.canvas;
  const canvasWidth = canvas?.clientWidth ?? canvas?.width ?? Number.POSITIVE_INFINITY;
  const canvasHeight = canvas?.clientHeight ?? canvas?.height ?? Number.POSITIVE_INFINITY;
  const safeScreenRight = Math.max(0, canvasWidth - safeRightInset(context, explicitInset));
  const safeScreenBottom = safeBottomLimit(context, canvasHeight);
  const transform = context.getTransform?.() ?? null;
  if (transform === null || transform.a === 0 || transform.d === 0 || transform.b !== 0 || transform.c !== 0) {
    return { left: 0, top: 0, right: safeScreenRight, bottom: safeScreenBottom };
  }

  const xPixelScale = canvasPixelScale(canvasWidth, canvas?.width);
  const yPixelScale = canvasPixelScale(canvasHeight, canvas?.height);
  const safeCanvasRight = safeScreenRight * xPixelScale;
  const safeCanvasBottom = safeScreenBottom * yPixelScale;

  return {
    left: (0 - transform.e) / transform.a,
    top: (0 - transform.f) / transform.d,
    right: (safeCanvasRight - transform.e) / transform.a,
    bottom: (safeCanvasBottom - transform.f) / transform.d,
  };
}

function canvasPixelScale(cssSize: number, backingSize: number | undefined): number {
  if (!Number.isFinite(cssSize) || cssSize <= 0 || backingSize === undefined || backingSize <= 0) return 1;
  return backingSize / cssSize;
}

function safeRightInset(context: CanvasRenderingContext2D, explicitInset: number | undefined): number {
  if (explicitInset !== undefined) return Math.max(0, explicitInset);

  const canvas = context.canvas;
  if (canvas === undefined) return 0;

  const rail = canvasOverlayElement(canvas, ".right-info-rail");
  if (rail === null) return 0;

  const canvasBounds = canvas.getBoundingClientRect();
  const railBounds = rail.getBoundingClientRect();
  if (!rectsOverlap(canvasBounds, railBounds)) return 0;

  return Math.max(0, canvasBounds.right - Math.max(canvasBounds.left, railBounds.left));
}

function safeBottomLimit(context: CanvasRenderingContext2D, fallback: number): number {
  const canvas = context.canvas;
  if (canvas === undefined) return fallback;

  const courtConsole = canvasOverlayElement(canvas, ".court-console");
  if (courtConsole === null) return fallback;

  const canvasBounds = canvas.getBoundingClientRect();
  const consoleBounds = courtConsole.getBoundingClientRect();
  if (!rectsOverlap(canvasBounds, consoleBounds)) return fallback;

  return Math.max(0, Math.min(fallback, consoleBounds.top - canvasBounds.top));
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return b.right > a.left && b.left < a.right && b.bottom > a.top && b.top < a.bottom;
}

function canvasOverlayElement(canvas: HTMLCanvasElement, selector: string): Element | null {
  return canvas.parentElement?.querySelector(selector) ?? canvas.closest?.(".app-shell")?.querySelector(selector) ?? null;
}
