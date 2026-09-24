// Shared primitives for the derived boundary layer. Nothing here is saved or read by rules: every value is a pure
// function of tile state, so the same state always yields the same geometry regardless of iteration order.
//
// Coordinates are tile-centre coordinates (render/iso.ts convention): tile (tx,ty) is centred on the integer point
// (tx,ty) and covers the square [tx-0.5, tx+0.5] x [ty-0.5, ty+0.5]. Tile edges therefore lie on half-integers.

export type BoundaryPoint = { readonly x: number; readonly y: number };
export type BoundaryBounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/**
 * One key per tile edge, shared by the two tiles that meet there (Fable F4: boundary data is owned by the edge,
 * not by a tile + direction). The grid is padded by one tile so edges on the map border also have keys.
 * axis 1 = the edge between (tx,ty) and (tx+1,ty); axis 2 = the edge between (tx,ty) and (tx,ty+1).
 */
export function boundaryEdgeKey(width: number, tx: number, ty: number, dx: number, dy: number): number {
  const minTx = dx < 0 ? tx - 1 : tx;
  const minTy = dy < 0 ? ty - 1 : ty;
  const axis = dx !== 0 ? 1 : 2;
  return ((minTy + 1) * (width + 2) + (minTx + 1)) * 3 + axis;
}

/** Deterministic 32-bit hash of an edge (or any integer key); seed and salt pick independent streams. */
export function boundaryHash(key: number, seed: number, salt: number): number {
  let hash = Math.imul(key ^ 0x9e37_79b9, 73_856_093) ^ Math.imul(seed + 101_111, 19_349_663) ^ Math.imul(salt + 7, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  return (hash ^ (hash >>> 15)) >>> 0;
}

/** FNV-1a over numbers; used for content keys of derived geometry. */
export function hashNumbers(values: readonly number[], start = 2_166_136_261): number {
  let hash = start >>> 0;
  for (const value of values) {
    const scaled = Math.round(value * 1024);
    hash = Math.imul(hash ^ (scaled & 0xffff), 16_777_619) >>> 0;
    hash = Math.imul(hash ^ ((scaled >>> 16) & 0xffff), 16_777_619) >>> 0;
  }
  return hash;
}

/** Symmetric moving average whose window shrinks near the ends, so both ends stay exactly pinned. */
export function pinnedMovingAverage(points: readonly BoundaryPoint[], size: number): BoundaryPoint[] {
  const half = Math.floor(size / 2);
  const last = points.length - 1;
  return points.map((point, index) => {
    const reach = Math.min(half, index, last - index);
    if (reach === 0) return point;
    let sumX = 0; let sumY = 0;
    for (let offset = -reach; offset <= reach; offset += 1) {
      const sample = points[index + offset] ?? point;
      sumX += sample.x; sumY += sample.y;
    }
    return { x: sumX / (reach * 2 + 1), y: sumY / (reach * 2 + 1) };
  });
}

/** Moving average around a closed loop (no pinned point, so a ring road has no arbitrary seam). */
export function cyclicMovingAverage(points: readonly BoundaryPoint[], size: number): BoundaryPoint[] {
  const half = Math.min(Math.floor(size / 2), Math.floor((points.length - 1) / 2));
  const count = points.length;
  return points.map((point, index) => {
    let sumX = 0; let sumY = 0;
    for (let offset = -half; offset <= half; offset += 1) {
      const sample = points[(index + offset + count) % count] ?? point;
      sumX += sample.x; sumY += sample.y;
    }
    return { x: sumX / (half * 2 + 1), y: sumY / (half * 2 + 1) };
  });
}

/** Chaikin corner cutting (0.25/0.75) with both ends pinned. Output stays in the input's convex hull. */
export function chaikinOpen(points: readonly BoundaryPoint[], rounds: number): BoundaryPoint[] {
  let current = [...points];
  for (let round = 0; round < rounds && current.length > 2; round += 1) {
    const next: BoundaryPoint[] = [current[0] as BoundaryPoint];
    for (let index = 0; index < current.length - 1; index += 1) {
      const a = current[index] as BoundaryPoint; const b = current[index + 1] as BoundaryPoint;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
        { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(current[current.length - 1] as BoundaryPoint);
    current = next;
  }
  return current;
}

export function chaikinClosed(points: readonly BoundaryPoint[], rounds: number): BoundaryPoint[] {
  let current = [...points];
  for (let round = 0; round < rounds && current.length > 2; round += 1) {
    const next: BoundaryPoint[] = [];
    for (let index = 0; index < current.length; index += 1) {
      const a = current[index] as BoundaryPoint; const b = current[(index + 1) % current.length] as BoundaryPoint;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
        { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    current = next;
  }
  return current;
}

export function boundsOf(points: readonly BoundaryPoint[], margin = 0): BoundaryBounds {
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const point of points) {
    left = Math.min(left, point.x); right = Math.max(right, point.x);
    top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
  }
  return { left: left - margin, top: top - margin, right: right + margin, bottom: bottom + margin };
}

export function distanceToSegment(point: BoundaryPoint, a: BoundaryPoint, b: BoundaryPoint): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

/** Nearest point on a closed or open polyline. */
export function nearestPointOnPolyline(point: BoundaryPoint, line: readonly BoundaryPoint[], closed: boolean): BoundaryPoint {
  let best = line[0] ?? point; let bestDistance = Infinity;
  const segments = closed ? line.length : line.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % line.length] as BoundaryPoint;
    const dx = b.x - a.x; const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
    const candidate = { x: a.x + dx * t, y: a.y + dy * t };
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < bestDistance) { bestDistance = distance; best = candidate; }
  }
  return best;
}

/**
 * Nearest point on the part of a closed Chaikin-smoothed loop that came from vertex `index` of the unsmoothed loop.
 * After `rounds` closed Chaikin rounds, vertex i's corner is cut by the points around index i * 2^rounds, so the
 * search only visits that window (the whole-loop search was quadratic on long forest edges).
 */
export function nearestPointNearVertex(point: BoundaryPoint, smoothed: readonly BoundaryPoint[], index: number, rounds: number): BoundaryPoint {
  const count = smoothed.length;
  if (count < 2) return smoothed[0] ?? point;
  const scale = 2 ** rounds;
  const span: BoundaryPoint[] = [];
  for (let offset = -scale; offset <= scale; offset += 1) span.push(smoothed[(((index * scale + offset) % count) + count) % count] as BoundaryPoint);
  return nearestPointOnPolyline(point, span, false);
}

/** Distance from a point to the square of tile (tx,ty); 0 inside. */
export function distanceToCell(point: BoundaryPoint, tx: number, ty: number): number {
  return Math.hypot(Math.max(0, Math.abs(point.x - tx) - 0.5), Math.max(0, Math.abs(point.y - ty) - 0.5));
}
