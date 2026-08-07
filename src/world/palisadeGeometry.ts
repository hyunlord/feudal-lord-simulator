import { getTile, type Grid } from "./grid";

export type TileEdgePoint = {
  readonly x: number;
  readonly y: number;
};

export type PalisadeFootprint = {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
};

export type PalisadePath = readonly TileEdgePoint[];

export type PalisadeFailureReason =
  | "no_footprints"
  | "collinear_footprints"
  | "open_polygon"
  | "self_intersection"
  | "out_of_bounds"
  | "water_crossing"
  | "insufficient_enclosure"
  | "empty_perimeter";

export type PalisadeRun = {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly direction: TileEdgePoint;
  readonly normal: TileEdgePoint;
  readonly steps: number;
};

export type ValidPalisadeCandidate = {
  readonly path: PalisadePath;
  readonly runs: readonly PalisadeRun[];
  readonly perimeterSteps: number;
  readonly enclosedFootprints: number;
  readonly enclosureRatio: number;
};

export type PalisadeProposalResult =
  | { readonly ok: true; readonly path: PalisadePath; readonly runs: readonly PalisadeRun[]; readonly perimeterSteps: number }
  | { readonly ok: false; readonly reason: PalisadeFailureReason };

export type PalisadeValidationResult =
  | { readonly ok: true; readonly candidate: ValidPalisadeCandidate }
  | { readonly ok: false; readonly reason: PalisadeFailureReason };

export type PalisadeDragResult =
  | { readonly ok: true; readonly candidate: ValidPalisadeCandidate }
  | { readonly ok: false; readonly reason: PalisadeFailureReason; readonly lastValid: ValidPalisadeCandidate };

const CARDINAL_AND_DIAGONAL_STEPS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
] as const satisfies readonly TileEdgePoint[];

const PROPOSAL_MARGIN_TILES = 3;

type ProposalClearance = {
  readonly footprints: readonly PalisadeFootprint[];
  readonly margin: number;
};

function samePoint(a: TileEdgePoint, b: TileEdgePoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function pointKey(point: TileEdgePoint): string {
  return `${point.x},${point.y}`;
}

function comparePoints(a: TileEdgePoint, b: TileEdgePoint): number {
  return a.x === b.x ? a.y - b.y : a.x - b.x;
}

function cross(origin: TileEdgePoint, a: TileEdgePoint, b: TileEdgePoint): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function stepDirection(from: TileEdgePoint, to: TileEdgePoint): TileEdgePoint {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
}

function segmentSteps(from: TileEdgePoint, to: TileEdgePoint): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

function pathArea(path: PalisadePath): number {
  let area = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    if (current === undefined || next === undefined) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function isClosed(path: PalisadePath): boolean {
  const first = path[0];
  const last = path[path.length - 1];
  return first !== undefined && last !== undefined && path.length >= 4 && samePoint(first, last);
}

export function footprintCorners(footprint: PalisadeFootprint): readonly TileEdgePoint[] {
  return [
    { x: footprint.tx, y: footprint.ty },
    { x: footprint.tx + footprint.width, y: footprint.ty },
    { x: footprint.tx + footprint.width, y: footprint.ty + footprint.height },
    { x: footprint.tx, y: footprint.ty + footprint.height },
  ];
}

export function convexHull(points: readonly TileEdgePoint[]): readonly TileEdgePoint[] {
  const unique = [...new Map(points.map((point) => [pointKey(point), point])).values()].sort(comparePoints);
  if (unique.length <= 1) return unique;

  const lower: TileEdgePoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2) {
      const previous = lower[lower.length - 1];
      const beforePrevious = lower[lower.length - 2];
      if (previous === undefined || beforePrevious === undefined || cross(beforePrevious, previous, point) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: TileEdgePoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    if (point === undefined) continue;
    while (upper.length >= 2) {
      const previous = upper[upper.length - 1];
      const beforePrevious = upper[upper.length - 2];
      if (previous === undefined || beforePrevious === undefined || cross(beforePrevious, previous, point) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }

  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function clockwisePath(vertices: readonly TileEdgePoint[]): PalisadePath {
  const closed = isClosed(vertices) ? vertices : [...vertices, vertices[0]].filter((point): point is TileEdgePoint => point !== undefined);
  return pathArea(closed) >= 0 ? closed : [...closed].reverse();
}

function expandedFootprintCorners(footprint: PalisadeFootprint, margin: number): readonly TileEdgePoint[] {
  return [
    { x: footprint.tx - margin, y: footprint.ty - margin },
    { x: footprint.tx + footprint.width + margin, y: footprint.ty - margin },
    { x: footprint.tx + footprint.width + margin, y: footprint.ty + footprint.height + margin },
    { x: footprint.tx - margin, y: footprint.ty + footprint.height + margin },
  ];
}

function rasterSegment(from: TileEdgePoint, to: TileEdgePoint): readonly TileEdgePoint[] {
  const points: TileEdgePoint[] = [from];
  let current = from;
  while (!samePoint(current, to)) {
    const next = { x: current.x + Math.sign(to.x - current.x), y: current.y + Math.sign(to.y - current.y) };
    points.push(next);
    current = next;
  }
  return points;
}

function simplifyPath(path: PalisadePath): PalisadePath {
  if (path.length <= 2) return path;
  const openPath = isClosed(path) ? path.slice(0, -1) : [...path];
  const simplified: TileEdgePoint[] = [];
  for (const point of openPath) {
    const previous = simplified[simplified.length - 1];
    if (previous !== undefined && samePoint(previous, point)) continue;
    simplified.push(point);
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3];
      const b = simplified[simplified.length - 2];
      const c = simplified[simplified.length - 1];
      if (a === undefined || b === undefined || c === undefined) break;
      if (cross(a, b, c) !== 0) break;
      simplified.splice(simplified.length - 2, 1);
    }
  }
  const first = simplified[0];
  return first === undefined ? [] : [...simplified, first];
}

function edgeInBounds(grid: Grid, point: TileEdgePoint): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.y >= 0 && point.x <= grid.width && point.y <= grid.height;
}

function isWaterTile(grid: Grid, tx: number, ty: number): boolean {
  return getTile(grid, { tx, ty })?.terrain === "water";
}

function clearanceFromFootprint(point: TileEdgePoint, footprint: PalisadeFootprint): number {
  const right = footprint.tx + footprint.width;
  const bottom = footprint.ty + footprint.height;
  const dx = point.x < footprint.tx ? footprint.tx - point.x : point.x > right ? point.x - right : 0;
  const dy = point.y < footprint.ty ? footprint.ty - point.y : point.y > bottom ? point.y - bottom : 0;
  return Math.max(dx, dy);
}

function hasProposalClearance(point: TileEdgePoint, clearance: ProposalClearance | null): boolean {
  return clearance === null || clearance.footprints.every((footprint) => clearanceFromFootprint(point, footprint) >= clearance.margin);
}

function hasWaterMoat(grid: Grid, footprint: PalisadeFootprint): boolean {
  const perimeterTiles: TileEdgePoint[] = [];
  for (let tx = footprint.tx - 1; tx <= footprint.tx + footprint.width; tx += 1) {
    perimeterTiles.push({ x: tx, y: footprint.ty - 1 }, { x: tx, y: footprint.ty + footprint.height });
  }
  for (let ty = footprint.ty; ty < footprint.ty + footprint.height; ty += 1) {
    perimeterTiles.push({ x: footprint.tx - 1, y: ty }, { x: footprint.tx + footprint.width, y: ty });
  }
  const inBounds = perimeterTiles.filter((point) => getTile(grid, { tx: point.x, ty: point.y }) !== null);
  return inBounds.length > 0 && inBounds.every((point) => isWaterTile(grid, point.x, point.y));
}

function diagonalInteriorCell(from: TileEdgePoint, to: TileEdgePoint): TileEdgePoint | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return null;
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) };
}

function stepCrossesWater(grid: Grid, from: TileEdgePoint, to: TileEdgePoint): boolean {
  const interior = diagonalInteriorCell(from, to);
  return interior !== null && isWaterTile(grid, interior.x, interior.y);
}

function edgeCrossesWater(grid: Grid, from: TileEdgePoint, to: TileEdgePoint): boolean {
  const raster = rasterSegment(from, to);
  for (let index = 1; index < raster.length; index += 1) {
    const previous = raster[index - 1];
    const current = raster[index];
    if (previous !== undefined && current !== undefined && stepCrossesWater(grid, previous, current)) return true;
  }
  return false;
}

function routeEdge(
  grid: Grid,
  from: TileEdgePoint,
  to: TileEdgePoint,
  clearance: ProposalClearance | null,
): readonly TileEdgePoint[] | null {
  const direct = rasterSegment(from, to);
  if (!edgeCrossesWater(grid, from, to) && direct.every((point) => hasProposalClearance(point, clearance))) return direct;
  const margin = Math.max(6, segmentSteps(from, to) + 3);
  const minX = Math.max(0, Math.min(from.x, to.x) - margin);
  const maxX = Math.min(grid.width, Math.max(from.x, to.x) + margin);
  const minY = Math.max(0, Math.min(from.y, to.y) - margin);
  const maxY = Math.min(grid.height, Math.max(from.y, to.y) + margin);
  const queue: readonly TileEdgePoint[][] = [[from]];
  const visited = new Set([pointKey(from)]);
  const paths: TileEdgePoint[][] = [...queue];

  for (let cursor = 0; cursor < paths.length; cursor += 1) {
    const path = paths[cursor];
    const current = path?.[path.length - 1];
    if (path === undefined || current === undefined) continue;
    if (samePoint(current, to)) return path;
    for (const step of CARDINAL_AND_DIAGONAL_STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) continue;
      if (!edgeInBounds(grid, next) || stepCrossesWater(grid, current, next) || !hasProposalClearance(next, clearance)) continue;
      const key = pointKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      paths.push([...path, next]);
    }
  }
  return null;
}

function routeClosedPath(
  grid: Grid,
  vertices: readonly TileEdgePoint[],
  clearance: ProposalClearance | null = null,
): PalisadePath | null {
  const closed = clockwisePath(vertices);
  const routed: TileEdgePoint[] = [];
  for (let index = 1; index < closed.length; index += 1) {
    const previous = closed[index - 1];
    const current = closed[index];
    if (previous === undefined || current === undefined) continue;
    const segment = routeEdge(grid, previous, current, clearance);
    if (segment === null) return null;
    routed.push(...(routed.length === 0 ? segment : segment.slice(1)));
  }
  return simplifyPath(routed);
}

export function palisadePerimeterSteps(path: PalisadePath): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous !== undefined && current !== undefined) total += segmentSteps(previous, current);
  }
  return total;
}

function segmentIntersects(a: TileEdgePoint, b: TileEdgePoint, c: TileEdgePoint, d: TileEdgePoint): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return Math.sign(abC) !== Math.sign(abD) && Math.sign(cdA) !== Math.sign(cdB);
}

function hasSelfIntersection(path: PalisadePath): boolean {
  for (let aIndex = 0; aIndex < path.length - 1; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < path.length - 1; bIndex += 1) {
      if (Math.abs(aIndex - bIndex) <= 1) continue;
      if (aIndex === 0 && bIndex === path.length - 2) continue;
      const a = path[aIndex];
      const b = path[aIndex + 1];
      const c = path[bIndex];
      const d = path[bIndex + 1];
      if (a !== undefined && b !== undefined && c !== undefined && d !== undefined && segmentIntersects(a, b, c, d)) return true;
    }
  }
  return false;
}

function isPointOnSegment(point: TileEdgePoint, a: TileEdgePoint, b: TileEdgePoint): boolean {
  return cross(a, b, point) === 0 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
}

export function isPointInsidePalisade(point: TileEdgePoint, path: PalisadePath): boolean {
  let inside = false;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    if (a === undefined || b === undefined) continue;
    if (isPointOnSegment(point, a, b)) return true;
    const crossesRay = (a.y > point.y) !== (b.y > point.y);
    const xAtY = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x;
    if (crossesRay && point.x < xAtY) inside = !inside;
  }
  return inside;
}

function enclosedCount(path: PalisadePath, footprints: readonly PalisadeFootprint[]): number {
  return footprints.filter((footprint) => footprintCorners(footprint).every((corner) => isPointInsidePalisade(corner, path))).length;
}

function runNormal(path: PalisadePath, direction: TileEdgePoint): TileEdgePoint {
  const clockwise = pathArea(path) >= 0;
  return clockwise ? { x: direction.y, y: -direction.x } : { x: -direction.y, y: direction.x };
}

function runsForPath(path: PalisadePath): readonly PalisadeRun[] {
  const runs: PalisadeRun[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous === undefined || current === undefined) continue;
    const direction = stepDirection(previous, current);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.direction.x === direction.x && last.direction.y === direction.y) {
      runs[runs.length - 1] = { ...last, endIndex: index, steps: last.steps + segmentSteps(previous, current) };
    } else {
      runs.push({ startIndex: index - 1, endIndex: index, direction, normal: runNormal(path, direction), steps: segmentSteps(previous, current) });
    }
  }
  return runs;
}

export function validatePalisadeCandidate(
  grid: Grid,
  path: PalisadePath,
  footprints: readonly PalisadeFootprint[],
): PalisadeValidationResult {
  if (!isClosed(path)) return { ok: false, reason: "open_polygon" };
  if (path.some((point) => !edgeInBounds(grid, point))) return { ok: false, reason: "out_of_bounds" };
  if (hasSelfIntersection(path)) return { ok: false, reason: "self_intersection" };
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous !== undefined && current !== undefined && edgeCrossesWater(grid, previous, current)) return { ok: false, reason: "water_crossing" };
  }
  const perimeterSteps = palisadePerimeterSteps(path);
  if (perimeterSteps <= 0) return { ok: false, reason: "empty_perimeter" };
  const enclosedFootprints = enclosedCount(path, footprints);
  const enclosureRatio = footprints.length === 0 ? 0 : enclosedFootprints / footprints.length;
  if (enclosureRatio < 0.6) return { ok: false, reason: "insufficient_enclosure" };
  return { ok: true, candidate: { path: simplifyPath(path), runs: runsForPath(simplifyPath(path)), perimeterSteps, enclosedFootprints, enclosureRatio } };
}

export function computePalisadeProposal(
  grid: Grid,
  footprints: readonly PalisadeFootprint[],
): PalisadeProposalResult {
  if (footprints.length === 0) return { ok: false, reason: "no_footprints" };
  if (footprints.some((footprint) => hasWaterMoat(grid, footprint))) return { ok: false, reason: "water_crossing" };
  const hull = convexHull(footprints.flatMap((footprint) => expandedFootprintCorners(footprint, PROPOSAL_MARGIN_TILES)));
  if (hull.length < 2) return { ok: false, reason: "collinear_footprints" };
  const routed = routeClosedPath(grid, hull, { footprints, margin: PROPOSAL_MARGIN_TILES });
  if (routed === null) return { ok: false, reason: "water_crossing" };
  const validation = validatePalisadeCandidate(grid, routed, footprints);
  if (!validation.ok) return validation;
  return { ok: true, path: validation.candidate.path, runs: validation.candidate.runs, perimeterSteps: validation.candidate.perimeterSteps };
}

export function dragPalisadeRun(
  grid: Grid,
  candidate: ValidPalisadeCandidate,
  runIndex: number,
  wholeSteps: number,
  footprints: readonly PalisadeFootprint[],
): PalisadeDragResult {
  const run = candidate.runs[runIndex];
  if (run === undefined || wholeSteps === 0) return { ok: true, candidate };
  const moved = candidate.path.map((point, index) => {
    if (index !== run.startIndex && index !== run.endIndex) return point;
    return { x: point.x + run.normal.x * wholeSteps, y: point.y + run.normal.y * wholeSteps };
  });
  const routed = routeClosedPath(grid, moved.slice(0, -1));
  const validation: PalisadeValidationResult =
    routed === null ? { ok: false, reason: "water_crossing" } : validatePalisadeCandidate(grid, routed, footprints);
  if (!validation.ok) return { ok: false, reason: validation.reason, lastValid: candidate };
  return { ok: true, candidate: validation.candidate };
}
