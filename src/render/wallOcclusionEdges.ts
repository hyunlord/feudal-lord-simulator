import type { GameState } from "../engine/engine.types";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { WALL_THICKNESS, type WallFaceSlice } from "./drawWallFaces";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import { wallBaselinesFor } from "./wallBaselineCache";

// NAT-4 QA-005: a wall item's place in the walkers' depth rule (walkerOcclusion.ts), as the wall is drawn. With wall
// strips on (the default) an item draws its stretch of the smoothed wall baseline (drawWallFaces), whose face stands
// half the wall's thickness toward the camera and whose corners are rounded; the road ribbon a walker is drawn on
// (walkerRoadAlignment) cuts the same corners. So a walker is compared with the face line at its own screen column
// (x − y in tile units): in front when its foot is deeper (x + y) than the face there. The unit edge's straight line
// (the old test) put a walker on a corner's ribbon, inside the wall's thickness, "in front" and drew him and his cart
// over the wall (Astra round 14, frames 19–22). Without strips the item draws its unit edge, and the same test runs
// on that edge's face line. Coordinates: tile centres (an edge point's corner − 0.5).

export type Box = { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
export type Foot = { readonly tx: number; readonly ty: number };
/** A wall item's stretch: the tiles it spans (the walkers' buckets) and its test (in front, behind, or not meeting). */
export type WallEdge = { readonly span: Box; readonly front: (foot: Foot) => boolean | null };
type WallItem = { readonly id: string; readonly segment: { readonly edgePath: readonly BoundaryPoint[]; readonly material?: string } };

/** Half a walker's width on screen, in tile-diagonal units (18 px of the 64 px tile width → ~0.3 of sx per tile). */
export const WALKER_HALF_WIDTH = 0.3;
/** How far past a stretch's ends (screen columns) a foot still meets it: the wall's joints and modules. */
const WALL_REACH = 0.6;
/** A stretch narrower on screen than this is seen end-on (a wall running along the view). */
const END_ON = 0.05;

type Run = { readonly sx0: number; readonly d0: number; readonly sx1: number; readonly d1: number };

/** The test of a face line (tile-centre points along the wall, `face` tiles toward the camera from it). */
export function faceLineEdge(line: readonly BoundaryPoint[], face: number): WallEdge {
  const runs: Run[] = [];
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1]!; const b = line[index]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    // The face stands on the side toward the camera (normal n with n · (1, 1) >= 0), as drawWallFaces draws it.
    let n = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    if (n.x + n.y < 0) n = { x: -n.x, y: -n.y };
    const fa = { x: a.x + n.x * face, y: a.y + n.y * face }; const fb = { x: b.x + n.x * face, y: b.y + n.y * face };
    runs.push({ sx0: fa.x - fa.y, d0: fa.x + fa.y, sx1: fb.x - fb.y, d1: fb.x + fb.y });
  }
  const xs = line.map(point => point.x); const ys = line.map(point => point.y);
  const span = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  if (runs.length === 0) return { span, front: () => null };
  const ends = runs.flatMap(run => [{ sx: run.sx0, d: run.d0 }, { sx: run.sx1, d: run.d1 }]);
  const left = ends.reduce((a, b) => (b.sx < a.sx ? b : a)); const right = ends.reduce((a, b) => (b.sx > a.sx ? b : a));
  const near = Math.max(...ends.map(end => end.d)); const far = Math.min(...ends.map(end => end.d));
  if (right.sx - left.sx < END_ON) {
    // Seen end-on: a narrow upright strip; a foot beside it, short of its near end, is behind its nearer part.
    return { span, front: foot => {
      const depth = foot.tx + foot.ty;
      if (Math.abs(foot.tx - foot.ty - (left.sx + right.sx) / 2) > WALKER_HALF_WIDTH + face * Math.SQRT2
        || depth < far - 2 * WALL_REACH || depth > near + WALL_REACH) return null;
      return depth >= near;
    } };
  }
  return { span, front: foot => {
    const sx = foot.tx - foot.ty;
    if (sx < left.sx - WALL_REACH || sx > right.sx + WALL_REACH) return null;
    // The face's depth at the foot's column (the nearest where the line folds back), or at the end it is beyond.
    let wall = Number.NEGATIVE_INFINITY;
    for (const run of runs) {
      const lo = Math.min(run.sx0, run.sx1); const hi = Math.max(run.sx0, run.sx1);
      if (sx < lo || sx > hi || hi - lo < 1e-9) continue;
      wall = Math.max(wall, run.d0 + (run.d1 - run.d0) * (sx - run.sx0) / (run.sx1 - run.sx0));
    }
    if (wall === Number.NEGATIVE_INFINITY) wall = sx < left.sx ? left.d : right.d;
    return foot.tx + foot.ty >= wall;
  } };
}

// Cache (AGENTS rule 10): (a) keyed on the slice object (wallBaselinesFor's, itself keyed on the palisade and the
// tiles: a new wall gives new slices); (b) nothing else enters (the thickness is the slice chain's material's); (c)
// the depth rule asks every wall item every frame and its stretch only changes with the wall.
const sliceEdges = new WeakMap<WallFaceSlice, WallEdge>();

function sliceEdge(slice: WallFaceSlice): WallEdge {
  const cached = sliceEdges.get(slice);
  if (cached !== undefined) return cached;
  const { chain, t0, t1 } = slice;
  const samples = chain.samples;
  const pointAt = (t: number): BoundaryPoint => {
    let index = 0;
    while (index < samples.length - 2 && samples[index + 1]!.t < t) index += 1;
    const a = samples[index]!; const b = samples[index + 1] ?? a;
    const f = b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    return { x: a.point.x + (b.point.x - a.point.x) * f, y: a.point.y + (b.point.y - a.point.y) * f };
  };
  const stretch = [pointAt(t0), ...samples.filter(sample => sample.t > t0 && sample.t < t1).map(sample => sample.point), pointAt(t1)];
  const edge = faceLineEdge(stretch.map(point => ({ x: point.x - 0.5, y: point.y - 0.5 })), WALL_THICKNESS[chain.material] / 2);
  sliceEdges.set(slice, edge);
  return edge;
}

/**
 * The stretches a wall item of the object queue draws: its baseline slice with wall strips on (none when the slice's
 * chain is of the other material: the item then draws nothing), else its unit edges' lines.
 */
export function wallItemEdges(item: WallItem, state: Partial<Pick<GameState, "palisade" | "tiles" | "width" | "height">>): readonly WallEdge[] {
  const material = item.segment.material === "stone" ? "stone" : "timber";
  if (boundaryV2Enabled() && wallStripsEnabled() && state.palisade !== undefined && state.palisade !== null && state.tiles !== undefined
    && state.width !== undefined && state.height !== undefined) {
    const slice = wallBaselinesFor({ palisade: state.palisade, tiles: state.tiles, width: state.width, height: state.height }).slices.get(item.id.slice(item.id.indexOf(":") + 1));
    return slice === undefined || slice.chain.material !== material ? [] : [sliceEdge(slice)];
  }
  const path = item.segment.edgePath;
  const face = WALL_THICKNESS[material] / 2;
  return path.slice(1).map((b, index) => faceLineEdge([path[index]!, b].map(point => ({ x: point.x - 0.5, y: point.y - 0.5 })), face));
}
