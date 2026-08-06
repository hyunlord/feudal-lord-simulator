import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";

export interface DiamondShadow {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

export interface GroundingShadow {
  readonly centerX: number;
  readonly centerY: number;
  readonly height: number;
  readonly scale?: number;
  readonly baseRadiusX: number;
  readonly baseRadiusY: number;
}

export type PaletteStrokeContext = Pick<
  CanvasRenderingContext2D,
  "lineCap" | "lineJoin" | "lineWidth" | "strokeStyle"
>;

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
  context: PaletteStrokeContext,
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

export function drawGroundingShadow(
  context: Pick<
    CanvasRenderingContext2D,
    | "beginPath"
    | "ellipse"
    | "fill"
    | "fillStyle"
  >,
  shadow: GroundingShadow,
): void {
  const scale = shadow.scale ?? 1;
  const height = shadow.height * scale;
  drawWarmEllipse(context, {
    centerX: shadow.centerX - height * 0.04,
    centerY: shadow.centerY + height * 0.03,
    radiusX: shadow.baseRadiusX + height * 0.12,
    radiusY: shadow.baseRadiusY + height * 0.035,
    color: withAlpha(SEMANTIC_PALETTE.earth, 0.16),
  });
  drawWarmEllipse(context, {
    centerX: shadow.centerX,
    centerY: shadow.centerY,
    radiusX: shadow.baseRadiusX + height * 0.035,
    radiusY: shadow.baseRadiusY + height * 0.012,
    color: withAlpha(SEMANTIC_PALETTE.earthDark, 0.32),
  });
  drawWarmEllipse(context, {
    centerX: shadow.centerX,
    centerY: shadow.centerY,
    radiusX: shadow.baseRadiusX * 0.72,
    radiusY: Math.max(1.5, shadow.baseRadiusY * 0.34),
    color: withAlpha(SEMANTIC_PALETTE.ink, 0.18),
  });
}

function drawWarmEllipse(
  context: Pick<
    CanvasRenderingContext2D,
    | "beginPath"
    | "ellipse"
    | "fill"
    | "fillStyle"
  >,
  shadow: DiamondShadow & { readonly color: string },
): void {
  context.fillStyle = shadow.color;
  context.beginPath();
  context.ellipse(
    snapToPixel(shadow.centerX),
    snapToPixel(shadow.centerY),
    snapToPixel(shadow.radiusX),
    snapToPixel(shadow.radiusY),
    0,
    0,
    Math.PI * 2,
  );
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
