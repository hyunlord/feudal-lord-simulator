import type { CameraState } from "./camera";
import { canvasToWorld } from "./camera";
import { TILE_H, TILE_W, screenToTile } from "./iso";
import { maxSpriteAnchorY } from "./worldAssets";
import type { Grid } from "../world/grid";
import type { Tile } from "../world/world.types";

export type TileRange = {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
  readonly minDepth?: number;
  readonly maxDepth?: number;
  readonly minDiagonal?: number;
  readonly maxDiagonal?: number;
};

export type ViewportSize = {
  readonly width: number;
  readonly height: number;
};

export type WorldSize = {
  readonly width: number;
  readonly height: number;
};

export type VisibleRangeInput = {
  readonly camera: CameraState;
  readonly viewport: ViewportSize;
  readonly world: WorldSize;
};

export type TileFootprint = {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
};

const RANGE_MARGIN_TILES = Math.max(4, Math.ceil(maxSpriteAnchorY() / TILE_W));
const visibleTileRangeCache = new WeakMap<readonly Tile[], Map<string, readonly Tile[]>>();

export const computeVisibleTileRange = (input: VisibleRangeInput): TileRange => {
  const worldCorners = [
    { x: 0, y: 0 },
    { x: input.viewport.width, y: 0 },
    { x: 0, y: input.viewport.height },
    { x: input.viewport.width, y: input.viewport.height },
  ].map((point) => canvasToWorld(point, input.camera));
  const tileCorners = worldCorners.map((point) => screenToTile(point.x, point.y));
  const txValues = tileCorners.map((point) => point.tx);
  const tyValues = tileCorners.map((point) => point.ty);
  const xValues = worldCorners.map((point) => point.x);
  const yValues = worldCorners.map((point) => point.y);
  const minWorldX = Math.min(...xValues);
  const maxWorldX = Math.max(...xValues);
  const minWorldY = Math.min(...yValues);
  const maxWorldY = Math.max(...yValues);
  return {
    minTx: clampTile(Math.floor(Math.min(...txValues)) - RANGE_MARGIN_TILES, input.world.width),
    minTy: clampTile(Math.floor(Math.min(...tyValues)) - RANGE_MARGIN_TILES, input.world.height),
    maxTx: clampTile(Math.ceil(Math.max(...txValues)) + RANGE_MARGIN_TILES, input.world.width),
    maxTy: clampTile(Math.ceil(Math.max(...tyValues)) + RANGE_MARGIN_TILES, input.world.height),
    minDepth: Math.floor((minWorldY - TILE_H / 2) / (TILE_H / 2)),
    maxDepth: Math.ceil((maxWorldY + maxSpriteAnchorY()) / (TILE_H / 2)),
    minDiagonal: Math.floor((minWorldX - TILE_W / 2) / (TILE_W / 2)),
    maxDiagonal: Math.ceil((maxWorldX + TILE_W / 2) / (TILE_W / 2)),
  };
};

export const visibleTilesInDrawOrder = (input: {
  readonly grid: Grid;
  readonly range: TileRange;
}): readonly Tile[] => {
  const tiles: Tile[] = [];
  const bounds = visibleIterationBounds(input.grid, input.range);
  const cacheKey = [
    input.grid.width,
    input.grid.height,
    bounds.minTx,
    bounds.minTy,
    bounds.maxTx,
    bounds.maxTy,
    bounds.minDepth,
    bounds.maxDepth,
    bounds.minDiagonal,
    bounds.maxDiagonal,
  ].join(":");
  const cachedRanges = visibleTileRangeCache.get(input.grid.tiles);
  const cached = cachedRanges?.get(cacheKey);
  if (cached !== undefined) return cached;

  for (let depth = bounds.minDepth; depth <= bounds.maxDepth; depth += 1) {
    const startTy = Math.max(
      bounds.minTy,
      depth - bounds.maxTx,
      Math.ceil((depth - bounds.maxDiagonal) / 2),
    );
    const endTy = Math.min(
      bounds.maxTy,
      depth - bounds.minTx,
      Math.floor((depth - bounds.minDiagonal) / 2),
    );
    for (let ty = startTy; ty <= endTy; ty += 1) {
      const tx = depth - ty;
      const tile = input.grid.tiles[ty * input.grid.width + tx];
      if (tile !== undefined) tiles.push(tile);
    }
  }

  if (cachedRanges === undefined) {
    visibleTileRangeCache.set(input.grid.tiles, new Map([[cacheKey, tiles]]));
  } else {
    cachedRanges.set(cacheKey, tiles);
  }
  return tiles;
};

export const tileIsVisibleInRange = (tx: number, ty: number, range: TileRange): boolean => {
  if (tx < range.minTx || tx > range.maxTx || ty < range.minTy || ty > range.maxTy) return false;
  const depth = tx + ty;
  if (range.minDepth !== undefined && depth < range.minDepth) return false;
  if (range.maxDepth !== undefined && depth > range.maxDepth) return false;
  const diagonal = tx - ty;
  if (range.minDiagonal !== undefined && diagonal < range.minDiagonal) return false;
  return range.maxDiagonal === undefined || diagonal <= range.maxDiagonal;
};

export const footprintHasVisibleTile = (footprint: TileFootprint, range: TileRange): boolean => {
  for (let ty = footprint.ty; ty < footprint.ty + footprint.height; ty += 1) {
    for (let tx = footprint.tx; tx < footprint.tx + footprint.width; tx += 1) {
      if (tileIsVisibleInRange(tx, ty, range)) return true;
    }
  }
  return false;
};

const visibleIterationBounds = (grid: Grid, range: TileRange) => {
  const minTx = Math.max(0, range.minTx);
  const minTy = Math.max(0, range.minTy);
  const maxTx = Math.min(grid.width - 1, range.maxTx);
  const maxTy = Math.min(grid.height - 1, range.maxTy);
  return {
    minTx,
    minTy,
    maxTx,
    maxTy,
    minDepth: Math.max(range.minDepth ?? minTx + minTy, minTx + minTy),
    maxDepth: Math.min(range.maxDepth ?? maxTx + maxTy, maxTx + maxTy),
    minDiagonal: Math.max(range.minDiagonal ?? minTx - maxTy, minTx - maxTy),
    maxDiagonal: Math.min(range.maxDiagonal ?? maxTx - minTy, maxTx - minTy),
  };
};

const clampTile = (value: number, size: number): number =>
  Math.max(0, Math.min(size - 1, value));
