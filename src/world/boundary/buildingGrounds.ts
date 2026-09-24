import type { Tile } from "../world.types";
import { cellContourLoops } from "./cellContours";
import { boundsOf, distanceToSegment, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";
import type { RoadCenterlineGraph, RoadMaterial } from "./roadCenterline";

// Ground around buildings (C1d, asset spec 4.5): the adaptive layer between square footprints and curved roads.
// Pure function of (buildings, tiles, road centreline graph, ribbon width, wall polygon): nothing is saved or read by
// rules. Buildings never rotate; instead
//  - apron: from the footprint side with the most road contact (the frontage) to the road ribbon's visible edge, so no
//    grass wedge is left between a square house and a curved road. The far side tucks APRON_TUCK under the ribbon's
//    opaque band, so the ribbon's own soft edge makes the join. Normally <= APRON_TARGET_DEPTH deep (see APRON_MAX_DEPTH).
//  - yard: the footprint grown by YARD_GROWTH with rounded corners, then clipped by the road envelope (centreline +-
//    width / 2), water / rock / forest cells, the wall (a yard stays on its building's side, WALL_CLEARANCE off the
//    line), other footprints, and earlier yards (building order: the order buildings were completed, then id).
// Yards are sets of 1/8-tile subcells, so "no two yards overlap" is exact; their outlines are the marching-squares
// trace of those sets (monotone in the set, so disjoint sets give disjoint polygons).

export const YARD_GROWTH = 0.5;
export const YARD_CORNER_RADIUS = 0.35;
export const YARD_SUBCELLS = 8;
export const WALL_CLEARANCE = 0.15;
/**
 * Work order: "at most 0.5 tile". Where the curved ribbon runs along the far side of the contact cell (it cuts the
 * cell diagonally), stopping at 0.5 would leave the very grass wedge the apron exists to remove, so the apron may
 * follow the ribbon across the contact cell (and tuck under it just past); the report counts those samples (C1d gate 1).
 */
export const APRON_TARGET_DEPTH = 0.5;
export const APRON_MAX_DEPTH = 1.25;
/** How far the apron runs under the ribbon's visible edge: earth_strip-v1 is opaque from 0.108 tile inside it. */
export const APRON_TUCK = 0.12;
/** The apron starts this far inside the footprint, under the sprite's base. */
export const APRON_INSET = 0.1;
/**
 * The apron runs this much past both ends of the frontage run, a little more at the road side (a trapezoid, not a
 * box): the frontage rays at the very ends of the edge stay >= 1.5 px inside it at zoom 0.6, so no antialiased grass
 * sliver is left there.
 */
export const APRON_OVERHANG = 0.08;
export const APRON_FLARE = 0.08;
const APRON_SAMPLES_PER_TILE = 12;
const RAY_STEP = 1 / 64;
const RAY_REACH = 1;
/** The tucked ray may run past the contact cell: the ribbon's far half covers whatever it reaches there. */
const TUCK_REACH = RAY_REACH + 0.25;
const ROAD_DISTANCE_REACH = 0.75;

export type GroundBuilding = { readonly id: string; readonly tx: number; readonly ty: number; readonly width: number; readonly height: number;
  /** Road cells the rules count as this building's access (wall-aware), as `ty * mapWidth + tx`. */
  readonly roadAccess: readonly number[] };

export type BuildingYard = {
  readonly buildingId: string;
  /** Absolute subcell indexes (row-major over mapWidth * YARD_SUBCELLS), sorted. */
  readonly subcells: readonly number[];
  /** Row stride of `subcells` (mapWidth * YARD_SUBCELLS). */
  readonly subcellStride: number;
  readonly footprint: { readonly tx: number; readonly ty: number; readonly width: number; readonly height: number };
  /** Even-odd rings in tile-centre coordinates. */
  readonly rings: readonly (readonly BoundaryPoint[])[];
  readonly bounds: BoundaryBounds;
  readonly hash: number;
};

export type BuildingApron = {
  readonly buildingId: string;
  /** Outward normal of the frontage side (axis aligned). */
  readonly normal: BoundaryPoint;
  /** Frontage edge samples (on the footprint side) and the apron depth at each (tiles along `normal`). */
  readonly edge: readonly BoundaryPoint[];
  readonly depths: readonly number[];
  /** Distance to the ribbon's visible edge at each sample (null: none within RAY_REACH), for the wedge check. */
  readonly ribbonGaps: readonly (number | null)[];
  readonly polygon: readonly BoundaryPoint[];
  /** Paving of the contact road cells (stone if any of them is stone): the apron takes the ribbon's surface. */
  readonly material: RoadMaterial;
  readonly bounds: BoundaryBounds;
  readonly hash: number;
};

export type BuildingGrounds = {
  readonly yards: readonly BuildingYard[];
  readonly aprons: readonly BuildingApron[];
  /** Distance from a point to the nearest road centreline (exact up to 0.75; Infinity beyond or without roads). */
  readonly roadDistance: (point: BoundaryPoint) => number;
};

export type BuildingGroundsInput = {
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** Indexed by ty * mapWidth + tx. */
  readonly cells: readonly (Tile | undefined)[];
  /** In yard claim order. Wheat farms are left out by the caller (fields have their own edge, research F06). */
  readonly buildings: readonly GroundBuilding[];
  readonly graph: RoadCenterlineGraph;
  readonly ribbonWidth: number;
  /** Wall polygon in tile-centre coordinates (closed), or null. */
  readonly wall: readonly BoundaryPoint[] | null;
};

/** Frontage priority on ties: the two sides that face the camera first (+ty = south-west, +tx = south-east). */
const SIDES = [
  { normal: { x: 0, y: 1 } }, { normal: { x: 1, y: 0 } }, { normal: { x: -1, y: 0 } }, { normal: { x: 0, y: -1 } },
] as const;

export function buildingGrounds(input: BuildingGroundsInput): BuildingGrounds {
  const roadDistance = roadDistanceField(input.graph, input.mapWidth, input.mapHeight);
  const stone = new Set<number>();
  for (const chain of input.graph.chains) chain.cells.forEach((cell, index) => { if (chain.materials[index] === "stone") stone.add(cell.ty * input.mapWidth + cell.tx); });
  for (const point of input.graph.fixedPoints) if (point.material === "stone") stone.add(point.ty * input.mapWidth + point.tx);
  const half = input.ribbonWidth / 2;
  const claimed = new Set<number>();
  const footprintOwner = new Map<number, string>();
  for (const building of input.buildings) {
    for (let dy = 0; dy < building.height; dy += 1) for (let dx = 0; dx < building.width; dx += 1) {
      footprintOwner.set((building.ty + dy) * input.mapWidth + building.tx + dx, building.id);
    }
  }
  const yards: BuildingYard[] = [];
  const aprons: BuildingApron[] = [];
  for (const building of input.buildings) {
    const yard = buildingYard(input, building, roadDistance, half, claimed);
    if (yard !== null) yards.push(yard);
    const apron = buildingApron(input, building, roadDistance, half, footprintOwner, stone);
    if (apron !== null) aprons.push(apron);
  }
  return { yards, aprons, roadDistance };
}

function buildingYard(input: BuildingGroundsInput, building: GroundBuilding, roadDistance: (point: BoundaryPoint) => number,
  half: number, claimed: Set<number>): BuildingYard | null {
  const S = YARD_SUBCELLS;
  const left = building.tx - 0.5 - YARD_GROWTH; const top = building.ty - 0.5 - YARD_GROWTH;
  const right = building.tx + building.width - 0.5 + YARD_GROWTH; const bottom = building.ty + building.height - 0.5 + YARD_GROWTH;
  const nx = Math.round((right - left) * S); const ny = Math.round((bottom - top) * S);
  // Absolute subcell grid: subcell (i, j) spans [i / S - 0.5, (i + 1) / S - 0.5) on x (tile-centre coordinates).
  const i0 = Math.round((left + 0.5) * S); const j0 = Math.round((top + 0.5) * S);
  const stride = input.mapWidth * S;
  const centre = { x: building.tx + (building.width - 1) / 2, y: building.ty + (building.height - 1) / 2 };
  const insideWall = input.wall === null ? null : pointInPolygon(centre, input.wall);
  // The wall only clips yards it passes near (the whole yard is on one side otherwise).
  const nearWall = input.wall !== null
    && distanceToPolyline(centre, input.wall) < Math.hypot(building.width, building.height) / 2 + YARD_GROWTH + WALL_CLEARANCE + 0.5;
  const mask = new Uint8Array(nx * ny);
  const own = (tx: number, ty: number): boolean => tx >= building.tx && ty >= building.ty && tx < building.tx + building.width && ty < building.ty + building.height;
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    const ai = i0 + i; const aj = j0 + j;
    const point = { x: (ai + 0.5) / S - 0.5, y: (aj + 0.5) / S - 0.5 };
    const tx = Math.round(point.x); const ty = Math.round(point.y);
    if (tx < 0 || ty < 0 || tx >= input.mapWidth || ty >= input.mapHeight) continue;
    if (claimed.has(aj * stride + ai)) continue;
    if (own(tx, ty)) { mask[j * nx + i] = 1; continue; }
    if (!insideRoundedRect(point, left, top, right, bottom, YARD_CORNER_RADIUS)) continue;
    const tile = input.cells[ty * input.mapWidth + tx];
    if (tile === undefined || tile.buildingId !== null || tile.terrain !== "grass") continue;
    if (roadDistance(point) < half) continue;
    if (nearWall && input.wall !== null
      && (pointInPolygon(point, input.wall) !== insideWall || distanceToPolyline(point, input.wall) < WALL_CLEARANCE)) continue;
    mask[j * nx + i] = 1;
  }
  // Keep the part connected to the footprint (a clipped-off sliver across a road or wall is not this yard).
  const keep = new Uint8Array(nx * ny);
  const queue: number[] = [];
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    const point = { x: (i0 + i + 0.5) / S - 0.5, y: (j0 + j + 0.5) / S - 0.5 };
    if (mask[j * nx + i] === 1 && own(Math.round(point.x), Math.round(point.y))) { keep[j * nx + i] = 1; queue.push(j * nx + i); }
  }
  while (queue.length > 0) {
    const index = queue.pop() as number;
    const i = index % nx; const j = (index - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di; const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const next = nj * nx + ni;
      if (mask[next] === 1 && keep[next] === 0) { keep[next] = 1; queue.push(next); }
    }
  }
  const subcells: number[] = [];
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    if (keep[j * nx + i] === 1) subcells.push((j0 + j) * stride + i0 + i);
  }
  if (subcells.length === 0) return null;
  for (const subcell of subcells) claimed.add(subcell);
  const loops = cellContourLoops({ width: nx, height: ny, inside: (i, j) => keep[j * nx + i] === 1, outside: false });
  const rings = loops.map(loop => loop.points.map(point => ({ x: (i0 + point.x + 0.5) / S - 0.5, y: (j0 + point.y + 0.5) / S - 0.5 })));
  const all = rings.flat();
  return { buildingId: building.id, subcells, subcellStride: stride,
    footprint: { tx: building.tx, ty: building.ty, width: building.width, height: building.height }, rings, bounds: boundsOf(all),
    hash: hashNumbers([building.tx, building.ty, building.width, building.height, ...all.flatMap(point => [point.x, point.y])]) };
}

function buildingApron(input: BuildingGroundsInput, building: GroundBuilding, roadDistance: (point: BoundaryPoint) => number,
  half: number, footprintOwner: ReadonlyMap<number, string>, stone: ReadonlySet<number>): BuildingApron | null {
  const access = new Set(building.roadAccess);
  const contactCells = (side: typeof SIDES[number]): number[] => {
    const length = side.normal.x === 0 ? building.width : building.height;
    const cells: number[] = [];
    for (let k = 0; k < length; k += 1) {
      const tx = side.normal.x === 0 ? building.tx + k : side.normal.x > 0 ? building.tx + building.width : building.tx - 1;
      const ty = side.normal.y === 0 ? building.ty + k : side.normal.y > 0 ? building.ty + building.height : building.ty - 1;
      const index = ty * input.mapWidth + tx;
      const tile = tx < 0 || ty < 0 || tx >= input.mapWidth || ty >= input.mapHeight ? undefined : input.cells[index];
      cells.push(tile !== undefined && access.has(index) && tile.hasRoad && tile.buildingId === null && !footprintOwner.has(index)
        && tile.terrain !== "water" && tile.terrain !== "rock" ? k : -1);
    }
    return cells;
  };
  let best: { side: typeof SIDES[number]; contacts: number[] } | null = null;
  for (const side of SIDES) {
    const contacts = contactCells(side).filter(k => k >= 0);
    if (contacts.length > 0 && (best === null || contacts.length > best.contacts.length)) best = { side, contacts };
  }
  if (best === null) return null;
  // One apron over the longest contiguous run of contact edges on the frontage side.
  let run = { from: best.contacts[0] as number, to: best.contacts[0] as number };
  let current = { ...run };
  for (const k of best.contacts.slice(1)) {
    if (k === current.to + 1) current.to = k; else current = { from: k, to: k };
    if (current.to - current.from > run.to - run.from) run = { ...current };
  }
  const normal = best.side.normal;
  const along = { x: normal.x === 0 ? 1 : 0, y: normal.y === 0 ? 1 : 0 };
  const edgeOffset = normal.x > 0 ? building.tx + building.width - 0.5 : normal.x < 0 ? building.tx - 0.5
    : normal.y > 0 ? building.ty + building.height - 0.5 : building.ty - 0.5;
  const base = normal.x === 0 ? building.tx : building.ty;
  const u0 = base + run.from - 0.5; const u1 = base + run.to + 0.5;
  const count = Math.max(2, Math.round((u1 - u0) * APRON_SAMPLES_PER_TILE) + 1);
  const edge: BoundaryPoint[] = [];
  const depths: number[] = [];
  const gaps: (number | null)[] = [];
  const hits: (number | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    const u = u0 + (u1 - u0) * index / (count - 1);
    const point = normal.x === 0 ? { x: u, y: edgeOffset } : { x: edgeOffset, y: u };
    edge.push(point);
    const found = rayToRibbon(point, normal, roadDistance, [half, half - APRON_TUCK], TUCK_REACH);
    const gap = found[0] ?? null;
    const tucked = gap === null || gap > RAY_REACH ? null : found[1] ?? null;
    gaps.push(tucked === null ? null : gap);
    hits.push(tucked === null ? null : Math.min(APRON_MAX_DEPTH, tucked));
  }
  // Where the ray meets no ribbon (the road ends or turns away past this end of the edge) the apron tapers off at
  // 45 degrees from the nearest sample that does meet it, instead of pushing an earth tongue into the grass.
  const step = (u1 - u0) / (count - 1);
  for (let index = 0; index < count; index += 1) {
    const hit = hits[index];
    if (hit !== null && hit !== undefined) { depths.push(hit); continue; }
    let best = 0;
    hits.forEach((other, at) => { if (other !== null) best = Math.max(best, other - Math.abs(at - index) * step); });
    depths.push(best);
  }
  if (depths.every(depth => depth <= 0)) return null;
  const inner = (point: BoundaryPoint, lateral: number): BoundaryPoint => ({
    x: point.x - normal.x * APRON_INSET + along.x * lateral, y: point.y - normal.y * APRON_INSET + along.y * lateral });
  const far = edge.map((point, index) => {
    const taper = index === 0 ? -APRON_FLARE : index === edge.length - 1 ? APRON_FLARE : 0;
    const depth = depths[index] as number;
    return { x: point.x + normal.x * depth + along.x * taper, y: point.y + normal.y * depth + along.y * taper };
  });
  const traced = [inner(edge[0] as BoundaryPoint, -APRON_OVERHANG), ...far, inner(edge[edge.length - 1] as BoundaryPoint, APRON_OVERHANG)];
  // One winding for every apron: the renderer fills all of a chunk's aprons as one non-zero path, where two
  // overlapping polygons of opposite winding would cancel into a hole.
  const polygon = signedArea(traced) >= 0 ? traced : [...traced].reverse();
  const cellOf = (k: number): number => normal.x === 0
    ? (normal.y > 0 ? building.ty + building.height : building.ty - 1) * input.mapWidth + building.tx + k
    : (building.ty + k) * input.mapWidth + (normal.x > 0 ? building.tx + building.width : building.tx - 1);
  let material: RoadMaterial = "earth";
  for (let k = run.from; k <= run.to; k += 1) if (stone.has(cellOf(k))) material = "stone";
  return { buildingId: building.id, normal, edge, depths, ribbonGaps: gaps, polygon, material, bounds: boundsOf(polygon),
    hash: hashNumbers([material === "stone" ? 1 : 0, ...polygon.flatMap(point => [point.x, point.y])]) };
}

/**
 * First distance along the ray at which the road envelope of each half-width in `radii` (descending) is reached,
 * or null within `reach`. Sphere tracing: the distance field bounds how far the ray can advance safely.
 */
function rayToRibbon(origin: BoundaryPoint, direction: BoundaryPoint, roadDistance: (point: BoundaryPoint) => number,
  radii: readonly number[], reach: number): (number | null)[] {
  const found: (number | null)[] = radii.map(() => null);
  let next = 0;
  let t = 0;
  while (t <= reach + 1e-9 && next < radii.length) {
    const distance = roadDistance({ x: origin.x + direction.x * t, y: origin.y + direction.y * t });
    while (next < radii.length && distance <= (radii[next] as number)) { found[next] = t; next += 1; }
    if (next >= radii.length) break;
    t += Math.max(RAY_STEP, Math.min(distance, ROAD_DISTANCE_REACH) - (radii[next] as number));
  }
  return found;
}

/**
 * Distance to the union of everything the ribbon renderer paints around: chain centrelines (junction patches are the
 * union of the arms, which run to the node centre), bridge stubs, round caps (fixed points) and plaza loops.
 */
export function roadDistanceField(graph: RoadCenterlineGraph, mapWidth: number, mapHeight: number): (point: BoundaryPoint) => number {
  type Segment = { readonly a: BoundaryPoint; readonly b: BoundaryPoint };
  const segments: Segment[] = [];
  for (const chain of graph.chains) {
    const line = chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline;
    for (let index = 1; index < line.length; index += 1) segments.push({ a: line[index - 1] as BoundaryPoint, b: line[index] as BoundaryPoint });
  }
  for (const point of graph.fixedPoints) {
    const centre = { x: point.tx, y: point.ty };
    segments.push({ a: centre, b: centre });
    for (const direction of point.bridgeDirections) segments.push({ a: centre, b: { x: centre.x + direction.x * 0.5, y: centre.y + direction.y * 0.5 } });
  }
  const plazas = graph.plazaLoops.map(loop => ({ points: loop.smoothed, bounds: boundsOf(loop.smoothed) }));
  for (const { points: plaza } of plazas) for (let index = 0; index < plaza.length; index += 1) {
    segments.push({ a: plaza[index] as BoundaryPoint, b: plaza[(index + 1) % plaza.length] as BoundaryPoint });
  }
  // Bucket every segment into the tiles its bounds (grown by REACH) touch; a query reads one bucket. Callers only
  // compare against ribbon half-widths (< 0.5), so anything farther than REACH may read as Infinity.
  const REACH = ROAD_DISTANCE_REACH;
  const buckets = new Map<number, Segment[]>();
  for (const segment of segments) {
    const x0 = Math.max(-1, Math.floor(Math.min(segment.a.x, segment.b.x) - REACH)); const x1 = Math.min(mapWidth, Math.ceil(Math.max(segment.a.x, segment.b.x) + REACH));
    const y0 = Math.max(-1, Math.floor(Math.min(segment.a.y, segment.b.y) - REACH)); const y1 = Math.min(mapHeight, Math.ceil(Math.max(segment.a.y, segment.b.y) + REACH));
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const key = (y + 1) * (mapWidth + 2) + x + 1;
      const list = buckets.get(key);
      if (list === undefined) buckets.set(key, [segment]); else list.push(segment);
    }
  }
  return (point: BoundaryPoint): number => {
    for (const plaza of plazas) {
      if (point.x >= plaza.bounds.left && point.x <= plaza.bounds.right && point.y >= plaza.bounds.top && point.y <= plaza.bounds.bottom
        && pointInPolygon(point, plaza.points)) return 0;
    }
    const list = buckets.get((Math.floor(point.y) + 1) * (mapWidth + 2) + Math.floor(point.x) + 1);
    if (list === undefined) return Infinity;
    let best = Infinity;
    for (const segment of list) best = Math.min(best, distanceToSegment(point, segment.a, segment.b));
    return best > REACH ? Infinity : best;
  };
}

function signedArea(points: readonly BoundaryPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index] as BoundaryPoint; const b = points[(index + 1) % points.length] as BoundaryPoint;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function insideRoundedRect(point: BoundaryPoint, left: number, top: number, right: number, bottom: number, radius: number): boolean {
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return false;
  const cx = Math.min(Math.max(point.x, left + radius), right - radius);
  const cy = Math.min(Math.max(point.y, top + radius), bottom - radius);
  return Math.hypot(point.x - cx, point.y - cy) <= radius;
}

export function pointInPolygon(point: BoundaryPoint, polygon: readonly BoundaryPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index] as BoundaryPoint; const b = polygon[previous] as BoundaryPoint;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToPolyline(point: BoundaryPoint, line: readonly BoundaryPoint[]): number {
  let best = Infinity;
  for (let index = 1; index < line.length; index += 1) best = Math.min(best, distanceToSegment(point, line[index - 1] as BoundaryPoint, line[index] as BoundaryPoint));
  return best;
}
