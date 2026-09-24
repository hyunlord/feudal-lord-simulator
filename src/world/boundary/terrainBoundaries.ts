import type { Tile } from "../world.types";
import {
  boundaryHash,
  chaikinClosed,
  hashNumbers,
  nearestPointNearVertex,
  nearestPointOnPolyline,
  type BoundaryPoint,
} from "./boundaryGeometry";
import { cellContourLoops, cellOutlineLoops, type CellContourLoop } from "./cellContours";

// Forest edge and wheat-field cluster outlines. Both come from the same marching-squares pass over a cell mask and
// Chaikin x2 (Fable 3.3.2 / 3.3.5), so a forest tile and the grass tile beside it read one shared line, and a group
// of touching farms reads as one field. Decal choices are hashed from the owning tile edge, never from a tile +
// direction, so either side of an edge computes the same decal.

export const BOUNDARY_CHAIKIN_ROUNDS = 2;

export type SmoothedLoop = CellContourLoop & { readonly smoothed: readonly BoundaryPoint[] };

export type BoundaryDecal = {
  readonly edgeKey: number;
  /** Anchor on the smoothed line, tile-centre coordinates. */
  readonly anchor: BoundaryPoint;
  readonly variant: number;
  readonly flipX: boolean;
  readonly scale: number;
};

export type ForestBoundary = {
  readonly loops: readonly SmoothedLoop[];
  /** Per loop, the fringe decals along it (same index as `loops`). */
  readonly decals: readonly (readonly BoundaryDecal[])[];
};

export type FieldEdgeDecal = {
  readonly kind: "furrow" | "grass_edge";
  /** Centre of the run of tile edges it covers. */
  readonly anchor: BoundaryPoint;
  /** Runs along the tile y axis (screen lower-left to upper-right) are drawn as authored; x-axis runs are mirrored. */
  readonly axis: "x" | "y";
  /** 1 = two tile edges (a full farm side), 0.5 = a single edge. */
  readonly length: 1 | 0.5;
  readonly edgeKey: number;
};

export type FieldCluster = {
  readonly loops: readonly SmoothedLoop[];
  readonly farms: readonly { readonly id: string; readonly tx: number; readonly ty: number }[];
  readonly decals: readonly FieldEdgeDecal[];
  readonly hash: number;
};

type Grid = { readonly width: number; readonly height: number; readonly tiles: readonly Tile[] };

export const FOREST_FRINGE_VARIANTS = 3;

export function forestBoundary(grid: Grid, seed: number): ForestBoundary {
  const cells = indexTiles(grid);
  const isForest = (tx: number, ty: number): boolean => cells[ty * grid.width + tx]?.terrain === "forest";
  const occupied = (tx: number, ty: number): boolean => {
    const tile = cells[ty * grid.width + tx];
    return tile !== undefined && (tile.hasRoad || tile.buildingId !== null);
  };
  const loops = cellContourLoops({ width: grid.width, height: grid.height, inside: isForest, outside: true })
    .map(smooth);
  const decals = loops.map(loop => loop.edgeMidpoints.flatMap((point, index): BoundaryDecal[] => {
    const inside = loop.insideCells[index] as { readonly tx: number; readonly ty: number };
    const outsideCell = { tx: 2 * point.x - inside.tx, ty: 2 * point.y - inside.ty };
    // Beyond the map counts as forest only to keep outlines off the border; no fringe grows there.
    const offMap = inside.tx < 0 || inside.ty < 0 || inside.tx >= grid.width || inside.ty >= grid.height;
    if (offMap || occupied(inside.tx, inside.ty) || occupied(outsideCell.tx, outsideCell.ty)) return [];
    const key = loop.edgeKeys[index] as number;
    const hash = boundaryHash(key, seed, 31);
    const previousKey = loop.edgeKeys[(index + loop.edgeKeys.length - 1) % loop.edgeKeys.length] as number;
    // Local de-repetition: compare with the neighbour's raw pick, not its adjusted one, so no choice cascades.
    let variant = hash % FOREST_FRINGE_VARIANTS;
    if (variant === boundaryHash(previousKey, seed, 31) % FOREST_FRINGE_VARIANTS) {
      variant = (variant + 1 + ((hash >>> 8) & 1)) % FOREST_FRINGE_VARIANTS;
    }
    return [{
      edgeKey: key,
      anchor: nearestPointNearVertex(point, loop.smoothed, index, BOUNDARY_CHAIKIN_ROUNDS),
      variant,
      flipX: ((hash >>> 4) & 1) === 1,
      scale: 0.9 + ((hash >>> 12) & 0xff) / 255 * 0.2,
    }];
  }));
  return { loops, decals };
}

export function fieldClusters(
  grid: Grid,
  farms: readonly { readonly id: string; readonly tx: number; readonly ty: number; readonly width: number; readonly height: number }[],
): readonly FieldCluster[] {
  const owner = new Map<number, string>();
  for (const farm of farms) for (let dy = 0; dy < farm.height; dy += 1) for (let dx = 0; dx < farm.width; dx += 1) {
    const tx = farm.tx + dx; const ty = farm.ty + dy;
    if (tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height) owner.set(ty * grid.width + tx, farm.id);
  }
  const ownerAt = (tx: number, ty: number): string | undefined =>
    tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height ? undefined : owner.get(ty * grid.width + tx);
  // 4-connected clusters of farm cells; a cluster id is its smallest cell index.
  const cluster = new Map<number, number>();
  for (const index of [...owner.keys()].sort((a, b) => a - b)) {
    if (cluster.has(index)) continue;
    const stack = [index];
    cluster.set(index, index);
    while (stack.length > 0) {
      const current = stack.pop() as number;
      const tx = current % grid.width; const ty = Math.floor(current / grid.width);
      for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]] as const) {
        const next = ny * grid.width + nx;
        if (ownerAt(nx, ny) === undefined || cluster.has(next)) continue;
        cluster.set(next, index); stack.push(next);
      }
    }
  }
  const clusterIds = [...new Set(cluster.values())].sort((a, b) => a - b);
  return clusterIds.map(id => {
    const inside = (tx: number, ty: number): boolean => cluster.get(ty * grid.width + tx) === id;
    const loops = cellOutlineLoops({ width: grid.width, height: grid.height, inside, outside: false }).map(smooth);
    const members = farms.filter(farm => cluster.get(farm.ty * grid.width + farm.tx) === id)
      .map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty }))
      .sort((a, b) => a.ty - b.ty || a.tx - b.tx || (a.id < b.id ? -1 : 1));
    const decals = fieldEdgeDecals(grid.width, loops, (tx, ty) => cluster.get(ty * grid.width + tx) === id ? ownerAt(tx, ty) : undefined);
    return {
      loops, farms: members, decals,
      hash: hashNumbers([...loops.map(loop => loop.hash), ...members.flatMap(farm => [farm.tx, farm.ty])]),
    };
  });
}

type EdgeRef = { readonly axis: "x" | "y"; readonly line: number; readonly along: number; readonly facing: number;
  readonly edgeKey: number; readonly kind: FieldEdgeDecal["kind"] };

function fieldEdgeDecals(
  width: number,
  loops: readonly SmoothedLoop[],
  ownerAt: (tx: number, ty: number) => string | undefined,
): FieldEdgeDecal[] {
  const edges: EdgeRef[] = [];
  // Interior shared edges between two different farms of the cluster get furrows.
  const visit = (tx: number, ty: number): void => {
    const here = ownerAt(tx, ty);
    if (here === undefined) return;
    const east = ownerAt(tx + 1, ty); const south = ownerAt(tx, ty + 1);
    if (east !== undefined && east !== here) edges.push({ axis: "y", line: tx + 0.5, along: ty, facing: 0, edgeKey: 0, kind: "furrow" });
    if (south !== undefined && south !== here) edges.push({ axis: "x", line: ty + 0.5, along: tx, facing: 0, edgeKey: 0, kind: "furrow" });
  };
  const seen = new Set<number>();
  for (const loop of loops) for (const cell of loop.insideCells) {
    // Flood the cluster from its boundary cells so interior cells are visited too.
    const stack = [cell];
    while (stack.length > 0) {
      const current = stack.pop() as { tx: number; ty: number };
      const index = current.ty * width + current.tx;
      if (seen.has(index) || ownerAt(current.tx, current.ty) === undefined) continue;
      seen.add(index); visit(current.tx, current.ty);
      stack.push({ tx: current.tx + 1, ty: current.ty }, { tx: current.tx - 1, ty: current.ty },
        { tx: current.tx, ty: current.ty + 1 }, { tx: current.tx, ty: current.ty - 1 });
    }
  }
  // Exposed outline edges get grass edges, from the marching-squares vertices (one per exposed tile edge).
  for (const loop of loops) loop.edgeMidpoints.forEach((point, index) => {
    const inside = loop.insideCells[index] as { readonly tx: number; readonly ty: number };
    const axis = point.x !== inside.tx ? "y" : "x";
    edges.push(axis === "y"
      ? { axis, line: point.x, along: inside.ty, facing: Math.sign(point.x - inside.tx), edgeKey: loop.edgeKeys[index] as number, kind: "grass_edge" }
      : { axis, line: point.y, along: inside.tx, facing: Math.sign(point.y - inside.ty), edgeKey: loop.edgeKeys[index] as number, kind: "grass_edge" });
  });
  const smoothedLoops = loops.map(loop => loop.smoothed);
  const decals: FieldEdgeDecal[] = [];
  const groups = new Map<string, EdgeRef[]>();
  for (const edge of edges) {
    const id = `${edge.kind}:${edge.axis}:${edge.line}:${edge.facing}`;
    groups.set(id, [...(groups.get(id) ?? []), edge]);
  }
  for (const id of [...groups.keys()].sort()) {
    const run = (groups.get(id) ?? []).sort((a, b) => a.along - b.along);
    let index = 0;
    while (index < run.length) {
      const first = run[index] as EdgeRef; const second = run[index + 1];
      const paired = second !== undefined && second.along === first.along + 1;
      const along = paired ? first.along + 0.5 : first.along;
      const centre = first.axis === "y" ? { x: first.line, y: along } : { x: along, y: first.line };
      const anchor = first.kind === "grass_edge" ? nearestOnLoops(centre, smoothedLoops) : centre;
      decals.push({ kind: first.kind, anchor, axis: first.axis, length: paired ? 1 : 0.5, edgeKey: first.edgeKey });
      index += paired ? 2 : 1;
    }
  }
  return decals;
}

function nearestOnLoops(point: BoundaryPoint, loops: readonly (readonly BoundaryPoint[])[]): BoundaryPoint {
  let best = point; let bestDistance = Infinity;
  for (const loop of loops) {
    const candidate = nearestPointOnPolyline(point, loop, true);
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) { bestDistance = distance; best = candidate; }
  }
  return best;
}

function smooth(loop: CellContourLoop): SmoothedLoop {
  return { ...loop, smoothed: chaikinClosed(loop.points, BOUNDARY_CHAIKIN_ROUNDS) };
}

function indexTiles(grid: Grid): Tile[] {
  const cells: Tile[] = new Array(grid.width * grid.height);
  for (const tile of grid.tiles) cells[tile.ty * grid.width + tile.tx] = tile;
  return cells;
}
