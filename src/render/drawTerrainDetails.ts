import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile } from "../world/grid";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import {
  groundDecalFor,
  roadConnectionArms,
  roadPebbleVariants,
  type CardinalDirection,
} from "./terrainDetails";
import { getTerrainPattern, terrainPatternQuarterTurn, type TerrainPatternAssets } from "./terrainPatterns";
import { snapToPixel } from "./style";

type Point = { readonly x: number; readonly y: number };

const DIRECTION_OFFSET = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
} as const satisfies Record<CardinalDirection, { readonly dx: number; readonly dy: number }>;

export function drawGroundDecalDetail(
  context: CanvasRenderingContext2D,
  tile: Tile,
  seed: number,
): void {
  if (tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null) return;
  const decal = groundDecalFor(tile.tx, tile.ty, seed);
  if (decal.kind === "none") return;
  const center = tileCenter(tile);
  const offsetX = ((decal.variant >>> 3) % 17) - 8;
  const offsetY = ((decal.variant >>> 9) % 7) - 3;
  if (decal.kind === "rock") {
    context.fillStyle = SEMANTIC_PALETTE.stoneDark;
    traceSmallDiamond(context, { x: center.x + offsetX, y: center.y + offsetY }, 3, 2);
    context.fill();
    return;
  }
  context.fillStyle = SEMANTIC_PALETTE.sageDark;
  context.beginPath();
  for (let index = 0; index < decal.count; index += 1) {
    const x = center.x + offsetX + index * 3 - decal.count * 1.5;
    const y = center.y + offsetY + (index & 1);
    context.moveTo(snapToPixel(x - 1), snapToPixel(y + 2));
    context.lineTo(snapToPixel(x), snapToPixel(y - 3 - (index & 1)));
    context.lineTo(snapToPixel(x + 1), snapToPixel(y + 2));
    context.closePath();
  }
  context.fill();
}

export function drawRoadPath(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  terrainPatterns?: TerrainPatternAssets,
): void {
  const center = tileCenter(tile);
  const neighbours = Object.values(DIRECTION_OFFSET)
    .map(({ dx, dy }) => getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy }))
    .filter((candidate): candidate is Tile => candidate !== null);
  const arms = roadConnectionArms(tile, neighbours);
  const pattern = getTerrainPattern(
    context,
    "packed_earth_road",
    terrainPatterns,
    terrainPatternQuarterTurn("packed_earth_road", tile.tx, tile.ty, state.seed),
  );
  if (pattern === null) {
    context.fillStyle = SEMANTIC_PALETTE.earth;
    traceRoadBase(context, center, arms);
    context.fill();
  } else {
    fillRoadPattern(context, center, arms, pattern);
  }

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

function fillRoadPattern(
  context: CanvasRenderingContext2D,
  center: Point,
  arms: readonly CardinalDirection[],
  pattern: CanvasPattern,
): void {
  traceRoadBase(context, center, arms);
  context.save();
  try {
    context.clip();
    context.fillStyle = pattern;
    context.globalAlpha *= 0.45;
    context.fillRect(
      snapToPixel(center.x - TILE_W / 2),
      snapToPixel(center.y - TILE_H / 2),
      TILE_W,
      TILE_H,
    );
  } finally {
    context.restore();
  }
}

function traceRoadBase(
  context: CanvasRenderingContext2D,
  center: Point,
  arms: readonly CardinalDirection[],
): void {
  context.beginPath();
  appendSmallDiamond(context, center, 13, 6);
  for (const direction of arms) appendRoadArm(context, center, direction);
}

function appendRoadArm(
  context: CanvasRenderingContext2D,
  center: Point,
  direction: CardinalDirection,
): void {
  const { dx, dy } = DIRECTION_OFFSET[direction];
  const endX = center.x + ((dx - dy) * TILE_W) / 2;
  const endY = center.y + ((dx + dy) * TILE_H) / 2;
  const vectorX = endX - center.x;
  const vectorY = endY - center.y;
  const length = Math.hypot(vectorX, vectorY);
  if (length === 0) return;
  const normalX = (-vectorY / length) * 5;
  const normalY = (vectorX / length) * 5;
  context.moveTo(snapToPixel(center.x + normalX), snapToPixel(center.y + normalY));
  context.lineTo(snapToPixel(endX + normalX), snapToPixel(endY + normalY));
  context.lineTo(snapToPixel(endX - normalX), snapToPixel(endY - normalY));
  context.lineTo(snapToPixel(center.x - normalX), snapToPixel(center.y - normalY));
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
  appendSmallDiamond(context, center, rx, ry);
}

function appendSmallDiamond(
  context: CanvasRenderingContext2D,
  center: Point,
  rx: number,
  ry: number,
): void {
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - ry));
  context.lineTo(snapToPixel(center.x + rx), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + ry));
  context.lineTo(snapToPixel(center.x - rx), snapToPixel(center.y));
  context.closePath();
}
