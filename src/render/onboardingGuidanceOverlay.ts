import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { OnboardingGuidanceTarget } from "../ui/onboardingWorldGuidance";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, applyPaletteStroke, snapToPixel, withAlpha } from "./style";

export type OnboardingGuidanceOverlayInput = {
  readonly targets: readonly OnboardingGuidanceTarget[];
  readonly zoom: number;
};

export function drawOnboardingGuidanceOverlay(
  context: CanvasRenderingContext2D,
  input: OnboardingGuidanceOverlayInput,
): void {
  if (input.targets.length === 0) return;

  context.save();
  for (const target of input.targets) {
    drawTargetDiamond(context, target, input.zoom);
    drawTargetPlaque(context, target, input.zoom);
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
  zoom: number,
): void {
  const center = tileToScreen(target.origin.tx, target.origin.ty);
  const fontSize = 14 / zoom;
  const padding = 5 / zoom;
  const labelX = snapToPixel(center.sx + TILE_W / 2);
  const labelY = snapToPixel(center.sy - TILE_H / 2 - 6 / zoom);
  context.font = `${fontSize}px Georgia, serif`;

  const plaqueX = snapToPixel(labelX - padding);
  const plaqueY = snapToPixel(labelY - fontSize - padding);
  const plaqueWidth = snapToPixel(context.measureText(target.label).width + padding * 2);
  const plaqueHeight = snapToPixel(fontSize + padding * 2);

  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  applyInkOutline(context, zoom);
  context.strokeRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  context.fillStyle = SEMANTIC_PALETTE.ink;
  context.fillText(target.label, labelX, labelY);
}
