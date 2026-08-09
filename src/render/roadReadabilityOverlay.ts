import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile } from "../world/grid";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { roadConnectionArms, roadPebbleVariants, type CardinalDirection } from "./terrainDetails";
import { snapToPixel } from "./style";

export const ROAD_READABILITY_OVERLAY_ALPHA = 0.72;

type Point = { readonly x: number; readonly y: number };

const DIRECTION_OFFSET = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
} as const satisfies Record<CardinalDirection, { readonly dx: number; readonly dy: number }>;

export function drawRoadReadabilityOverlay(
  context: CanvasRenderingContext2D,
  state: GameState,
  tiles: readonly Tile[],
): void {
  const roadTiles = tiles.filter((tile) => tile.hasRoad);
  if (roadTiles.length === 0) return;
  const previousAlpha = context.globalAlpha;
  context.save();
  try {
    context.globalAlpha = previousAlpha * ROAD_READABILITY_OVERLAY_ALPHA;
    for (const tile of roadTiles) {
      drawReadableRoadMarks(context, state, tile);
    }
  } finally {
    context.globalAlpha = previousAlpha;
    context.restore();
  }
}

function drawReadableRoadMarks(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
): void {
  const center = tileCenter(tile);
  const arms = roadConnectionArms(tile, roadNeighbours(state, tile));
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  traceSmallDiamond(context, center, 8, 3);
  context.fill();
  for (const direction of arms) {
    traceRutArm(context, center, direction);
    context.fill();
  }
  context.fillStyle = SEMANTIC_PALETTE.stoneDark;
  for (const [index, variant] of roadPebbleVariants(tile.tx, tile.ty, state.seed).entries()) {
    const x = center.x + ((variant >>> 4) % 19) - 9;
    const y = center.y + ((variant >>> 10) % 9) - 4 + index;
    traceSmallDiamond(context, { x, y }, 2, 1);
    context.fill();
  }
}

function roadNeighbours(state: GameState, tile: Tile): readonly Tile[] {
  return Object.values(DIRECTION_OFFSET)
    .map(({ dx, dy }) => getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy }))
    .filter((candidate): candidate is Tile => candidate !== null);
}

function tileCenter(tile: Tile): Point {
  const center = tileToScreen(tile.tx, tile.ty);
  return { x: center.sx, y: center.sy };
}

function traceSmallDiamond(
  context: CanvasRenderingContext2D,
  center: Point,
  rx: number,
  ry: number,
): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - ry));
  context.lineTo(snapToPixel(center.x + rx), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + ry));
  context.lineTo(snapToPixel(center.x - rx), snapToPixel(center.y));
  context.closePath();
}

function traceRutArm(
  context: CanvasRenderingContext2D,
  center: Point,
  direction: CardinalDirection,
): void {
  const { dx, dy } = DIRECTION_OFFSET[direction];
  const endX = center.x + ((dx - dy) * TILE_W) / 2;
  const endY = center.y + ((dx + dy) * TILE_H) / 2;
  context.beginPath();
  context.moveTo(snapToPixel(center.x - 2), snapToPixel(center.y));
  context.lineTo(snapToPixel(endX - 2), snapToPixel(endY));
  context.lineTo(snapToPixel(endX + 2), snapToPixel(endY));
  context.lineTo(snapToPixel(center.x + 2), snapToPixel(center.y));
  context.closePath();
}
