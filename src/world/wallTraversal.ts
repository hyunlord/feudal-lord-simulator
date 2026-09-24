import type { Grid, TileCoordinate } from "./grid";
import type { TileEdgePoint } from "../geometry/tileGeometry";

export const GATE_HALF_CLEARANCE = 0.8;

export interface WallBoundary {
  readonly gate: TileEdgePoint;
  readonly additionalGates?: readonly TileEdgePoint[];
  readonly segments: readonly {
    readonly completed: boolean;
    readonly edgePath: readonly TileEdgePoint[];
  }[];
}

export interface WallGrid extends Grid {
  readonly palisade?: WallBoundary | null;
}

type Segment = readonly [TileEdgePoint, TileEdgePoint];
const EPSILON = 1e-9;
const solidCache = new WeakMap<WallBoundary, readonly Segment[]>();
const traversalCache = new WeakMap<WallBoundary, {
  readonly width: number;
  readonly height: number;
  readonly edges: Map<number, boolean>;
}>();

function cross(a: TileEdgePoint, b: TileEdgePoint, c: TileEdgePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(point: TileEdgePoint, a: TileEdgePoint, b: TileEdgePoint): boolean {
  return Math.abs(cross(a, b, point)) < EPSILON &&
    point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
}

function intersects(a: TileEdgePoint, b: TileEdgePoint, c: TileEdgePoint, d: TileEdgePoint): boolean {
  if (onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)) return true;
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function interpolate(a: TileEdgePoint, b: TileEdgePoint, ratio: number): TileEdgePoint {
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
}

export function wallGatePoints(wall: Pick<WallBoundary, "gate" | "additionalGates">): readonly TileEdgePoint[] {
  return [...new Map([wall.gate, ...(wall.additionalGates ?? [])].map(point => [`${point.x},${point.y}`, point])).values()];
}

function solidSegments(wall: WallBoundary): readonly Segment[] {
  const cached = solidCache.get(wall);
  if (cached !== undefined) return cached;
  const solids: Segment[] = [];
  for (const segment of wall.segments) {
    if (!segment.completed) continue;
    for (let index = 1; index < segment.edgePath.length; index += 1) {
      const a = segment.edgePath[index - 1]; const b = segment.edgePath[index];
      if (a === undefined || b === undefined) continue;
      const length = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      if (length < EPSILON) continue;
      const openings = wallGatePoints(wall).filter(gate => onSegment(gate, a, b)).map(gate => {
        const ratio = Math.max(Math.abs(gate.x - a.x), Math.abs(gate.y - a.y)) / length;
        return { start: Math.max(0, ratio - GATE_HALF_CLEARANCE / length), end: Math.min(1, ratio + GATE_HALF_CLEARANCE / length) };
      }).sort((left, right) => left.start - right.start);
      let cursor = 0;
      for (const opening of openings) {
        if (opening.start > cursor) solids.push([interpolate(a, b, cursor), interpolate(a, b, opening.start)]);
        cursor = Math.max(cursor, opening.end);
      }
      if (cursor < 1) solids.push([interpolate(a, b, cursor), b]);
    }
  }
  solidCache.set(wall, solids);
  return solids;
}

function adjacentEdgeKey(grid: WallGrid, from: TileCoordinate, to: TileCoordinate): number | null {
  if (!Number.isInteger(from.tx) || !Number.isInteger(from.ty) ||
      !Number.isInteger(to.tx) || !Number.isInteger(to.ty)) return null;
  if (Math.min(from.tx, to.tx) < 0 || Math.min(from.ty, to.ty) < 0 ||
      Math.max(from.tx, to.tx) >= grid.width || Math.max(from.ty, to.ty) >= grid.height) return null;
  const dx = Math.abs(to.tx - from.tx); const dy = Math.abs(to.ty - from.ty);
  if (dx + dy > 1) return null;
  const index = Math.min(from.ty, to.ty) * grid.width + Math.min(from.tx, to.tx);
  return index * 3 + (dx === 1 ? 1 : dy === 1 ? 2 : 0);
}

export function canTraverseWallBoundary(grid: WallGrid, from: TileCoordinate, to: TileCoordinate): boolean {
  if (grid.palisade === null || grid.palisade === undefined) return true;
  const key = adjacentEdgeKey(grid, from, to);
  let cache = traversalCache.get(grid.palisade);
  if (key !== null) {
    if (cache === undefined || cache.width !== grid.width || cache.height !== grid.height) {
      cache = { width: grid.width, height: grid.height, edges: new Map() };
      traversalCache.set(grid.palisade, cache);
    }
    const cached = cache.edges.get(key);
    if (cached !== undefined) return cached;
  }
  const a = { x: from.tx + 0.5, y: from.ty + 0.5 };
  const b = { x: to.tx + 0.5, y: to.ty + 0.5 };
  const allowed = !solidSegments(grid.palisade).some(([start, end]) => intersects(a, b, start, end));
  if (key !== null) cache?.edges.set(key, allowed);
  return allowed;
}
