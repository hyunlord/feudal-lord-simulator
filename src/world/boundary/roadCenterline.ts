import { canTraverseRoadBoundary } from "../bridges";
import { isPointInsidePalisade, type PalisadePath } from "../palisadeGeometry";
import { wallGatePoints, type WallBoundary } from "../wallTraversal";
import type { Tile } from "../world.types";
import {
  chaikinClosed,
  chaikinOpen,
  cyclicMovingAverage,
  distanceToCell,
  hashNumbers,
  pinnedMovingAverage,
  type BoundaryPoint,
} from "./boundaryGeometry";
import { cellContourLoops, type CellContourLoop } from "./cellContours";

// Road centreline graph derived from the 4-connected road cells (SYNTHESIS: cells stay the road truth; the curve is
// only drawn). Junctions (degree >= 3), dead ends, gate cells, bridge banks and plaza cells are fixed points; the
// chains between them are smoothed with a moving average of 5 cells then Chaikin x2 (v3-A probe P1, "S2").
// Smoothing never touches the fixed points, and every smoothed vertex is pulled back to within
// ROAD_VERTEX_TOLERANCE of its own cell so the whole centreline stays inside the road cells + that margin
// (the union of two adjacent cells grown by r is convex, so segments and Chaikin points inherit the bound).

export const ROAD_SMOOTHING_WINDOW = 5;
export const ROAD_CHAIKIN_ROUNDS = 2;
export const ROAD_VERTEX_TOLERANCE = 0.2;

export type RoadMaterial = "earth" | "stone";
export type RoadCell = { readonly tx: number; readonly ty: number };
export type RoadFixedKind = "junction" | "dead_end" | "gate" | "bridge_bank" | "plaza" | "isolated";

export type RoadChain = {
  readonly cells: readonly RoadCell[];
  readonly closed: boolean;
  readonly materials: readonly RoadMaterial[];
  /** Smoothed centreline in tile-centre coordinates; open chains start/end exactly on their fixed cells. */
  readonly centreline: readonly BoundaryPoint[];
  readonly hash: number;
};

export type RoadFixedPoint = RoadCell & {
  readonly kinds: readonly RoadFixedKind[];
  readonly degree: number;
  readonly material: RoadMaterial;
  /** Unit directions (tile space) toward bridge decks that start at this bank cell. */
  readonly bridgeDirections: readonly BoundaryPoint[];
};

export type RoadCenterlineGraph = {
  readonly chains: readonly RoadChain[];
  readonly fixedPoints: readonly RoadFixedPoint[];
  readonly plazaLoops: readonly (CellContourLoop & { readonly smoothed: readonly BoundaryPoint[]; readonly material: RoadMaterial })[];
};

export type RoadCenterlineInput = {
  readonly width: number;
  readonly height: number;
  /** Any order; cells are re-indexed by coordinate. */
  readonly tiles: readonly Tile[];
  readonly palisade: (WallBoundary & { readonly polygon: PalisadePath }) | null;
};

const STEPS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }] as const;

export function roadCenterlineGraph(input: RoadCenterlineInput): RoadCenterlineGraph {
  const { width, height } = input;
  const cells: Tile[] = new Array(width * height);
  for (const tile of input.tiles) cells[tile.ty * width + tile.tx] = tile;
  const grid = { width, height, tiles: cells, palisade: input.palisade };
  const at = (tx: number, ty: number): Tile | undefined =>
    tx < 0 || ty < 0 || tx >= width || ty >= height ? undefined : cells[ty * width + tx];
  const isLand = (tx: number, ty: number): boolean => { const tile = at(tx, ty); return tile?.hasRoad === true && tile.terrain !== "water"; };
  const linked = (a: RoadCell, b: RoadCell): boolean => canTraverseRoadBoundary(grid, a, b);
  const landNeighbours = (tx: number, ty: number): RoadCell[] => STEPS
    .map(step => ({ tx: tx + step.dx, ty: ty + step.dy }))
    .filter(next => isLand(next.tx, next.ty) && linked({ tx, ty }, next));
  const bridgeDirections = (tx: number, ty: number): BoundaryPoint[] => STEPS
    .filter(step => { const next = at(tx + step.dx, ty + step.dy); return next?.hasRoad === true && next.terrain === "water" && linked({ tx, ty }, { tx: tx + step.dx, ty: ty + step.dy }); })
    .map(step => ({ x: step.dx, y: step.dy }));

  const stoneWall = input.palisade !== null && input.palisade.segments.some(segment => segment.completed);
  const materialOf = (tx: number, ty: number): RoadMaterial =>
    stoneWall && input.palisade !== null && isPointInsidePalisade({ x: tx + 0.5, y: ty + 0.5 }, input.palisade.polygon) ? "stone" : "earth";
  const gates = input.palisade === null ? [] : wallGatePoints(input.palisade);
  const isGateCell = (tx: number, ty: number): boolean =>
    gates.some(gate => Math.hypot(tx + 0.5 - gate.x, ty + 0.5 - gate.y) <= 0.75);

  const plaza = new Set<number>();
  for (let ty = 0; ty + 1 < height; ty += 1) for (let tx = 0; tx + 1 < width; tx += 1) {
    const block = [{ tx, ty }, { tx: tx + 1, ty }, { tx: tx + 1, ty: ty + 1 }, { tx, ty: ty + 1 }];
    if (!block.every(cell => isLand(cell.tx, cell.ty))) continue;
    if (!block.every((cell, index) => linked(cell, block[(index + 1) % 4] as RoadCell))) continue;
    for (const cell of block) plaza.add(cell.ty * width + cell.tx);
  }

  const landCells: RoadCell[] = [];
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) if (isLand(tx, ty)) landCells.push({ tx, ty });
  const neighbours = new Map<number, RoadCell[]>(landCells.map(cell => [cell.ty * width + cell.tx, landNeighbours(cell.tx, cell.ty)]));
  const fixed = new Map<number, RoadFixedPoint>();
  for (const cell of landCells) {
    const index = cell.ty * width + cell.tx;
    const degree = neighbours.get(index)?.length ?? 0;
    const bridges = bridgeDirections(cell.tx, cell.ty);
    const kinds: RoadFixedKind[] = [];
    if (degree === 0 && bridges.length === 0) kinds.push("isolated");
    else if (degree + bridges.length === 1) kinds.push("dead_end");
    if (degree >= 3) kinds.push("junction");
    if (bridges.length > 0) kinds.push("bridge_bank");
    if (isGateCell(cell.tx, cell.ty)) kinds.push("gate");
    if (plaza.has(index)) kinds.push("plaza");
    if (kinds.length === 0 && degree === 2) continue;
    if (kinds.length === 0) kinds.push("junction");
    fixed.set(index, { ...cell, kinds, degree, material: materialOf(cell.tx, cell.ty), bridgeDirections: bridges });
  }

  const visitedEdges = new Set<string>();
  const edgeId = (a: RoadCell, b: RoadCell): string => {
    const ia = a.ty * width + a.tx; const ib = b.ty * width + b.tx;
    return ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
  };
  const chains: RoadChain[] = [];
  const buildChain = (path: readonly RoadCell[], closed: boolean): void => {
    chains.push(smoothChain(path, closed, path.map(cell => materialOf(cell.tx, cell.ty))));
  };
  for (const start of [...fixed.values()]) {
    for (const first of neighbours.get(start.ty * width + start.tx) ?? []) {
      if (visitedEdges.has(edgeId(start, first))) continue;
      visitedEdges.add(edgeId(start, first));
      const path: RoadCell[] = [start, first];
      let previous: RoadCell = start; let current: RoadCell = first;
      while (!fixed.has(current.ty * width + current.tx)) {
        const next = (neighbours.get(current.ty * width + current.tx) ?? []).find(candidate => candidate.tx !== previous.tx || candidate.ty !== previous.ty);
        if (next === undefined) break;
        visitedEdges.add(edgeId(current, next));
        path.push(next); previous = current; current = next;
      }
      const bothPlaza = path.length === 2 && plaza.has(start.ty * width + start.tx) && plaza.has(current.ty * width + current.tx);
      if (!bothPlaza) buildChain(path, false);
    }
  }
  // Rings with no fixed cell: walk from the smallest cell toward its smaller neighbour; smoothing is cyclic, so
  // the start cell has no effect on the drawn curve.
  for (const cell of landCells) {
    if (fixed.has(cell.ty * width + cell.tx)) continue;
    const around = neighbours.get(cell.ty * width + cell.tx) ?? [];
    const first = around.find(next => !visitedEdges.has(edgeId(cell, next)));
    if (first === undefined) continue;
    const path: RoadCell[] = [cell];
    let previous: RoadCell = cell; let current: RoadCell = first;
    visitedEdges.add(edgeId(cell, first));
    while (current.tx !== cell.tx || current.ty !== cell.ty) {
      path.push(current);
      const next = (neighbours.get(current.ty * width + current.tx) ?? []).find(candidate => candidate.tx !== previous.tx || candidate.ty !== previous.ty);
      if (next === undefined) break;
      visitedEdges.add(edgeId(current, next));
      previous = current; current = next;
    }
    buildChain(path, true);
  }

  const plazaLoops = cellContourLoops({ width, height, inside: (tx, ty) => plaza.has(ty * width + tx), outside: false })
    .map(loop => {
      const cell = loop.insideCells[0] ?? { tx: 0, ty: 0 };
      return { ...loop, smoothed: chaikinClosed(loop.points, ROAD_CHAIKIN_ROUNDS), material: materialOf(cell.tx, cell.ty) };
    });
  return { chains, fixedPoints: [...fixed.values()], plazaLoops };
}

function smoothChain(cells: readonly RoadCell[], closed: boolean, materials: readonly RoadMaterial[]): RoadChain {
  const centres = cells.map(cell => ({ x: cell.tx, y: cell.ty }));
  const averaged = closed ? cyclicMovingAverage(centres, ROAD_SMOOTHING_WINDOW) : pinnedMovingAverage(centres, ROAD_SMOOTHING_WINDOW);
  const guarded = averaged.map((point, index) => pullIntoCell(point, cells[index] as RoadCell, ROAD_VERTEX_TOLERANCE));
  const centreline = closed ? chaikinClosed(guarded, ROAD_CHAIKIN_ROUNDS) : chaikinOpen(guarded, ROAD_CHAIKIN_ROUNDS);
  return {
    cells, closed, materials, centreline,
    hash: hashNumbers([closed ? 1 : 0, ...cells.flatMap((cell, index) => [cell.tx, cell.ty, materials[index] === "stone" ? 1 : 0])]),
  };
}

function pullIntoCell(point: BoundaryPoint, cell: RoadCell, tolerance: number): BoundaryPoint {
  const distance = distanceToCell(point, cell.tx, cell.ty);
  if (distance <= tolerance) return point;
  // Move toward the cell centre until the point is exactly `tolerance` outside the cell square.
  let low = 0; let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    const candidate = { x: point.x + (cell.tx - point.x) * mid, y: point.y + (cell.ty - point.y) * mid };
    if (distanceToCell(candidate, cell.tx, cell.ty) > tolerance) low = mid; else high = mid;
  }
  return { x: point.x + (cell.tx - point.x) * high, y: point.y + (cell.ty - point.y) * high };
}
