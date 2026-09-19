import { SEMANTIC_PALETTE } from "../content/palette";
import { getTile, type Grid, type TileCoordinate } from "../world/grid";
import type { Tile } from "../world/world.types";
import { tileToScreen } from "./iso";
import { snapToPixel, withAlpha } from "./style";

type Polygon = readonly TileCoordinate[];
export type HouseFrontage = {
  readonly pad: Polygon;
  readonly path: Polygon;
  readonly road: TileCoordinate | null;
};

const ROAD_PRIORITY = [
  { tx: 0, ty: 1 }, { tx: 1, ty: 0 }, { tx: -1, ty: 0 }, { tx: 0, ty: -1 },
] as const;

export function houseFrontage(grid: Grid, tile: Tile, seed: number): HouseFrontage | null {
  if (tile.buildingId === null || tile.terrain === "water" || tile.terrain === "rock") return null;
  const phase = tile.tx * 13 + tile.ty * 7 + seed * 3;
  const direction = ROAD_PRIORITY.find(offset => {
    const neighbor = getTile(grid, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty });
    return neighbor !== null && neighbor.hasRoad && neighbor.buildingId === null
      && neighbor.terrain !== "water" && neighbor.terrain !== "rock";
  });
  const facing = direction ?? ROAD_PRIORITY[Math.abs(phase) % ROAD_PRIORITY.length] ?? ROAD_PRIORITY[0];
  const skew = Math.sin(phase) * 0.055;
  const stretch = 0.84 + (Math.sin(phase * 1.7) + 1) * 0.08;
  const localPad = [
    [-0.14, -0.12], [0.05, -0.21], [0.21, -0.16],
    [0.38, -0.11], [0.41, 0.06], [0.27, 0.18],
    [0.12, 0.13], [-0.08, 0.19], [-0.19, 0.03],
  ] as const;
  const pad = localPad.map(([forward, across]) => ({
    tx: tile.tx + facing.tx * forward * stretch - facing.ty * (across + skew),
    ty: tile.ty + facing.ty * forward * stretch + facing.tx * (across + skew),
  }));
  if (direction === undefined) return { pad, path: [], road: null };
  const road = { tx: tile.tx + direction.tx, ty: tile.ty + direction.ty };
  const side = (sign: number): Polygon => Array.from({ length: 9 }, (_, index) => {
    const distance = 0.24 + index / 8 * 0.76;
    const width = 0.065 + distance * 0.045 + Math.sin(index * 1.9 + phase) * 0.012;
    const offset = sign * width + Math.sin(distance * Math.PI) * skew;
    return {
      tx: tile.tx + direction.tx * distance - direction.ty * offset,
      ty: tile.ty + direction.ty * distance + direction.tx * offset,
    };
  });
  return { pad, path: [...side(1), ...[...side(-1)].reverse()], road };
}

export function drawHouseFrontage(context: CanvasRenderingContext2D, frontage: HouseFrontage): void {
  fillPolygon(context, frontage.pad, 0.20);
  if (frontage.path.length > 0) fillPolygon(context, frontage.path, 0.30);
}

function fillPolygon(context: CanvasRenderingContext2D, polygon: Polygon, opacity: number): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, opacity);
  context.beginPath();
  for (const [index, point] of polygon.entries()) {
    const screen = tileToScreen(point.tx, point.ty);
    if (index === 0) context.moveTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
    else context.lineTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
  }
  context.closePath();
  context.fill();
}


export function drawHouseContactShadow(context: CanvasRenderingContext2D, center: { readonly sx: number; readonly sy: number }): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, 0.26);
  context.beginPath();
  const points = [[-12, -4], [-2, -8], [11, -3], [5, 1], [-7, 2]] as const;
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) context.moveTo(snapToPixel(center.sx + x), snapToPixel(center.sy + y));
    else context.lineTo(snapToPixel(center.sx + x), snapToPixel(center.sy + y));
  }
  context.closePath();
  context.fill();
}
