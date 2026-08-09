import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import { applyInkOutline, applyPaletteStroke, snapToPixel } from "./style";
import type { WalkerPresentation, WalkerPresentationDirection, WalkerPresentationRole } from "./walkerPresentation";

export type ProceduralWalkerInput = {
  readonly footX: number;
  readonly footY: number;
  readonly scale: number;
  readonly zoom: number;
  readonly presentation: WalkerPresentation;
};

const TORSO_COLOR_BY_ROLE = {
  builder: PALETTE.gold,
  farmer: SEMANTIC_PALETTE.sage,
  logger: SEMANTIC_PALETTE.forest,
  carter: SEMANTIC_PALETTE.earth,
} as const satisfies Record<WalkerPresentationRole, PaletteColor>;

const ACCENT_COLOR_BY_ROLE = {
  builder: SEMANTIC_PALETTE.stoneDark,
  farmer: PALETTE.gold,
  logger: SEMANTIC_PALETTE.earthDark,
  carter: SEMANTIC_PALETTE.forest,
} as const satisfies Record<WalkerPresentationRole, PaletteColor>;

export function drawProceduralWalkerSprite(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  drawLegs(context, input);
  drawTorso(context, input);
  drawArms(context, input);
  drawHead(context, input);
  drawRoleAccent(context, input);
}

function drawLegs(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  const stride = strideForFrame(input.presentation.gaitFrame) * input.scale;
  const sway = facingSway(input.presentation.direction) * input.scale;
  applyPaletteStroke(context, PALETTE.ink, input.zoom);
  context.beginPath();
  context.moveTo(input.footX - 2 * input.scale, input.footY - 8 * input.scale);
  context.lineTo(input.footX - 4 * input.scale - stride + sway, input.footY - 1 * input.scale);
  context.moveTo(input.footX + 2 * input.scale, input.footY - 8 * input.scale);
  context.lineTo(input.footX + 4 * input.scale + stride + sway, input.footY - 1 * input.scale);
  context.stroke();
}

function drawTorso(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  const torso = {
    x: snapToPixel(input.footX - 4 * input.scale),
    y: snapToPixel(input.footY - 21 * input.scale),
    width: snapToPixel(8 * input.scale),
    height: snapToPixel(14 * input.scale),
  };
  context.fillStyle = TORSO_COLOR_BY_ROLE[input.presentation.role];
  context.fillRect(torso.x, torso.y, torso.width, torso.height);
  applyInkOutline(context, input.zoom);
  context.strokeRect(torso.x, torso.y, torso.width, torso.height);
}

function drawArms(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  const stride = strideForFrame(input.presentation.gaitFrame) * input.scale;
  const sway = facingSway(input.presentation.direction) * input.scale;
  applyPaletteStroke(context, ACCENT_COLOR_BY_ROLE[input.presentation.role], input.zoom);
  context.beginPath();
  context.moveTo(input.footX - 5 * input.scale, input.footY - 18 * input.scale);
  context.lineTo(input.footX - 8 * input.scale + stride + sway, input.footY - 11 * input.scale);
  context.moveTo(input.footX + 5 * input.scale, input.footY - 18 * input.scale);
  context.lineTo(input.footX + 8 * input.scale - stride + sway, input.footY - 11 * input.scale);
  context.stroke();
}

function drawHead(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  const offset = headOffset(input.presentation.direction);
  context.fillStyle = SEMANTIC_PALETTE.parchmentDark;
  context.beginPath();
  context.arc(
    input.footX + offset.x * input.scale,
    input.footY - 28 * input.scale + offset.y * input.scale,
    4 * input.scale,
    0,
    Math.PI * 2,
  );
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
}

function drawRoleAccent(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  switch (input.presentation.role) {
    case "builder":
      drawBuilderAccent(context, input);
      return;
    case "farmer":
      drawFarmerAccent(context, input);
      return;
    case "logger":
      drawLoggerAccent(context, input);
      return;
    case "carter":
      drawCarterAccent(context, input);
      return;
    default:
      return assertNever(input.presentation.role);
  }
}

function drawBuilderAccent(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  context.fillStyle = ACCENT_COLOR_BY_ROLE.builder;
  context.fillRect(
    snapToPixel(input.footX - 7 * input.scale),
    snapToPixel(input.footY - 15 * input.scale),
    snapToPixel(14 * input.scale),
    snapToPixel(3 * input.scale),
  );
}

function drawFarmerAccent(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  context.fillStyle = ACCENT_COLOR_BY_ROLE.farmer;
  context.beginPath();
  context.ellipse(
    input.footX,
    input.footY - 14 * input.scale,
    5 * input.scale,
    3 * input.scale,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
}

function drawLoggerAccent(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  context.fillStyle = ACCENT_COLOR_BY_ROLE.logger;
  context.fillRect(
    snapToPixel(input.footX - 7 * input.scale),
    snapToPixel(input.footY - 18 * input.scale),
    snapToPixel(14 * input.scale),
    snapToPixel(3 * input.scale),
  );
  context.fillRect(
    snapToPixel(input.footX - 5 * input.scale),
    snapToPixel(input.footY - 13 * input.scale),
    snapToPixel(10 * input.scale),
    snapToPixel(2 * input.scale),
  );
}

function drawCarterAccent(
  context: CanvasRenderingContext2D,
  input: ProceduralWalkerInput,
): void {
  context.fillStyle = ACCENT_COLOR_BY_ROLE.carter;
  context.fillRect(
    snapToPixel(input.footX - 6 * input.scale),
    snapToPixel(input.footY - 13 * input.scale),
    snapToPixel(12 * input.scale),
    snapToPixel(4 * input.scale),
  );
  applyPaletteStroke(context, PALETTE.ink, input.zoom);
  context.beginPath();
  context.arc(
    input.footX - 4 * input.scale,
    input.footY - 8 * input.scale,
    2 * input.scale,
    0,
    Math.PI * 2,
  );
  context.arc(
    input.footX + 4 * input.scale,
    input.footY - 8 * input.scale,
    2 * input.scale,
    0,
    Math.PI * 2,
  );
  context.stroke();
}

function strideForFrame(frame: WalkerPresentation["gaitFrame"]): number {
  switch (frame) {
    case 0:
      return -2;
    case 1:
      return 2;
    default:
      return assertNever(frame);
  }
}

function facingSway(direction: WalkerPresentationDirection): number {
  switch (direction) {
    case "NE":
      return 1;
    case "SE":
      return 2;
    case "SW":
      return -2;
    case "NW":
      return -1;
    default:
      return assertNever(direction);
  }
}

function headOffset(
  direction: WalkerPresentationDirection,
): { readonly x: number; readonly y: number } {
  switch (direction) {
    case "NE":
      return { x: 1, y: -1 };
    case "SE":
      return { x: 2, y: 1 };
    case "SW":
      return { x: -2, y: 1 };
    case "NW":
      return { x: -1, y: -1 };
    default:
      return assertNever(direction);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled procedural walker variant: ${JSON.stringify(value)}`);
}
