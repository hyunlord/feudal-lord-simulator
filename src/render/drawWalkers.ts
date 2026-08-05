import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import { TILE_H, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";

const CARGO_COLOR_BY_RESOURCE = {
  wheat: PALETTE.gold,
  bread: SEMANTIC_PALETTE.earth,
  logs: SEMANTIC_PALETTE.forest,
  timber: SEMANTIC_PALETTE.earthDark,
} as const satisfies Record<ResourceType, PaletteColor>;

export function drawWalkers(
  context: CanvasRenderingContext2D,
  state: GameState,
  zoom = 1,
): void {
  for (const walker of [...state.walkers].sort(compareWalkersForRender)) {
    drawWalker(context, walker, zoom);
  }
}

export function cargoColor(resource: ResourceType): PaletteColor {
  return CARGO_COLOR_BY_RESOURCE[resource];
}

export function walkerScaleForZoom(zoom: number): number {
  return zoom < 0.8 ? 0.8 / Math.max(zoom, 0.01) : 1;
}

function compareWalkersForRender(left: Walker, right: Walker): number {
  return (
    left.position.tx + left.position.ty - (right.position.tx + right.position.ty) ||
    left.position.ty - right.position.ty ||
    left.position.tx - right.position.tx ||
    left.id.localeCompare(right.id)
  );
}

function drawWalker(
  context: CanvasRenderingContext2D,
  walker: Walker,
  zoom: number,
): void {
  const center = tileToScreen(walker.position.tx, walker.position.ty);
  const footX = snapToPixel(center.sx);
  const footY = snapToPixel(center.sy + TILE_H * 0.18);
  const scale = walkerScaleForZoom(zoom);

  drawWalkerShadow(context, footX, footY, scale);
  drawBody(context, footX, footY, scale, zoom);
  if (walker.kind === "distributor") drawDistributorMark(context, footX, footY, scale, zoom);
  if (walker.cargo !== null) {
    drawCargo(context, footX, footY, cargoColor(walker.cargo.resource), scale, zoom);
  }
}

function drawWalkerShadow(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
): void {
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  context.beginPath();
  context.ellipse(footX, footY, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  context.fill();
}

function drawBody(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
  zoom: number,
): void {
  context.fillStyle = PALETTE.ink;
  context.beginPath();
  context.arc(footX, snapToPixel(footY - 8 * scale), 2 * scale, 0, Math.PI * 2);
  context.fill();
  context.fillRect(
    snapToPixel(footX - 2 * scale),
    snapToPixel(footY - 7 * scale),
    snapToPixel(4 * scale),
    snapToPixel(7 * scale),
  );
  applyInkOutline(context, zoom);
  context.strokeRect(
    snapToPixel(footX - 2 * scale),
    snapToPixel(footY - 7 * scale),
    snapToPixel(4 * scale),
    snapToPixel(7 * scale),
  );
}

function drawDistributorMark(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
  zoom: number,
): void {
  context.fillStyle = PALETTE.vermilion;
  context.fillRect(
    snapToPixel(footX - 4 * scale),
    snapToPixel(footY - 8 * scale),
    snapToPixel(8 * scale),
    snapToPixel(3 * scale),
  );
  applyInkOutline(context, zoom);
  context.strokeRect(
    snapToPixel(footX - 4 * scale),
    snapToPixel(footY - 8 * scale),
    snapToPixel(8 * scale),
    snapToPixel(3 * scale),
  );
}

function drawCargo(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  color: PaletteColor,
  scale: number,
  zoom: number,
): void {
  const size = 5 * scale;
  const x = snapToPixel(footX - size / 2);
  const y = snapToPixel(footY - 17 * scale);
  context.fillStyle = color;
  context.fillRect(x, y, snapToPixel(size), snapToPixel(size));
  applyInkOutline(context, zoom);
  context.strokeRect(x, y, snapToPixel(size), snapToPixel(size));
}
