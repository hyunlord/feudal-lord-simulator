import { boundsOf, chaikinClosed, chaikinOpen, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";

// Zone outlines (C1b) on the shared-edge principle (Fable F4, D1a boundaryEdgeKey): the boundary between two
// labelled regions is owned by the edge, not by either region. Every tile edge whose two cells carry different
// labels (a zone index, or -1 for no zone / off the map) is a boundary edge. Edges are joined into chains between
// pinned lattice corners (three or more boundary edges meet there: a triple point, or a diagonal saddle), and each
// chain is smoothed once (Chaikin x2, ends pinned). A zone's fill rings are stitched from those same smoothed
// chains, so two neighbouring zones share their line exactly: no double line, no gap, no overlap.
//
// Coordinates are tile-centre coordinates (render/iso.ts): tile (tx,ty) spans [tx-0.5, tx+0.5]; lattice corner
// (cx,cy) is the point (cx-0.5, cy-0.5). Pure function of the label grid, so tile enumeration order never matters.

export const ZONE_OUTLINE_CHAIKIN_ROUNDS = 2;

export type ZoneBoundaryChain = {
  /** The labels on either side (lower first); -1 is "no zone". */
  readonly labels: readonly [number, number];
  readonly points: readonly BoundaryPoint[];
  readonly closed: boolean;
  /** Number of tile edges the chain covers (each boundary edge is in exactly one chain). */
  readonly edges: number;
  readonly bounds: BoundaryBounds;
  readonly hash: number;
};

export type ZoneBoundaryLayout = {
  readonly chains: readonly ZoneBoundaryChain[];
  /** Per label (zone index): closed rings, outer boundaries and holes alike (fill with even-odd). */
  readonly rings: readonly (readonly (readonly BoundaryPoint[])[])[];
};

export type ZoneLabelGrid = {
  readonly width: number;
  readonly height: number;
  /** Label per cell (ty * width + tx): zone index 0..n-1, or -1. */
  readonly labels: Int32Array;
  readonly zoneCount: number;
};

// Directions around a corner: 0 = up (toward cy-1), 1 = right, 2 = down, 3 = left.
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

export function zoneBoundaryLayout(grid: ZoneLabelGrid): ZoneBoundaryLayout {
  const { width, height, labels } = grid;
  const label = (tx: number, ty: number): number => tx < 0 || ty < 0 || tx >= width || ty >= height ? -1 : labels[ty * width + tx] as number;
  const cornerStride = width + 1;
  const corner = (cx: number, cy: number): number => cy * cornerStride + cx;
  // The two cells on either side of the lattice edge leaving corner (cx,cy) in direction d, left cell first
  // (left of travel, y down).
  const sides = (cx: number, cy: number, d: number): readonly [number, number] => {
    switch (d) {
      case 0: return [label(cx - 1, cy - 1), label(cx, cy - 1)];
      case 1: return [label(cx, cy - 1), label(cx, cy)];
      case 2: return [label(cx, cy), label(cx - 1, cy)];
      default: return [label(cx - 1, cy), label(cx - 1, cy - 1)];
    }
  };
  const isBoundary = (cx: number, cy: number, d: number): boolean => {
    const nx = cx + DX[d]!; const ny = cy + DY[d]!;
    if (nx < 0 || ny < 0 || nx > width || ny > height) return false;
    const [a, b] = sides(cx, cy, d);
    return a !== b;
  };
  const edgeKey = (cx: number, cy: number, d: number): number => {
    // Undirected: normalise to the edge leaving the smaller corner (right or down).
    if (d === 0) return corner(cx, cy - 1) * 2 + 1;
    if (d === 3) return corner(cx - 1, cy) * 2;
    return corner(cx, cy) * 2 + (d === 1 ? 0 : 1);
  };
  const degree = (cx: number, cy: number): number => [0, 1, 2, 3].filter(d => isBoundary(cx, cy, d)).length;

  const edgeChain = new Map<number, { chain: number; index: number }>();
  const chainCorners: { cx: number; cy: number }[][] = [];
  const chainClosed: boolean[] = [];
  const walk = (cx: number, cy: number, d: number, stopAtStart: boolean): { cx: number; cy: number }[] => {
    const path = [{ cx, cy }];
    let x = cx; let y = cy; let dir = d;
    const chainIndex = chainCorners.length;
    for (;;) {
      edgeChain.set(edgeKey(x, y, dir), { chain: chainIndex, index: path.length - 1 });
      x += DX[dir]!; y += DY[dir]!;
      path.push({ cx: x, cy: y });
      if ((stopAtStart && x === cx && y === cy) || (!stopAtStart && degree(x, y) !== 2)) break;
      const back = (dir + 2) % 4;
      const next = [0, 1, 2, 3].find(candidate => candidate !== back && isBoundary(x, y, candidate) && !edgeChain.has(edgeKey(x, y, candidate)));
      if (next === undefined) break;
      dir = next;
    }
    return path;
  };
  for (let cy = 0; cy <= height; cy += 1) for (let cx = 0; cx <= width; cx += 1) {
    if (degree(cx, cy) <= 2) continue;
    for (const d of [0, 1, 2, 3]) {
      if (!isBoundary(cx, cy, d) || edgeChain.has(edgeKey(cx, cy, d))) continue;
      chainCorners.push(walk(cx, cy, d, false)); chainClosed.push(false);
    }
  }
  // Loops with no pinned corner start at their smallest corner (row-major) and leave it in the first direction.
  for (let cy = 0; cy <= height; cy += 1) for (let cx = 0; cx <= width; cx += 1) {
    for (const d of [0, 1, 2, 3]) {
      if (!isBoundary(cx, cy, d) || edgeChain.has(edgeKey(cx, cy, d))) continue;
      const path = walk(cx, cy, d, true);
      chainCorners.push(path); chainClosed.push(true);
    }
  }

  const toPoint = (c: { cx: number; cy: number }): BoundaryPoint => ({ x: c.cx - 0.5, y: c.cy - 0.5 });
  const chains: ZoneBoundaryChain[] = chainCorners.map((path, index) => {
    const first = path[0]!; const second = path[1]!;
    const d = [0, 1, 2, 3].find(candidate => first.cx + DX[candidate]! === second.cx && first.cy + DY[candidate]! === second.cy) ?? 0;
    const [a, b] = sides(first.cx, first.cy, d);
    const closed = chainClosed[index] === true;
    const raw = (closed ? path.slice(0, -1) : path).map(toPoint);
    const points = closed ? chaikinClosed(raw, ZONE_OUTLINE_CHAIKIN_ROUNDS) : chaikinOpen(raw, ZONE_OUTLINE_CHAIKIN_ROUNDS);
    return { labels: [Math.min(a, b), Math.max(a, b)], points, closed, edges: path.length - 1, bounds: boundsOf(points, 0), hash: hashNumbers([a, b, closed ? 1 : 0, ...raw.flatMap(p => [p.x, p.y])]) };
  });

  // Rings: walk each zone's boundary with the zone on the left; at a saddle take the tightest turn so diagonal
  // cells stay separate (4-connected, like the rules; tightest turn first). Each run along one chain appends that chain's smoothed points.
  const rings: BoundaryPoint[][][] = Array.from({ length: grid.zoneCount }, () => []);
  const used = new Set<string>();
  for (let cy = 0; cy <= height; cy += 1) for (let cx = 0; cx <= width; cx += 1) {
    for (const d of [0, 1, 2, 3]) {
      if (!isBoundary(cx, cy, d)) continue;
      const zone = sides(cx, cy, d)[0];
      if (zone < 0 || used.has(`${cx},${cy},${d}`)) continue;
      // Start only where a chain run starts (its end corner), so every run is appended whole.
      const startAt = edgeChain.get(edgeKey(cx, cy, d));
      if (startAt === undefined) continue;
      if (!chainClosed[startAt.chain]) {
        const path = chainCorners[startAt.chain]!;
        const isEnd = (path[0]!.cx === cx && path[0]!.cy === cy) || (path[path.length - 1]!.cx === cx && path[path.length - 1]!.cy === cy);
        if (!isEnd) continue;
      }
      const ring: BoundaryPoint[] = [];
      let x = cx; let y = cy; let dir = d;
      for (let guard = 0; guard < (width + 1) * (height + 1) * 4; guard += 1) {
        const at = edgeChain.get(edgeKey(x, y, dir));
        if (at === undefined) break;
        const path = chainCorners[at.chain]!;
        const forward = path[at.index]!.cx === x && path[at.index]!.cy === y;
        const smooth = chains[at.chain]!.points;
        // Mark every half-edge of this chain run as used, then continue from the run's far end.
        const steps = path.length - 1;
        let endX: number; let endY: number; let endDir = dir;
        if (chainClosed[at.chain]) {
          const points = forward ? smooth : [...smooth].reverse();
          ring.push(...points);
          for (let k = 0; k < steps; k += 1) {
            const from = forward ? path[k]! : path[steps - k]!; const to = forward ? path[k + 1]! : path[steps - k - 1]!;
            used.add(`${from.cx},${from.cy},${directionOf(from, to)}`);
          }
          break;
        }
        const points = forward ? smooth : [...smooth].reverse();
        ring.push(...(ring.length === 0 ? points : points.slice(1)));
        for (let k = 0; k < steps; k += 1) {
          const from = forward ? path[k]! : path[steps - k]!; const to = forward ? path[k + 1]! : path[steps - k - 1]!;
          used.add(`${from.cx},${from.cy},${directionOf(from, to)}`);
          endDir = directionOf(from, to);
        }
        const end = forward ? path[steps]! : path[0]!;
        endX = end.cx; endY = end.cy;
        // Next half-edge out of the end corner with the zone on its left: the tightest (left) turn first, so a
        // diagonal saddle never joins two cells that only touch at a corner.
        const next = [(endDir + 3) % 4, endDir, (endDir + 1) % 4].find(candidate => isBoundary(endX, endY, candidate) && sides(endX, endY, candidate)[0] === zone);
        if (next === undefined) break;
        x = endX; y = endY; dir = next;
        if (x === cx && y === cy && dir === d) { ring.pop(); break; }
      }
      if (ring.length >= 3) rings[zone]!.push(ring);
    }
  }
  return { chains, rings };
}

function directionOf(from: { cx: number; cy: number }, to: { cx: number; cy: number }): number {
  if (to.cy < from.cy) return 0;
  if (to.cx > from.cx) return 1;
  if (to.cy > from.cy) return 2;
  return 3;
}
