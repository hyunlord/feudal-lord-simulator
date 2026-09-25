import type { PalisadeState } from "../../engine/engine.types";
import type { TileEdgePoint } from "../palisadeGeometry";
import { wallGatePoints } from "../wallTraversal";
import type { Tile } from "../world.types";
import { hashNumbers, pinnedMovingAverage, type BoundaryPoint } from "./boundaryGeometry";

// Wall baselines (D3b): the drawn line of every completed wall run. Pure and derived; the wall logic (segments, edge
// paths, gates, blocking, carrying) is read, never changed.
//  - Graph: the completed segments' edge paths (tile-edge space: integer points are tile corners) cut into unit edges,
//    one material each.
//  - Nodes (a module stands there, the line is pinned): gates, ends (degree 1), junctions (degree 3+), material joins,
//    and major corners (a turn whose two straight arms are both >= MAJOR_ARM tiles: a tower). Other turns are the
//    staircase of a wall drawn along a slope; they are smoothed away. A turn with exactly one long arm gets a pillar
//    (a 135-degree bend once smoothed) without pinning the line.
//  - Chains run node to node (a closed ring without nodes starts at its smallest corner). Each is resampled every
//    RESAMPLE tiles, averaged over +-0.5 tile and smoothed by Chaikin x2 with pinned ends, then locked back onto the raw path within LOCK_FULL of a
//    node (easing out by LOCK_REACH), so a gate, tower or end stands on a straight run (the D1a-2 / D3a lock rule).
//  - Each sample keeps its raw arc position (`t`), so a unit edge draws exactly the stretch of face it owns, and records
//    whether that raw edge has water on one side (the shoreline shares that line).

export const MAJOR_ARM = 3;
const RESAMPLE = 0.25;
/** Samples either side in the staircase average (+-0.5 tile). */
const STAIR_WINDOW = 2;
export const WALL_LOCK_FULL = 0.5;
export const WALL_LOCK_REACH = 1;

export type WallMaterial = "timber" | "stone";
export type WallNodeKind = "gate" | "terminal" | "junction" | "join" | "tower" | "seam";
export type WallNode = { readonly point: TileEdgePoint; readonly kind: WallNodeKind; readonly materials: readonly WallMaterial[];
  /** The lattice points one unit edge away (the gate art and the portal branches read them). */
  readonly neighbors: readonly TileEdgePoint[]; readonly owner: string };
export type WallPillar = { readonly point: BoundaryPoint; readonly material: WallMaterial; readonly owner: string };
export type WallSample = { readonly point: BoundaryPoint; readonly t: number; readonly water: boolean };
export type WallChain = {
  readonly material: WallMaterial;
  /** Raw lattice path (tile-edge space) and its smoothed, locked samples. */
  readonly raw: readonly TileEdgePoint[];
  readonly samples: readonly WallSample[];
  readonly startKind: WallNodeKind;
  readonly endKind: WallNodeKind;
  /** Unit edge key -> [t0, t1] along this chain. */
  readonly edges: ReadonlyMap<string, readonly [number, number]>;
  readonly hash: number;
};
export type WallBaselines = { readonly chains: readonly WallChain[]; readonly nodes: readonly WallNode[]; readonly pillars: readonly WallPillar[]; readonly hash: number };

const pointKey = (point: TileEdgePoint): string => `${point.x},${point.y}`;
const comparePoint = (a: TileEdgePoint, b: TileEdgePoint): number => a.x - b.x || a.y - b.y;
/** Same key as stoneWallTopology: the unit edge's two ends in point order. */
export function unitEdgeKey(a: TileEdgePoint, b: TileEdgePoint): string {
  const [first, last] = comparePoint(a, b) <= 0 ? [a, b] : [b, a];
  return `${pointKey(first)}:${pointKey(last)}`;
}

type Grid = { readonly width: number; readonly height: number; readonly tiles: readonly Tile[] };

export function wallBaselines(palisade: PalisadeState | null | undefined, grid: Grid): WallBaselines {
  if (palisade === null || palisade === undefined) return { chains: [], nodes: [], pillars: [], hash: 0 };
  const edges = new Map<string, { a: TileEdgePoint; b: TileEdgePoint; material: WallMaterial }>();
  for (const segment of [...palisade.segments].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!segment.completed) continue;
    const material: WallMaterial = segment.material === "stone" ? "stone" : "timber";
    for (let index = 1; index < segment.edgePath.length; index += 1) {
      const from = segment.edgePath[index - 1] as TileEdgePoint; const to = segment.edgePath[index] as TileEdgePoint;
      const steps = Math.round(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)));
      for (let step = 0; step < steps; step += 1) {
        const a = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps };
        const b = { x: from.x + (to.x - from.x) * (step + 1) / steps, y: from.y + (to.y - from.y) * (step + 1) / steps };
        const key = unitEdgeKey(a, b);
        // A later stone segment over the same edge wins (stone replaces timber).
        if (!edges.has(key) || material === "stone") edges.set(key, { a, b, material });
      }
    }
  }
  if (edges.size === 0) return { chains: [], nodes: [], pillars: [], hash: 0 };
  const adjacency = new Map<string, { point: TileEdgePoint; edges: string[] }>();
  for (const [key, edge] of [...edges.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const point of [edge.a, edge.b]) {
      const entry = adjacency.get(pointKey(point)) ?? { point, edges: [] };
      entry.edges.push(key);
      adjacency.set(pointKey(point), entry);
    }
  }
  const other = (edgeKey: string, point: TileEdgePoint): TileEdgePoint => {
    const edge = edges.get(edgeKey) as { a: TileEdgePoint; b: TileEdgePoint };
    return comparePoint(edge.a, point) === 0 ? edge.b : edge.a;
  };
  const direction = (from: TileEdgePoint, to: TileEdgePoint) => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });
  const gates = new Set(wallGatePoints(palisade).map(pointKey));
  /** Straight arm length from a degree-2 vertex along one of its edges (stops at a turn or a branching vertex). */
  const armLength = (point: TileEdgePoint, edgeKey: string): number => {
    let length = 0; let at = point; let current = edgeKey;
    const dir = direction(point, other(edgeKey, point));
    for (;;) {
      length += 1;
      const next = other(current, at);
      const entry = adjacency.get(pointKey(next));
      if (entry === undefined || entry.edges.length !== 2 || length >= MAJOR_ARM) return length;
      const onward = entry.edges.find(key => key !== current) as string;
      const nextDir = direction(next, other(onward, next));
      if (nextDir.x !== dir.x || nextDir.y !== dir.y) return length;
      at = next; current = onward;
    }
  };
  const kindAt = new Map<string, WallNodeKind>();
  const pillarPoints: { point: TileEdgePoint; material: WallMaterial }[] = [];
  for (const [key, entry] of adjacency) {
    const materials = new Set(entry.edges.map(edgeKey => (edges.get(edgeKey) as { material: WallMaterial }).material));
    if (gates.has(key)) { kindAt.set(key, "gate"); continue; }
    if (entry.edges.length === 1) { kindAt.set(key, "terminal"); continue; }
    if (entry.edges.length >= 3) { kindAt.set(key, "junction"); continue; }
    if (materials.size > 1) { kindAt.set(key, "join"); continue; }
    const [first, second] = entry.edges as [string, string];
    const d1 = direction(entry.point, other(first, entry.point)); const d2 = direction(entry.point, other(second, entry.point));
    if (d1.x === -d2.x && d1.y === -d2.y) continue;
    const arms = [armLength(entry.point, first), armLength(entry.point, second)];
    if (arms.every(arm => arm >= MAJOR_ARM)) kindAt.set(key, "tower");
    else if (arms.some(arm => arm >= MAJOR_ARM)) pillarPoints.push({ point: entry.point, material: [...materials][0] as WallMaterial });
  }

  // Chains between nodes.
  const used = new Set<string>();
  const chains: WallChain[] = [];
  const walk = (start: TileEdgePoint, firstEdge: string): void => {
    const raw: TileEdgePoint[] = [start]; const keys: string[] = [];
    let at = start; let current = firstEdge;
    const material = (edges.get(firstEdge) as { material: WallMaterial }).material;
    for (;;) {
      used.add(current); keys.push(current);
      const next = other(current, at);
      raw.push(next);
      const entry = adjacency.get(pointKey(next)) as { edges: string[] };
      if (kindAt.has(pointKey(next)) || entry.edges.length !== 2) break;
      const onward = entry.edges.find(key => key !== current) as string;
      if (used.has(onward)) break;
      at = next; current = onward;
    }
    chains.push(buildChain(raw, keys, material, kindAt.get(pointKey(start)) ?? "seam", kindAt.get(pointKey(raw[raw.length - 1] as TileEdgePoint)) ?? "seam", grid));
  };
  const starts = [...adjacency.values()].filter(entry => kindAt.has(pointKey(entry.point))).sort((a, b) => comparePoint(a.point, b.point));
  for (const entry of starts) for (const edgeKey of entry.edges) if (!used.has(edgeKey)) walk(entry.point, edgeKey);
  // Rings without nodes: start at the smallest corner (or point) left.
  for (const entry of [...adjacency.values()].sort((a, b) => comparePoint(a.point, b.point))) {
    for (const edgeKey of entry.edges) if (!used.has(edgeKey)) { kindAt.set(pointKey(entry.point), "seam"); walk(entry.point, edgeKey); }
  }

  // Module owners: the incident unit edge drawn last (deepest), as the object queue sorts by depth.
  const depthOf = (edgeKey: string): number => { const edge = edges.get(edgeKey) as { a: TileEdgePoint; b: TileEdgePoint }; return Math.max(edge.a.x + edge.a.y, edge.b.x + edge.b.y); };
  const ownerOf = (edgeKeys: readonly string[]): string => [...edgeKeys].sort((a, b) => depthOf(b) - depthOf(a) || (a < b ? -1 : 1))[0] as string;
  const nodes: WallNode[] = [...kindAt.entries()].filter(([, kind]) => kind !== "seam").map(([key, kind]) => {
    const entry = adjacency.get(key) as { point: TileEdgePoint; edges: string[] };
    return { point: entry.point, kind, materials: [...new Set(entry.edges.map(edgeKey => (edges.get(edgeKey) as { material: WallMaterial }).material))].sort(),
      neighbors: entry.edges.map(edgeKey => other(edgeKey, entry.point)).sort(comparePoint), owner: ownerOf(entry.edges) };
  }).sort((a, b) => comparePoint(a.point, b.point));
  const pillars: WallPillar[] = pillarPoints.map(({ point, material }) => {
    const entry = adjacency.get(pointKey(point)) as { edges: string[] };
    // Where the smoothed line passes the corner: the chain sample nearest to it.
    let best = { x: point.x, y: point.y }; let distance = Infinity;
    for (const chain of chains) for (const sample of chain.samples) {
      const d = Math.hypot(sample.point.x - point.x, sample.point.y - point.y);
      if (d < distance) { distance = d; best = sample.point; }
    }
    return { point: best, material, owner: ownerOf(entry.edges) };
  }).sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y);
  const hash = hashNumbers([...chains.map(chain => chain.hash), ...nodes.flatMap(node => [node.point.x, node.point.y, node.kind.length]),
    ...pillars.flatMap(pillar => [pillar.point.x, pillar.point.y])]);
  return { chains, nodes, pillars, hash };
}

function buildChain(raw: readonly TileEdgePoint[], keys: readonly string[], material: WallMaterial, startKind: WallNodeKind, endKind: WallNodeKind, grid: Grid): WallChain {
  const length = raw.length - 1;
  const at = (t: number): BoundaryPoint => {
    const index = Math.min(length - 1, Math.max(0, Math.floor(t)));
    const a = raw[index] as TileEdgePoint; const b = raw[index + 1] as TileEdgePoint; const f = t - index;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  const steps = Math.max(1, Math.round(length / RESAMPLE));
  let points = Array.from({ length: steps + 1 }, (_, index) => { const t = length * index / steps; return { ...at(t), t }; });
  // A staircase (the wall drawn along a slope) averages toward its diagonal over +-STAIR_WINDOW samples first.
  const averaged = pinnedMovingAverage(points, STAIR_WINDOW * 2 + 1);
  points = points.map((point, index) => ({ ...(averaged[index] as BoundaryPoint), t: point.t }));
  for (let round = 0; round < 2 && points.length > 2; round += 1) {
    const next = [points[0] as { x: number; y: number; t: number }];
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index] as { x: number; y: number; t: number }; const b = points[index + 1] as { x: number; y: number; t: number };
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y, t: 0.75 * a.t + 0.25 * b.t },
        { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y, t: 0.25 * a.t + 0.75 * b.t });
    }
    next.push(points[points.length - 1] as { x: number; y: number; t: number });
    points = next;
  }
  const lockStart = startKind !== "seam"; const lockEnd = endKind !== "seam";
  const cells: (Tile | undefined)[] = new Array(grid.width * grid.height);
  for (const tile of grid.tiles) cells[tile.ty * grid.width + tile.tx] = tile;
  const water = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height && cells[ty * grid.width + tx]?.terrain === "water";
  const edgeWater = (t: number): boolean => {
    const index = Math.min(length - 1, Math.max(0, Math.floor(t)));
    const a = raw[index] as TileEdgePoint; const b = raw[index + 1] as TileEdgePoint;
    // A diagonal unit edge crosses a cell rather than separating two: never a water / land edge.
    if (a.x !== b.x && a.y !== b.y) return false;
    // The two cells either side of the unit edge (tile-edge space: cell (tx, ty) spans [tx, tx+1) x [ty, ty+1)).
    const [c1, c2] = a.y === b.y
      ? [[Math.min(a.x, b.x), a.y - 1], [Math.min(a.x, b.x), a.y]] as const
      : [[a.x - 1, Math.min(a.y, b.y)], [a.x, Math.min(a.y, b.y)]] as const;
    return water(c1[0], c1[1]) !== water(c2[0], c2[1]);
  };
  const samples: WallSample[] = points.map(point => {
    const fromStart = point.t; const fromEnd = length - point.t;
    const distance = Math.min(lockStart ? fromStart : Infinity, lockEnd ? fromEnd : Infinity);
    const weight = distance <= WALL_LOCK_FULL ? 1 : distance >= WALL_LOCK_REACH ? 0 : (WALL_LOCK_REACH - distance) / (WALL_LOCK_REACH - WALL_LOCK_FULL);
    const exact = at(point.t);
    return { point: { x: point.x + (exact.x - point.x) * weight, y: point.y + (exact.y - point.y) * weight }, t: point.t, water: edgeWater(point.t) };
  });
  const edgesByKey = new Map<string, readonly [number, number]>(keys.map((key, index) => [key, [index, index + 1] as const]));
  return { material, raw, samples, startKind, endKind, edges: edgesByKey,
    hash: hashNumbers([material === "stone" ? 2 : 1, startKind.length, endKind.length, ...samples.flatMap(sample => [sample.point.x, sample.point.y, sample.t, sample.water ? 1 : 0])]) };
}
