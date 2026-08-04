import { PALETTE, type PaletteColor } from "../content/palette";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";

const CARGO_COLOR_BY_RESOURCE = {
  wheat: PALETTE.gold,
  bread: PALETTE.earth,
  logs: PALETTE.forest,
  timber: PALETTE.earthDark,
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

  if (walker.kind === "carter") {
    drawCarter(context, footX, footY, zoom);
  } else {
    drawDistributor(context, footX, footY, zoom);
  }
  if (walker.cargo !== null) {
    drawCargo(context, footX, footY, cargoColor(walker.cargo.resource), zoom);
  }
}

function drawCarter(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  zoom: number,
): void {
  context.fillStyle = PALETTE.earthDark;
  context.fillRect(
    snapToPixel(footX - TILE_W * 0.11),
    snapToPixel(footY - TILE_H * 0.42),
    snapToPixel(TILE_W * 0.22),
    snapToPixel(TILE_H * 0.18),
  );
  applyInkOutline(context, zoom);
  context.strokeRect(
    snapToPixel(footX - TILE_W * 0.11),
    snapToPixel(footY - TILE_H * 0.42),
    snapToPixel(TILE_W * 0.22),
    snapToPixel(TILE_H * 0.18),
  );
  context.fillStyle = PALETTE.inkLight;
  context.fillRect(snapToPixel(footX - 7), snapToPixel(footY - 8), 5, 5);
  context.fillRect(snapToPixel(footX + 2), snapToPixel(footY - 8), 5, 5);
}

function drawDistributor(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  zoom: number,
): void {
  context.fillStyle = PALETTE.sageDark;
  context.beginPath();
  context.moveTo(footX, snapToPixel(footY - TILE_H * 0.48));
  context.lineTo(snapToPixel(footX + TILE_W * 0.08), snapToPixel(footY - TILE_H * 0.22));
  context.lineTo(footX, snapToPixel(footY - TILE_H * 0.06));
  context.lineTo(snapToPixel(footX - TILE_W * 0.08), snapToPixel(footY - TILE_H * 0.22));
  context.closePath();
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawCargo(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  color: PaletteColor,
  zoom: number,
): void {
  context.fillStyle = color;
  context.fillRect(snapToPixel(footX - 4), snapToPixel(footY - TILE_H * 0.72), 8, 8);
  applyInkOutline(context, zoom);
  context.strokeRect(snapToPixel(footX - 4), snapToPixel(footY - TILE_H * 0.72), 8, 8);
}
