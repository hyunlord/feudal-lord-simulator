import { PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";

type Point = { readonly x: number; readonly y: number };
type EdgeBasis = Point & {
  readonly inwardX: number;
  readonly inwardY: number;
  readonly tangentX: number;
  readonly tangentY: number;
};

export type TerrainSeamKind = "shoreline" | "forestTufts" | "rockPebbles";

export function terrainSeamFor(
  terrain: Tile["terrain"],
  neighbourTerrain: Tile["terrain"],
): TerrainSeamKind | null {
  if (terrain !== "grass") return null;
  if (neighbourTerrain === "water") return "shoreline";
  if (neighbourTerrain === "forest") return "forestTufts";
  if (neighbourTerrain === "rock") return "rockPebbles";
  return null;
}

export function terrainSeamMarkCount(
  seam: TerrainSeamKind,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  seed: number,
): number {
  if (seam === "shoreline") return 1;
  return 2 + (seamHash(tx, ty, dx, dy, seed) & 1);
}

export function drawTerrainTransitions(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  zoom: number,
): void {
  for (const neighbour of orthogonalNeighbors(tile)) {
    const neighbourTile = getTile(state, neighbour);
    if (neighbourTile === null) continue;
    const seam = terrainSeamFor(tile.terrain, neighbourTile.terrain);
    if (seam === null) continue;
    const dx = neighbour.tx - tile.tx;
    const dy = neighbour.ty - tile.ty;
    const count = terrainSeamMarkCount(seam, tile.tx, tile.ty, dx, dy, state.seed);
    context.fillStyle = seamColor(seam);
    traceSeam(context, seam, tileCenter(tile), dx, dy, count);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
}

function traceSeam(
  context: CanvasRenderingContext2D,
  seam: TerrainSeamKind,
  center: Point,
  dx: number,
  dy: number,
  count: number,
): void {
  if (seam === "shoreline") traceShoreline(context, center, dx, dy);
  else if (seam === "forestTufts") traceTufts(context, center, dx, dy, count);
  else tracePebbles(context, center, dx, dy, count);
}

function traceShoreline(context: CanvasRenderingContext2D, center: Point, dx: number, dy: number): void {
  const basis = edgeBasis(center, dx, dy);
  const x1 = basis.x - basis.tangentX * 0.38;
  const y1 = basis.y - basis.tangentY * 0.38;
  const x2 = basis.x + basis.tangentX * 0.38;
  const y2 = basis.y + basis.tangentY * 0.38;
  context.beginPath();
  context.moveTo(snapToPixel(x1), snapToPixel(y1));
  context.lineTo(snapToPixel(x2), snapToPixel(y2));
  context.lineTo(snapToPixel(x2 + basis.inwardX), snapToPixel(y2 + basis.inwardY));
  context.lineTo(snapToPixel(x1 + basis.inwardX), snapToPixel(y1 + basis.inwardY));
  context.closePath();
}

function traceTufts(context: CanvasRenderingContext2D, center: Point, dx: number, dy: number, count: number): void {
  const basis = edgeBasis(center, dx, dy);
  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const position = (index + 1) / (count + 1) - 0.5;
    const x = basis.x + basis.inwardX + basis.tangentX * position * 0.72;
    const y = basis.y + basis.inwardY + basis.tangentY * position * 0.72;
    const width = 2 + (index & 1);
    const height = 4 + (index & 1);
    context.moveTo(snapToPixel(x - width), snapToPixel(y + height / 2));
    context.lineTo(snapToPixel(x), snapToPixel(y - height));
    context.lineTo(snapToPixel(x + width), snapToPixel(y + height / 2));
    context.closePath();
  }
}

function tracePebbles(context: CanvasRenderingContext2D, center: Point, dx: number, dy: number, count: number): void {
  const basis = edgeBasis(center, dx, dy);
  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const position = (index + 1) / (count + 1) - 0.5;
    const x = basis.x + basis.inwardX + basis.tangentX * position * 0.68;
    const y = basis.y + basis.inwardY + basis.tangentY * position * 0.68;
    const rx = 2 + (index & 1);
    const ry = 1 + (index & 1);
    context.moveTo(snapToPixel(x), snapToPixel(y - ry));
    context.lineTo(snapToPixel(x + rx), snapToPixel(y));
    context.lineTo(snapToPixel(x), snapToPixel(y + ry));
    context.lineTo(snapToPixel(x - rx), snapToPixel(y));
    context.closePath();
  }
}

function edgeBasis(center: Point, dx: number, dy: number): EdgeBasis {
  return {
    x: center.x + ((dx - dy) * TILE_W) / 4,
    y: center.y + ((dx + dy) * TILE_H) / 4,
    inwardX: -((dx - dy) * TILE_W) * 0.035,
    inwardY: -((dx + dy) * TILE_H) * 0.035,
    tangentX: -((dx + dy) * TILE_W) / 2,
    tangentY: ((dx - dy) * TILE_H) / 2,
  };
}

function orthogonalNeighbors(tile: Tile): readonly TileCoordinate[] {
  return [
    { tx: tile.tx, ty: tile.ty - 1 },
    { tx: tile.tx + 1, ty: tile.ty },
    { tx: tile.tx, ty: tile.ty + 1 },
    { tx: tile.tx - 1, ty: tile.ty },
  ];
}

function tileCenter(tile: Tile): Point {
  const center = tileToScreen(tile.tx, tile.ty);
  return { x: center.sx, y: center.sy };
}

function seamColor(seam: TerrainSeamKind): PaletteColor {
  if (seam === "shoreline") return PALETTE.earth;
  return seam === "forestTufts" ? PALETTE.sageDark : PALETTE.stoneDark;
}

function seamHash(tx: number, ty: number, dx: number, dy: number, seed: number): number {
  let hash = Math.imul(tx, 73_856_093) ^ Math.imul(ty, 19_349_663) ^
    Math.imul(dx + 2, 83_492_791) ^ Math.imul(dy + 2, 2_654_435_761) ^
    Math.imul(seed, 374_761_393);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}
