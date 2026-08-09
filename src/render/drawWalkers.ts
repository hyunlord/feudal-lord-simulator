import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import { applyInkOutline, snapPointToDevicePixel, snapToPixel, withAlpha } from "./style";
import { walkerVisualAnchor } from "./walkerAnchor";
import { drawProceduralWalkerSprite } from "./walkerProceduralSprite";
import { walkerPresentationFor } from "./walkerPresentation";
import { OBJECT_OUTLINE_ALPHA, type ObjectRenderViewMode } from "./occlusionModel";

const CARGO_COLOR_BY_RESOURCE = {
  wheat: PALETTE.gold,
  bread: SEMANTIC_PALETTE.earth,
  logs: SEMANTIC_PALETTE.forest,
  timber: SEMANTIC_PALETTE.earthDark,
  stone_raw: SEMANTIC_PALETTE.stoneDark,
  stone: SEMANTIC_PALETTE.stone,
  coin: SEMANTIC_PALETTE.gold,
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
  const leftAnchor = walkerVisualAnchor(left.position);
  const rightAnchor = walkerVisualAnchor(right.position);
  return (
    leftAnchor.tx + leftAnchor.ty - (rightAnchor.tx + rightAnchor.ty) ||
    leftAnchor.ty - rightAnchor.ty ||
    leftAnchor.tx - rightAnchor.tx ||
    left.id.localeCompare(right.id)
  );
}

export function drawWalker(
  context: CanvasRenderingContext2D,
  walker: Walker,
  zoom: number,
  viewMode: ObjectRenderViewMode = "normal",
): void {
  const anchor = walkerVisualAnchor(walker.position);
  const transform = context.getTransform?.();
  const foot = transform === undefined
    ? { x: snapToPixel(anchor.sx), y: snapToPixel(anchor.sy) }
    : snapPointToDevicePixel({ x: anchor.sx, y: anchor.sy }, transform);
  const footX = foot.x;
  const footY = foot.y;
  const scale = walkerScaleForZoom(zoom);

  if (viewMode === "outlines") {
    drawWalkerSilhouette(context, footX, footY, scale, zoom);
    return;
  }

  drawWalkerHalo(context, footX, footY, scale);
  drawWalkerShadow(context, footX, footY, scale);
  drawProceduralWalkerSprite(context, {
    footX,
    footY,
    scale,
    zoom,
    presentation: walkerPresentationFor(walker),
  });
  if (walker.kind !== "builder" && walker.cargo !== null) {
    drawCargo(context, footX, footY, cargoColor(walker.cargo.resource), scale, zoom);
  }
}

function drawWalkerSilhouette(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
  zoom: number,
): void {
  const previousAlpha = context.globalAlpha;
  context.save();
  try {
    context.globalAlpha = previousAlpha * OBJECT_OUTLINE_ALPHA;
    context.fillStyle = PALETTE.ink;
    context.fillRect(
      snapToPixel(footX - 5 * scale),
      snapToPixel(footY - 32 * scale),
      snapToPixel(10 * scale),
      snapToPixel(24 * scale),
    );
    applyInkOutline(context, zoom);
    context.strokeRect(
      snapToPixel(footX - 5 * scale),
      snapToPixel(footY - 32 * scale),
      snapToPixel(10 * scale),
      snapToPixel(24 * scale),
    );
  } finally {
    context.globalAlpha = previousAlpha;
    context.restore();
  }
}

function drawWalkerHalo(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
): void {
  const halo = snappedCanvasPoint(context, footX - 5 * scale, footY - 13 * scale);
  context.fillStyle = withAlpha(PALETTE.ink, 0.28);
  context.fillRect(
    halo.x,
    halo.y,
    snapToPixel(10 * scale),
    snapToPixel(14 * scale),
  );
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

function drawCargo(
  context: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  color: PaletteColor,
  scale: number,
  zoom: number,
): void {
  const size = 5 * scale;
  const position = snappedCanvasPoint(context, footX - size / 2, footY - 38 * scale);
  const x = position.x;
  const y = position.y;
  context.fillStyle = color;
  context.fillRect(x, y, snapToPixel(size), snapToPixel(size));
  applyInkOutline(context, zoom);
  context.strokeRect(x, y, snapToPixel(size), snapToPixel(size));
}

function snappedCanvasPoint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const transform = context.getTransform?.();
  return transform === undefined
    ? { x: snapToPixel(x), y: snapToPixel(y) }
    : snapPointToDevicePixel({ x, y }, transform);
}
