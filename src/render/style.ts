import { PALETTE, type PaletteColor } from "../content/palette";

export interface DiamondShadow {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

export function snapToPixel(value: number): number {
  return Math.round(value);
}

export function shade(color: PaletteColor, multiplier: number): string {
  const red = shadeChannel(color.slice(1, 3), multiplier);
  const green = shadeChannel(color.slice(3, 5), multiplier);
  const blue = shadeChannel(color.slice(5, 7), multiplier);
  return `#${red}${green}${blue}`;
}

export function withAlpha(color: PaletteColor, alpha: number): string {
  const red = parseChannel(color.slice(1, 3));
  const green = parseChannel(color.slice(3, 5));
  const blue = parseChannel(color.slice(5, 7));
  return `rgba(${red}, ${green}, ${blue}, ${clampAlpha(alpha)})`;
}

export function applyInkOutline(
  context: Pick<
    CanvasRenderingContext2D,
    "lineCap" | "lineJoin" | "lineWidth" | "strokeStyle"
  >,
  zoom: number,
): void {
  context.strokeStyle = PALETTE.ink;
  context.lineWidth = 1 / zoom;
  context.lineJoin = "round";
  context.lineCap = "round";
}

export function applyPaletteStroke(
  context: Pick<CanvasRenderingContext2D, "lineCap" | "lineJoin" | "lineWidth" | "strokeStyle">,
  color: PaletteColor,
  zoom: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = 1 / zoom;
  context.lineJoin = "round";
  context.lineCap = "round";
}

export function drawFlatDiamondShadow(
  context: Pick<
    CanvasRenderingContext2D,
    | "beginPath"
    | "closePath"
    | "fill"
    | "fillStyle"
    | "lineTo"
    | "moveTo"
  >,
  shadow: DiamondShadow,
): void {
  context.fillStyle = withAlpha(PALETTE.ink, 0.18);
  context.beginPath();
  context.moveTo(
    snapToPixel(shadow.centerX),
    snapToPixel(shadow.centerY - shadow.radiusY),
  );
  context.lineTo(
    snapToPixel(shadow.centerX + shadow.radiusX),
    snapToPixel(shadow.centerY),
  );
  context.lineTo(
    snapToPixel(shadow.centerX),
    snapToPixel(shadow.centerY + shadow.radiusY),
  );
  context.lineTo(
    snapToPixel(shadow.centerX - shadow.radiusX),
    snapToPixel(shadow.centerY),
  );
  context.closePath();
  context.fill();
}

function shadeChannel(hexChannel: string, multiplier: number): string {
  const value = parseChannel(hexChannel);
  const shaded = Math.max(0, Math.min(255, Math.round(value * multiplier)));
  return shaded.toString(16).toUpperCase().padStart(2, "0");
}

function parseChannel(hexChannel: string): number {
  return Number.parseInt(hexChannel, 16);
}

function clampAlpha(alpha: number): number {
  if (Number.isNaN(alpha)) {
    return 0;
  }
  return Math.max(0, Math.min(1, alpha));
}
