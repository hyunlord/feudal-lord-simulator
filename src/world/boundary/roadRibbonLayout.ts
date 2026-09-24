import type { Tile } from "../world.types";
import { boundaryHash, hashNumbers, type BoundaryPoint } from "./boundaryGeometry";
import { polylineLength, type RoadCenterlineGraph, type RoadChain, type RoadFixedPoint, type RoadMaterial, type RoadPortal } from "./roadCenterline";

// Everything the ribbon renderer draws besides the chains themselves, derived from the centreline graph (D1a-2).
// Pure function of (graph, tiles, ribbon width, seed): nothing is saved or read by rules.
//  - Junctions (research C04): at a node with three or more arms (and not a plaza) every chain stops JUNCTION_REACH
//    before the node; the node is drawn as one patch (the union of the arm pieces, filled once) and the ruts are
//    re-projected along each arm up to the node centre.
//  - Dead ends: a rounded cap past the last cell centre plus one end tuft.
//  - Portal caps: a one-tile rut-free threshold at each bridge deck start and gate crossing.
//  - Shoulder breakup (C07): grass tufts scattered along both ribbon edges, 1..1.5 tiles apart with separate seeds
//    per side (so the two edges never repeat in phase), size +-10%, and no two tufts of the same variant within
//    SHOULDER_REPEAT_RADIUS tiles (deterministic near rejection, research 6). Tufts skip `keepOut` ground (C1d:
//    building aprons), which is decided before the variant pass, so the rest keep their near-rejection order.

export const JUNCTION_REACH = 0.5;
export const SHOULDER_SPACING_MIN = 1;
export const SHOULDER_SPACING_MAX = 1.5;
/** 6 crop windows of the grass-edge decal x mirror. */
export const SHOULDER_VARIANTS = 12;
export const SHOULDER_REPEAT_RADIUS = 4;
/** No tufts this close (arc length) to a portal: the wall foot and bridge bank own that ground. */
const PORTAL_CLEAR = 0.8;
const JUNCTION_CLEAR = 0.15;
/** How far past the visible edge the ground must be free (not road, water or building) for a tuft. */
const OUTWARD_PROBE = 0.3;
const EDGE_INSET = 0.92;

export type RibbonArm = {
  /** Chain index, or null for a bridge stub arm. */
  readonly chain: number | null;
  /** Node -> cut, along the centreline. */
  readonly points: readonly BoundaryPoint[];
  /** Chain arc length at the node end (keeps the strip phase continuous into the patch). */
  readonly arcAtNode: number;
};
export type JunctionPatch = {
  readonly centre: BoundaryPoint; readonly arms: readonly RibbonArm[]; readonly material: RoadMaterial;
  readonly crossing: boolean; readonly hash: number;
};
export type RibbonCap = { readonly centre: BoundaryPoint; readonly direction: BoundaryPoint | null; readonly material: RoadMaterial };
/** `material` is the owning cell's; `farMaterial` the cell across a gate (earth outside a stone-paved town). */
export type PortalCap = { readonly anchor: BoundaryPoint; readonly axis: BoundaryPoint; readonly kind: RoadPortal["kind"];
  readonly material: RoadMaterial; readonly farMaterial: RoadMaterial };
export type ShoulderDecal = { readonly anchor: BoundaryPoint; readonly variant: number; readonly scale: number; readonly side: 1 | -1; readonly arc: number };

export type RoadRibbonLayout = {
  readonly width: number;
  /** Per chain: arc length left undrawn at the start and end (junction patches draw it). */
  readonly trims: readonly { readonly start: number; readonly end: number }[];
  /** Per fixed point. */
  readonly junctions: readonly (JunctionPatch | null)[];
  readonly caps: readonly (RibbonCap | null)[];
  readonly stubs: readonly (readonly BoundaryPoint[])[];
  readonly portalCaps: readonly (readonly PortalCap[])[];
  readonly capDecals: readonly (ShoulderDecal | null)[];
  /** Per chain. */
  readonly shoulders: readonly (readonly ShoulderDecal[])[];
  /** Per chain / per fixed point: hash of everything above that belongs to it (chunk content keys). */
  readonly chainHashes: readonly number[];
  readonly fixedHashes: readonly number[];
};

export type RibbonLayoutInput = {
  readonly graph: RoadCenterlineGraph;
  readonly width: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** Indexed by ty * mapWidth + tx. */
  readonly cells: readonly (Tile | undefined)[];
  readonly seed: number;
  /** Ground a shoulder tuft must not stand on (C1d: building aprons, so the apron meets the ribbon cleanly). */
  readonly keepOut?: (point: BoundaryPoint) => boolean;
};

export function roadRibbonLayout(input: RibbonLayoutInput): RoadRibbonLayout {
  const { graph, width } = input;
  const fixedAt = new Map(graph.fixedPoints.map((point, index) => [point.ty * input.mapWidth + point.tx, index]));
  const arms = (point: RoadFixedPoint): number => point.degree + point.bridgeDirections.length;
  const isJunction = (point: RoadFixedPoint): boolean => arms(point) >= 3 && !point.kinds.includes("plaza");
  const endPoint = (chain: RoadChain, atStart: boolean): { index: number; point: RoadFixedPoint } | null => {
    if (chain.closed) return null;
    const cell = chain.cells[atStart ? 0 : chain.cells.length - 1];
    const index = cell === undefined ? undefined : fixedAt.get(cell.ty * input.mapWidth + cell.tx);
    return index === undefined ? null : { index, point: graph.fixedPoints[index] as RoadFixedPoint };
  };

  const lengths = graph.chains.map(chain => polylineLength(chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline));
  const trims = graph.chains.map((chain, index) => {
    const total = lengths[index] as number;
    const start = endPoint(chain, true); const end = endPoint(chain, false);
    const startJunction = start !== null && isJunction(start.point); const endJunction = end !== null && isJunction(end.point);
    const share = startJunction && endJunction ? 0.5 : 0.8;
    return { start: startJunction ? Math.min(JUNCTION_REACH, total * share) : 0, end: endJunction ? Math.min(JUNCTION_REACH, total * share) : 0 };
  });

  const junctions = graph.fixedPoints.map((point, fixedIndex): JunctionPatch | null => {
    if (!isJunction(point)) return null;
    const centre = { x: point.tx, y: point.ty };
    const list: RibbonArm[] = [];
    graph.chains.forEach((chain, chainIndex) => {
      const total = lengths[chainIndex] as number; const trim = trims[chainIndex] as { start: number; end: number };
      if (endPoint(chain, true)?.index === fixedIndex) list.push({ chain: chainIndex, points: subLine(chain.centreline, 0, trim.start), arcAtNode: 0 });
      if (endPoint(chain, false)?.index === fixedIndex) list.push({ chain: chainIndex, points: subLine(chain.centreline, total, total - trim.end), arcAtNode: total });
    });
    for (const direction of point.bridgeDirections) {
      list.push({ chain: null, points: [centre, { x: centre.x + direction.x * 0.5, y: centre.y + direction.y * 0.5 }], arcAtNode: 0 });
    }
    list.sort((a, b) => armAngle(a) - armAngle(b));
    return { centre, arms: list, material: point.material, crossing: list.length >= 4,
      hash: hashNumbers(list.flatMap(arm => [arm.chain ?? -1, arm.arcAtNode, ...arm.points.flatMap(p => [p.x, p.y])])) };
  });

  const chainsAt = (fixedIndex: number): { chain: number; atStart: boolean }[] => graph.chains.flatMap((chain, chainIndex) => [
    ...(endPoint(chain, true)?.index === fixedIndex ? [{ chain: chainIndex, atStart: true }] : []),
    ...(endPoint(chain, false)?.index === fixedIndex ? [{ chain: chainIndex, atStart: false }] : []),
  ]);
  const caps = graph.fixedPoints.map((point, fixedIndex): RibbonCap | null => {
    const centre = { x: point.tx, y: point.ty };
    if (point.kinds.includes("plaza")) return null;
    if (point.degree === 0 && point.bridgeDirections.length === 0) return { centre, direction: null, material: point.material };
    if (arms(point) !== 1) return null;
    const direction = point.bridgeDirections[0];
    if (direction !== undefined) return { centre, direction: { x: -direction.x, y: -direction.y }, material: point.material };
    const [end] = chainsAt(fixedIndex);
    if (end === undefined) return null;
    const line = (graph.chains[end.chain] as RoadChain).centreline;
    const inner = pointAtArc(line, end.atStart ? Math.min(0.25, (lengths[end.chain] as number) / 2) : (lengths[end.chain] as number) - Math.min(0.25, (lengths[end.chain] as number) / 2));
    return { centre, direction: unit({ x: centre.x - inner.point.x, y: centre.y - inner.point.y }), material: point.material };
  });
  const stubs = graph.fixedPoints.map(point => isJunction(point) || point.degree === 1 ? []
    : point.bridgeDirections.map(direction => ({ x: point.tx + direction.x * 0.5, y: point.ty + direction.y * 0.5 })));
  const portalCaps = graph.fixedPoints.map(point => point.kinds.includes("plaza") ? [] : point.portals
    // A gate crossing is seen from both of its cells; the cell on the positive side of the axis owns the cap.
    .filter(portal => portal.kind === "bridge" || portal.axis.x + portal.axis.y > 0)
    .map(portal => {
      const far = fixedAt.get(Math.round(point.ty - portal.axis.y) * input.mapWidth + Math.round(point.tx - portal.axis.x));
      const farMaterial = portal.kind === "gate" && far !== undefined ? (graph.fixedPoints[far] as RoadFixedPoint).material : point.material;
      return { anchor: portal.anchor, axis: portal.axis, kind: portal.kind, material: point.material, farMaterial };
    }));

  // Shoulder and end-tuft candidates in a fixed order, then one near-rejection pass assigns the variants.
  type Candidate = { owner: { chain: number } | { fixed: number }; anchor: BoundaryPoint; side: 1 | -1; arc: number; hash: number };
  const candidates: Candidate[] = [];
  const free = (point: BoundaryPoint): boolean => {
    const tx = Math.round(point.x); const ty = Math.round(point.y);
    if (tx < 0 || ty < 0 || tx >= input.mapWidth || ty >= input.mapHeight) return false;
    const tile = input.cells[ty * input.mapWidth + tx];
    return tile !== undefined && !tile.hasRoad && tile.terrain !== "water" && tile.buildingId === null;
  };
  graph.chains.forEach((chain, chainIndex) => {
    const total = lengths[chainIndex] as number; const trim = trims[chainIndex] as { start: number; end: number };
    const line = chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline;
    const clearance = (atStart: boolean, trimmed: number): number => {
      const end = endPoint(chain, atStart);
      if (end === null) return 0;
      if (end.point.portals.length > 0) return PORTAL_CLEAR + (end.point.degree === 1 && end.point.bridgeDirections.length > 0 ? 0.5 : 0);
      return trimmed > 0 ? trimmed + JUNCTION_CLEAR : 0;
    };
    const from = clearance(true, trim.start); const to = total - clearance(false, trim.end);
    const found: Candidate[] = [];
    for (const side of [1, -1] as const) {
      const stream = boundaryHash(chain.hash, input.seed, side > 0 ? 11 : 23);
      let step = 0;
      let arc = from + 0.15 + 0.85 * unitHash(stream, step);
      while (arc < to - 0.1) {
        const at = pointAtArc(line, arc);
        const normal = { x: -at.tangent.y * side, y: at.tangent.x * side };
        const anchor = { x: at.point.x + normal.x * width / 2 * EDGE_INSET, y: at.point.y + normal.y * width / 2 * EDGE_INSET };
        const probe = { x: at.point.x + normal.x * (width / 2 + OUTWARD_PROBE), y: at.point.y + normal.y * (width / 2 + OUTWARD_PROBE) };
        if (free(probe) && input.keepOut?.(anchor) !== true) found.push({ owner: { chain: chainIndex }, anchor, side, arc, hash: boundaryHash(stream, step, 5) });
        step += 1;
        arc += SHOULDER_SPACING_MIN + (SHOULDER_SPACING_MAX - SHOULDER_SPACING_MIN) * unitHash(stream, step);
      }
    }
    candidates.push(...found.sort((a, b) => a.arc - b.arc || b.side - a.side));
  });
  graph.fixedPoints.forEach((point, fixedIndex) => {
    const cap = caps[fixedIndex];
    if (cap === null || cap === undefined || cap.direction === null) return;
    const tip = { x: cap.centre.x + cap.direction.x * width / 2, y: cap.centre.y + cap.direction.y * width / 2 };
    const probe = { x: cap.centre.x + cap.direction.x * (width / 2 + OUTWARD_PROBE), y: cap.centre.y + cap.direction.y * (width / 2 + OUTWARD_PROBE) };
    if (free(probe) && input.keepOut?.(tip) !== true) candidates.push({ owner: { fixed: fixedIndex }, anchor: tip, side: 1, arc: 0, hash: boundaryHash(point.ty * input.mapWidth + point.tx, input.seed, 31) });
  });

  const placed = new Map<string, ShoulderDecal[]>();
  const bucket = (x: number, y: number): string => `${Math.floor(x / SHOULDER_REPEAT_RADIUS)},${Math.floor(y / SHOULDER_REPEAT_RADIUS)}`;
  const shoulders: ShoulderDecal[][] = graph.chains.map(() => []);
  const capDecals: (ShoulderDecal | null)[] = graph.fixedPoints.map(() => null);
  for (const candidate of candidates) {
    const near = new Set<number>();
    const bx = Math.floor(candidate.anchor.x / SHOULDER_REPEAT_RADIUS); const by = Math.floor(candidate.anchor.y / SHOULDER_REPEAT_RADIUS);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      for (const other of placed.get(`${bx + dx},${by + dy}`) ?? []) {
        if (Math.hypot(other.anchor.x - candidate.anchor.x, other.anchor.y - candidate.anchor.y) < SHOULDER_REPEAT_RADIUS) near.add(other.variant);
      }
    }
    const first = candidate.hash % SHOULDER_VARIANTS;
    let variant = -1;
    for (let tried = 0; tried < SHOULDER_VARIANTS; tried += 1) {
      const option = (first + tried * 5) % SHOULDER_VARIANTS;
      if (!near.has(option)) { variant = option; break; }
    }
    if (variant < 0) continue;
    const decal: ShoulderDecal = { anchor: candidate.anchor, variant, scale: 0.9 + 0.2 * unitHash(candidate.hash, 7), side: candidate.side, arc: candidate.arc };
    const key = bucket(decal.anchor.x, decal.anchor.y);
    placed.set(key, [...(placed.get(key) ?? []), decal]);
    if ("chain" in candidate.owner) shoulders[candidate.owner.chain]?.push(decal);
    else capDecals[candidate.owner.fixed] = decal;
  }

  const decalValues = (decal: ShoulderDecal): number[] => [decal.anchor.x, decal.anchor.y, decal.variant, decal.scale];
  const chainHashes = graph.chains.map((_, index) => {
    const trim = trims[index] as { start: number; end: number };
    return hashNumbers([width, trim.start, trim.end, ...(shoulders[index] ?? []).flatMap(decalValues)]);
  });
  const fixedHashes = graph.fixedPoints.map((_, index) => {
    const cap = caps[index]; const decal = capDecals[index];
    return hashNumbers([width, junctions[index]?.hash ?? 0, cap?.direction?.x ?? 9, cap?.direction?.y ?? 9, cap === null ? 0 : 1,
      ...(stubs[index] ?? []).flatMap(point => [point.x, point.y]),
      ...(portalCaps[index] ?? []).flatMap(portal => [portal.anchor.x, portal.anchor.y, portal.axis.x, portal.axis.y, portal.kind === "gate" ? 1 : 2, portal.farMaterial === "stone" ? 1 : 0]),
      ...(decal === null || decal === undefined ? [] : decalValues(decal))]);
  });
  return { width, trims, junctions, caps, stubs, portalCaps, capDecals, shoulders, chainHashes, fixedHashes };
}

function unitHash(stream: number, step: number): number {
  return boundaryHash(stream, step, 3) / 4_294_967_296;
}

function armAngle(arm: RibbonArm): number {
  const a = arm.points[0] as BoundaryPoint; const b = arm.points[arm.points.length - 1] as BoundaryPoint;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function unit(vector: BoundaryPoint): BoundaryPoint {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

/** Point and unit tangent at arc length `arc` along an open polyline (clamped to its ends). */
export function pointAtArc(line: readonly BoundaryPoint[], arc: number): { readonly point: BoundaryPoint; readonly tangent: BoundaryPoint } {
  let travelled = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (step < 1e-9) continue;
    if (travelled + step >= arc || index === line.length - 1) {
      const t = Math.max(0, Math.min(1, (arc - travelled) / step));
      return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tangent: { x: (b.x - a.x) / step, y: (b.y - a.y) / step } };
    }
    travelled += step;
  }
  return { point: line[0] ?? { x: 0, y: 0 }, tangent: { x: 1, y: 0 } };
}

/** The part of `line` between arc lengths `from` and `to`, in that direction (to < from walks backwards). */
export function subLine(line: readonly BoundaryPoint[], from: number, to: number): BoundaryPoint[] {
  const low = Math.min(from, to); const high = Math.max(from, to);
  const points: BoundaryPoint[] = [pointAtArc(line, low).point];
  let travelled = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    travelled += Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled > low + 1e-9 && travelled < high - 1e-9) points.push(b);
  }
  points.push(pointAtArc(line, high).point);
  return from <= to ? points : points.reverse();
}
