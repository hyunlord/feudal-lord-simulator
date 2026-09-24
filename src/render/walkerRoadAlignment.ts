import type { TilePos, Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";
import { nearestPointOnPolyline, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { RoadCenterlineGraph } from "../world/boundary/roadCenterline";
import type { Tile } from "../world/world.types";
import { groundBoundaryScene } from "./groundBoundaryScene";

// Walker display offset (D1a-2, D1a hand-off 1): a walker on a road cell is drawn at the nearest point of the ribbon
// centreline instead of the cell-centre chain it walks, so it no longer cuts across the grass at a bend (the two
// differ by up to 0.88 tile at a double bend). Display only: the walker's logical position, path and timing are untouched.
//  - The pull fades out over the half cell toward a neighbour that is not road (the walker is stepping off the road
//    into a building), so the drawn position never jumps.
//  - Plaza cells, water (bridge decks) and non-road cells keep the logical position. Portal approaches are straight
//    on the structure axis (roadCenterline lock), so the pull is zero there as well.
//
// Cache (AGENTS rule 10): the cell -> chain index is built once per road graph (WeakMap on the graph object, which the
// ground scene rebuilds whenever tiles, palisade, seed or farms change) and holds no walker data; measured cost per
// frame is in docs/verification/d1a2-road/REPORT.md.

/** Safety cap only: the centreline stays within 0.2 of the road cells, and at the tightest bends the cell-centre path
 *  is 0.88 tile from it, so the full pull always lands on the drawn road. */
const MAX_PULL = 1;

type AlignmentIndex = {
  readonly graph: RoadCenterlineGraph;
  readonly width: number;
  readonly height: number;
  readonly chainsAt: ReadonlyMap<number, readonly number[]>;
  readonly road: Uint8Array;
};
const indexes = new WeakMap<RoadCenterlineGraph, AlignmentIndex>();

export function roadAlignedWalkers(state: GameState, walkers: readonly Walker[]): readonly Walker[] {
  if (walkers.length === 0) return walkers;
  const scene = groundBoundaryScene(state);
  const index = alignmentIndex(scene.roads, state.width, state.height, state.tiles);
  let changed = false;
  const aligned = walkers.map(walker => {
    const position = alignedRoadPosition(index, walker.position);
    if (position === walker.position) return walker;
    changed = true;
    return { ...walker, position };
  });
  return changed ? aligned : walkers;
}

export function alignmentIndex(graph: RoadCenterlineGraph, width: number, height: number, tiles: readonly Tile[]): AlignmentIndex {
  const cached = indexes.get(graph);
  if (cached !== undefined && cached.width === width && cached.height === height) return cached;
  // 0 = not road, 1 = land road, 2 = plaza cell, 3 = road on water (bridge deck).
  const road = new Uint8Array(width * height);
  for (const tile of tiles) if (tile.hasRoad) road[tile.ty * width + tile.tx] = tile.terrain === "water" ? 3 : 1;
  for (const point of graph.fixedPoints) if (point.kinds.includes("plaza")) road[point.ty * width + point.tx] = 2;
  const chainsAt = new Map<number, number[]>();
  graph.chains.forEach((chain, chainIndex) => {
    for (const cell of chain.cells) {
      const key = cell.ty * width + cell.tx;
      const list = chainsAt.get(key) ?? [];
      if (!list.includes(chainIndex)) list.push(chainIndex);
      chainsAt.set(key, list);
    }
  });
  const built = { graph, width, height, chainsAt, road };
  indexes.set(graph, built);
  return built;
}

/** The drawn position for a logical position (the same object when nothing changes). */
export function alignedRoadPosition(index: AlignmentIndex, position: TilePos): TilePos {
  const pull = roadPull(index, position);
  if (pull === null) return position;
  return { tx: position.tx + pull.x, ty: position.ty + pull.y };
}

/** Offset from the logical position to the drawn one, or null when the walker is drawn where it is. */
export function roadPull(index: AlignmentIndex, position: TilePos): BoundaryPoint | null {
  const tx = Math.round(position.tx); const ty = Math.round(position.ty);
  if (tx < 0 || ty < 0 || tx >= index.width || ty >= index.height) return null;
  if (index.road[ty * index.width + tx] !== 1) return null;
  const weight = roadWeight(index, position, tx, ty);
  if (weight <= 0) return null;
  const chains = index.chainsAt.get(ty * index.width + tx);
  if (chains === undefined) return null;
  const point = { x: position.tx, y: position.ty };
  let best: BoundaryPoint | null = null; let bestDistance = Infinity;
  for (const chainIndex of chains) {
    const chain = index.graph.chains[chainIndex];
    if (chain === undefined) continue;
    const nearest = nearestPointOnPolyline(point, chain.centreline, chain.closed);
    const distance = Math.hypot(nearest.x - point.x, nearest.y - point.y);
    if (distance < bestDistance) { bestDistance = distance; best = nearest; }
  }
  if (best === null || bestDistance < 1e-6) return null;
  const scale = Math.min(1, MAX_PULL / bestDistance) * weight;
  return { x: (best.x - point.x) * scale, y: (best.y - point.y) * scale };
}

/** 1 inside the road; falls to 0 at the edge of the cell toward a neighbour that is not road (or is a plaza). */
export function roadWeight(index: AlignmentIndex, position: TilePos, tx: number, ty: number): number {
  let weight = 1;
  const dx = position.tx - tx; const dy = position.ty - ty;
  for (const [offset, step] of [[dx, { x: Math.sign(dx), y: 0 }], [dy, { x: 0, y: Math.sign(dy) }]] as const) {
    if (Math.abs(offset) < 1e-9) continue;
    const nx = tx + step.x; const ny = ty + step.y;
    const neighbour = nx < 0 || ny < 0 || nx >= index.width || ny >= index.height ? 0 : index.road[ny * index.width + nx] as number;
    if (neighbour === 0 || neighbour === 2) weight = Math.min(weight, Math.max(0, 1 - Math.abs(offset) / 0.5));
  }
  return weight;
}
