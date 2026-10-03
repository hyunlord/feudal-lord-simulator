import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { WallBaselines, WallChain, WallMaterial } from "../world/boundary/wallBaseline";

// NAT-5 wall corners (the user's 2026-10-03 question): the wall band is laid as one strip around every bend. The strip
// is drawn per baseline sample pair (drawWallFaces), and each pair used to take its own normal: at every bend the two
// quads' outer sides left a wedge open (a hairline crack through the face along a smoothed curve), and where two chains
// meet at a node (a tower, a material join, a ring's seam) the runs stopped square at the node point, a notch open on
// the outer side and the two faces crossing on the inner side. Now each chain has two side lines (left and right of its
// direction of travel), offset from the baseline by half the wall's thickness with a mitre at every sample, and at a
// chain end that meets exactly one other chain the mitre is taken with that chain's direction: the outer side runs on
// to the corner point, the inner side stops on it, so the two runs' faces, tops and end faces meet edge to edge.
//  - Gates, ends and junctions keep their square ends (the gate clearance, the end pier, the junction's module).
//  - The mitre is limited to MITRE_LIMIT times the half thickness (a turn sharper than about 120 degrees).
//  - Seen end-on (FACE_MIN_SPREAD below) a smoothed bend used to flick to the end-on top view for a few
//    samples where it passed the screen vertical, a notch in the face; a run of either kind shorter than MIN_RUN
//    takes its neighbours' kind (faceRuns), so a face goes on round the bend.

const MITRE_LIMIT = 2;
/** Tile arc below which a run of face (or end-on) samples takes the kind of the runs around it. */
const MIN_RUN = 0.35;
/** Face runs: screen direction at least this far from vertical (|dx| / length), as drawWallFaces. */
const FACE_MIN_SPREAD = 0.5;

/** The other arm's direction at a chain end (unit, tile-edge space, in this chain's direction of travel): arriving at
 * its start, leaving its end; null where the end keeps its square end. */
export type ChainJoints = { readonly start: BoundaryPoint | null; readonly end: BoundaryPoint | null };

const unit = (from: BoundaryPoint, to: BoundaryPoint): BoundaryPoint | null => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length < 1e-9 ? null : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/** The chain's direction at its start (leaving it) or its end (arriving at it): its first or last nonzero step. */
function endDirection(chain: WallChain, atEnd: boolean): BoundaryPoint | null {
  const samples = chain.samples;
  if (!atEnd) for (let index = 1; index < samples.length; index += 1) {
    const step = unit((samples[0] as { point: BoundaryPoint }).point, (samples[index] as { point: BoundaryPoint }).point);
    if (step !== null) return step;
  }
  if (atEnd) for (let index = samples.length - 2; index >= 0; index -= 1) {
    const step = unit((samples[index] as { point: BoundaryPoint }).point, (samples[samples.length - 1] as { point: BoundaryPoint }).point);
    if (step !== null) return step;
  }
  return null;
}

const SQUARE_ENDS = new Set(["gate", "terminal", "junction"]);

/** Every chain's joints: where exactly two chain ends meet at a point that is no gate, end or junction. */
export function wallChainJoints(walls: WallBaselines): ReadonlyMap<WallChain, ChainJoints> {
  const square = new Set(walls.nodes.filter(node => SQUARE_ENDS.has(node.kind)).map(node => `${node.point.x},${node.point.y}`));
  const ends = new Map<string, { chain: WallChain; atEnd: boolean }[]>();
  for (const chain of walls.chains) for (const atEnd of [false, true]) {
    const point = chain.raw[atEnd ? chain.raw.length - 1 : 0] as BoundaryPoint;
    const key = `${point.x},${point.y}`;
    ends.set(key, [...(ends.get(key) ?? []), { chain, atEnd }]);
  }
  const joints = new Map<WallChain, { start: BoundaryPoint | null; end: BoundaryPoint | null }>();
  for (const chain of walls.chains) joints.set(chain, { start: null, end: null });
  for (const [key, pair] of ends) {
    if (pair.length !== 2 || square.has(key)) continue;
    for (const [index, here] of pair.entries()) {
      const there = pair[1 - index] as { chain: WallChain; atEnd: boolean };
      const away = endDirection(there.chain, there.atEnd);
      if (away === null) continue;
      // `away` runs along the other chain in its own direction; turned into this chain's direction of travel: leaving
      // this chain's end, arriving at its start.
      const leaving = there.atEnd ? { x: -away.x, y: -away.y } : away;
      const entry = joints.get(here.chain) as { start: BoundaryPoint | null; end: BoundaryPoint | null };
      if (here.atEnd) entry.end = leaving; else entry.start = { x: -leaving.x, y: -leaving.y };
    }
  }
  return joints;
}

const left = (direction: BoundaryPoint): BoundaryPoint => ({ x: -direction.y, y: direction.x });

/** Side lines of a chain: per sample, the points `half` to the left and to the right of the baseline (mitred). */
export type ChainSides = { readonly left: readonly BoundaryPoint[]; readonly right: readonly BoundaryPoint[]; readonly faceRun: readonly boolean[] };

// Cache (AGENTS rule 10): (a) keyed on the chain object (wallBaselinesFor makes new chains whenever the palisade or the
// tiles change, so a chain's samples never change) and on its joints, half thickness and material; (b) nothing else is
// read; (c) every unit edge of a chain draws a slice of it, and without the cache each slice draw (a raster-cache miss)
// would lay the whole chain's side lines again.
const sidesCache = new WeakMap<WallChain, Map<string, ChainSides>>();

export function chainSides(chain: WallChain, joints: ChainJoints, half: number, material: WallMaterial): ChainSides {
  const key = JSON.stringify([joints, half, material]);
  let byKey = sidesCache.get(chain);
  if (byKey === undefined) { byKey = new Map(); sidesCache.set(chain, byKey); }
  const cached = byKey.get(key);
  if (cached !== undefined) return cached;
  const points = chain.samples.map(sample => sample.point);
  const count = points.length;
  // Each sample's step in and out (the nearest nonzero step either side; at the ends, the joint's direction).
  const steps: (BoundaryPoint | null)[] = points.slice(0, -1).map((point, index) => unit(point, points[index + 1] as BoundaryPoint));
  const before = (index: number): BoundaryPoint | null => {
    for (let at = index - 1; at >= 0; at -= 1) if (steps[at] !== null) return steps[at] as BoundaryPoint;
    return joints.start;
  };
  const after = (index: number): BoundaryPoint | null => {
    for (let at = index; at < steps.length; at += 1) if (steps[at] !== null) return steps[at] as BoundaryPoint;
    return joints.end;
  };
  const mitres = points.map((_, index) => {
    const a = before(index); const b = after(index);
    const one = a ?? b;
    if (one === null) return { x: 0, y: 0 };
    if (a === null || b === null) return left(one);
    const sum = { x: left(a).x + left(b).x, y: left(a).y + left(b).y };
    const length = Math.hypot(sum.x, sum.y);
    if (length < 1e-9) return left(b);
    const bisector = { x: sum.x / length, y: sum.y / length };
    const scale = 1 / Math.max(1 / MITRE_LIMIT, bisector.x * left(b).x + bisector.y * left(b).y);
    return { x: bisector.x * scale, y: bisector.y * scale };
  });
  const offset = (sign: number) => points.map((point, index) => ({ x: point.x + (mitres[index] as BoundaryPoint).x * half * sign,
    y: point.y + (mitres[index] as BoundaryPoint).y * half * sign }));
  const sides = { left: offset(1), right: offset(-1) };
  // The inner side of a joined end stops on the corner point: side points of the samples before it (along the chain's
  // end direction) are moved onto it, so no quad folds back over the corner.
  for (const line of [sides.left, sides.right]) {
    if (joints.end !== null) {
      const direction = endDirection(chain, true);
      const corner = line[count - 1] as BoundaryPoint;
      if (direction !== null) for (let index = count - 2; index >= 0; index -= 1) {
        const point = line[index] as BoundaryPoint;
        if ((point.x - corner.x) * direction.x + (point.y - corner.y) * direction.y < 0) break;
        line[index] = corner;
      }
    }
    if (joints.start !== null) {
      const direction = endDirection(chain, false);
      const corner = line[0] as BoundaryPoint;
      if (direction !== null) for (let index = 1; index < count; index += 1) {
        const point = line[index] as BoundaryPoint;
        if ((point.x - corner.x) * direction.x + (point.y - corner.y) * direction.y > 0) break;
        line[index] = corner;
      }
    }
  }
  const result = { ...sides, faceRun: faceRuns(chain) };
  byKey.set(key, result);
  return result;
}

/** Per sample step: a face run (true) or seen end-on, short runs of either kind taking their neighbours' kind. */
function faceRuns(chain: WallChain): readonly boolean[] {
  const points = chain.samples.map(sample => sample.point);
  const kinds = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1] as BoundaryPoint;
    const sx = (next.x - point.x - (next.y - point.y)) * 32; const sy = (next.x - point.x + next.y - point.y) * 16;
    const length = Math.hypot(sx, sy);
    return length === 0 ? null : Math.abs(sx) / length >= FACE_MIN_SPREAD;
  });
  const lengths = points.slice(0, -1).map((point, index) => Math.hypot((points[index + 1] as BoundaryPoint).x - point.x, (points[index + 1] as BoundaryPoint).y - point.y));
  // Zero steps take the kind before them (or after, at the start).
  for (let index = 0; index < kinds.length; index += 1) if (kinds[index] === null) kinds[index] = index > 0 ? kinds[index - 1] as boolean : null;
  for (let index = kinds.length - 1; index >= 0; index -= 1) if (kinds[index] === null) kinds[index] = kinds[index + 1] ?? true;
  const result = kinds as boolean[];
  // Runs of one kind, then each short run between two runs of the other kind turns (face first: a short end-on run
  // inside a face run becomes face; then a short face run left between end-on runs becomes end-on).
  for (const kind of [false, true]) {
    let start = 0;
    while (start < result.length) {
      let end = start; let arc = 0;
      while (end < result.length && result[end] === result[start]) { arc += lengths[end] as number; end += 1; }
      if (result[start] === kind && start > 0 && end < result.length && arc < MIN_RUN) for (let index = start; index < end; index += 1) result[index] = !kind;
      start = end;
    }
  }
  return result;
}
