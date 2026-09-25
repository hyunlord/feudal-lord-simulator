import type { BridgeSpan } from "../bridges";
import type { Tile } from "../world.types";
import { boundaryHash, boundsOf, chaikinClosed, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";
import { cellContourLoops, type CellContourLoop } from "./cellContours";
import { BOUNDARY_CHAIKIN_ROUNDS } from "./terrainBoundaries";

// Shoreline (D3a, asset spec 4.2): the water / land edge as curves. Pure and derived from the terrain and the bridges;
// water logic (cells, passability, bridges) is unchanged.
//  - Outline: marching squares over the water cells (vertices at tile edge midpoints, so water and land read one
//    shared line) + Chaikin x2, the forest pipeline. Beyond the map counts as land, so the outline runs along the map
//    edge where water touches it (no displacement there: collinear points stay collinear under Chaikin).
//  - Bridge lock: where a bridge meets its bank, the outline lies on the bank's tile edge for BRIDGE_LOCK_FULL tiles
//    either side of the deck's centre line, easing back to the curve by BRIDGE_LOCK_REACH (the D1a-2 portal rule), so
//    the deck and the abutment meet a straight bank square to the bridge.
//  - Land side: every loop records which side of its travel direction is land (strips lie land side up).
//  - Decals: small code-drawn shallow stones and waterweed (8-12 px at 128 px per tile) every ~2.4 tiles of shore, in
//    the shallow band, kept off bridges.
//  - Walls (D3b): where a completed wall stands on the water's edge, the outline takes the wall's drawn baseline (the
//    points within WALL_SNAP of a water-side wall stretch move onto it) and is marked `walled`: the shore strip stops
//    there (the wall is the edge), the water and shallows run up to the wall.

export const BRIDGE_LOCK_FULL = 0.5;
export const BRIDGE_LOCK_REACH = 0.8;
export const SHALLOW_DEPTH = 0.6;
export const WALL_SNAP = 0.45;
/** Decal spacing along the shore (D3b-2: 1.5 .. 2.5 tiles, hashed per decal). */
const DECAL_SPACING_MIN = 1.5;
const DECAL_SPACING_SPAN = 1;
const DECAL_DEPTH_MIN = 0.46;
const DECAL_DEPTH_MAX = 0.58;
const DECAL_BRIDGE_CLEARANCE = 1.2;

export type ShoreBlob = { readonly dx: number; readonly dy: number; readonly rx: number; readonly ry: number };
/** `variant` picks the sprite of the kind (Wave 4d reeds a..c / mudstones a, b), `flip` mirrors it. */
export type ShoreDecal = { readonly anchor: BoundaryPoint; readonly kind: "stone" | "weed"; readonly variant: number; readonly flip: boolean; readonly blobs: readonly ShoreBlob[] };

export type ShoreLoop = CellContourLoop & {
  readonly smoothed: readonly BoundaryPoint[];
  /** +1: land lies to the right of travel (normal (-t.y, t.x) points into water); -1: the other way. */
  readonly landSide: 1 | -1;
  /** Per smoothed point: it lies on a water-side wall baseline (D3b). */
  readonly walled: readonly boolean[];
  readonly decals: readonly ShoreDecal[];
  readonly bounds: BoundaryBounds;
  /** Covers the smoothed (and locked) line, the land side and the decals. */
  readonly drawHash: number;
};

export type BridgeEnd = {
  readonly axis: "x" | "y";
  /** Middle of the tile edge between the bank and the first water tile of the span. */
  readonly mid: BoundaryPoint;
  /** Unit vector from the bank toward the water. */
  readonly toWater: BoundaryPoint;
  /** The end away from the camera (north-west of an x bridge, north-east of a y bridge): Wave 4b has its abutment. */
  readonly back: boolean;
};

export type Shoreline = { readonly loops: readonly ShoreLoop[]; readonly bridgeEnds: readonly BridgeEnd[] };

export type ShorelineInput = {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly seed: number;
  readonly bridges: readonly BridgeSpan[];
  /** Water-side stretches of the drawn wall baselines, tile-centre coordinates (D3b). */
  readonly walls?: readonly (readonly BoundaryPoint[])[];
};

export function shoreline(input: ShorelineInput): Shoreline {
  const cells: (Tile | undefined)[] = new Array(input.width * input.height);
  for (const tile of input.tiles) cells[tile.ty * input.width + tile.tx] = tile;
  const isWater = (tx: number, ty: number): boolean => cells[ty * input.width + tx]?.terrain === "water";
  const bridgeEnds = bridgeEndsOf(input.bridges);
  const snap = wallSnapper(input.walls ?? []);
  const loops = cellContourLoops({ width: input.width, height: input.height, inside: isWater, outside: false }).map(loop => {
    const snapped = chaikinClosed(loop.points, BOUNDARY_CHAIKIN_ROUNDS).map(point => snap(lockToBridges(point, bridgeEnds)));
    const smoothed = snapped.map(entry => entry.point);
    const walled = snapped.map(entry => entry.walled);
    const landSide = landSideOf(smoothed, isWater, input.width, input.height);
    const decals = shoreDecals(smoothed, landSide, isWater, input, bridgeEnds, loop.hash);
    const bounds = boundsOf([...smoothed, ...decals.map(decal => decal.anchor)], 1);
    return { ...loop, smoothed, landSide, walled, decals, bounds,
      drawHash: hashNumbers([loop.hash, landSide, ...smoothed.flatMap(point => [point.x, point.y]), ...walled.map(flag => flag ? 1 : 0),
        ...decals.flatMap(decal => [decal.anchor.x, decal.anchor.y, decal.kind === "stone" ? 1 : 2, decal.variant, decal.flip ? 1 : 0, decal.blobs.length])]) };
  });
  return { loops, bridgeEnds };
}

/** Every bridge's two bank edges, once per span (spans are listed per water tile). */
export function bridgeEndsOf(bridges: readonly BridgeSpan[]): BridgeEnd[] {
  const ends = new Map<string, BridgeEnd>();
  for (const span of bridges) {
    const dir = span.axis === "x" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    for (const bank of span.banks) {
      const water = span.water.find(cell => Math.abs(cell.tx - bank.tx) + Math.abs(cell.ty - bank.ty) === 1);
      if (water === undefined) continue;
      const toWater = { x: water.tx - bank.tx, y: water.ty - bank.ty };
      const mid = { x: (water.tx + bank.tx) / 2, y: (water.ty + bank.ty) / 2 };
      // The bank with the smaller coordinate along the axis is the back end (the water lies toward +axis).
      ends.set(`${mid.x},${mid.y}`, { axis: span.axis, mid, toWater, back: toWater.x * dir.x + toWater.y * dir.y > 0 });
    }
  }
  return [...ends.values()].sort((a, b) => a.mid.y - b.mid.y || a.mid.x - b.mid.x);
}

function lockToBridges(point: BoundaryPoint, ends: readonly BridgeEnd[]): BoundaryPoint {
  let result = point;
  for (const end of ends) {
    // `along` runs on the bank edge line, `across` along the bridge axis (0 on the edge line).
    const across = end.axis === "x" ? result.x - end.mid.x : result.y - end.mid.y;
    const along = end.axis === "x" ? result.y - end.mid.y : result.x - end.mid.x;
    if (Math.abs(along) > BRIDGE_LOCK_REACH || Math.abs(across) > 0.6) continue;
    const weight = Math.abs(along) <= BRIDGE_LOCK_FULL ? 1 : (BRIDGE_LOCK_REACH - Math.abs(along)) / (BRIDGE_LOCK_REACH - BRIDGE_LOCK_FULL);
    result = end.axis === "x" ? { x: result.x - across * weight, y: result.y } : { x: result.x, y: result.y - across * weight };
  }
  return result;
}

function landSideOf(line: readonly BoundaryPoint[], isWater: (tx: number, ty: number) => boolean, width: number, height: number): 1 | -1 {
  let votes = 0;
  for (let index = 0; index < line.length; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % line.length] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const probe = { x: (a.x + b.x) / 2 + normal.x * 0.3, y: (a.y + b.y) / 2 + normal.y * 0.3 };
    const tx = Math.round(probe.x); const ty = Math.round(probe.y);
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    votes += isWater(tx, ty) ? -1 : 1;
  }
  // Normal (-t.y, t.x) probes land when votes > 0: the land lies on that side.
  return votes >= 0 ? 1 : -1;
}

function shoreDecals(line: readonly BoundaryPoint[], landSide: 1 | -1, isWater: (tx: number, ty: number) => boolean,
  input: ShorelineInput, ends: readonly BridgeEnd[], loopHash: number): ShoreDecal[] {
  const decals: ShoreDecal[] = [];
  let arc = 0;
  let next = DECAL_SPACING_MIN * (0.3 + 0.7 * ((boundaryHash(loopHash, input.seed, 91) % 1000) / 1000));
  for (let index = 0; index < line.length; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % line.length] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    while (length > 0 && arc + length >= next) {
      const t = (next - arc) / length;
      const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const toWater = { x: (b.y - a.y) / length * landSide, y: -(b.x - a.x) / length * landSide };
      const hash = boundaryHash(Math.round(at.x * 16) * 4099 + Math.round(at.y * 16), input.seed, 93);
      const depth = DECAL_DEPTH_MIN + (DECAL_DEPTH_MAX - DECAL_DEPTH_MIN) * ((hash % 1000) / 999);
      const anchor = { x: at.x + toWater.x * depth, y: at.y + toWater.y * depth };
      const tx = Math.round(anchor.x); const ty = Math.round(anchor.y);
      const clear = ends.every(end => Math.hypot(end.mid.x - anchor.x, end.mid.y - anchor.y) >= DECAL_BRIDGE_CLEARANCE);
      if (clear && tx >= 0 && ty >= 0 && tx < input.width && ty < input.height && isWater(tx, ty)) {
        const count = 2 + ((hash >>> 10) % 2);
        const blobs: ShoreBlob[] = [];
        for (let blob = 0; blob < count; blob += 1) {
          const h = boundaryHash(hash + blob * 131, input.seed, 97);
          blobs.push({ dx: ((h % 100) / 99 - 0.5) * 0.16, dy: (((h >>> 7) % 100) / 99 - 0.5) * 0.1,
            rx: 0.035 + ((h >>> 14) % 100) / 99 * 0.015, ry: 0.025 + ((h >>> 21) % 100) / 99 * 0.012 });
        }
        const kind = ((hash >>> 4) % 5) < 3 ? "stone" : "weed";
        decals.push({ anchor, kind, variant: (hash >>> 12) % (kind === "stone" ? 2 : 3), flip: ((hash >>> 15) & 1) === 1, blobs });
      }
      next += DECAL_SPACING_MIN + DECAL_SPACING_SPAN * ((boundaryHash(Math.round(next * 64), loopHash, 95) % 1000) / 999);
    }
    arc += length;
  }
  return decals;
}

/** Nearest point on the water-side wall stretches within WALL_SNAP (bucketed by tile), or the point itself. */
function wallSnapper(walls: readonly (readonly BoundaryPoint[])[]): (point: BoundaryPoint) => { point: BoundaryPoint; walled: boolean } {
  const buckets = new Map<string, [BoundaryPoint, BoundaryPoint][]>();
  for (const line of walls) for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    for (let y = Math.floor(Math.min(a.y, b.y) - 1); y <= Math.ceil(Math.max(a.y, b.y) + 1); y += 1) {
      for (let x = Math.floor(Math.min(a.x, b.x) - 1); x <= Math.ceil(Math.max(a.x, b.x) + 1); x += 1) {
        const key = `${x},${y}`; const list = buckets.get(key);
        if (list === undefined) buckets.set(key, [[a, b]]); else list.push([a, b]);
      }
    }
  }
  return point => {
    let best: BoundaryPoint | null = null; let distance = WALL_SNAP;
    for (const [a, b] of buckets.get(`${Math.floor(point.x)},${Math.floor(point.y)}`) ?? []) {
      const dx = b.x - a.x; const dy = b.y - a.y; const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
      const candidate = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (d < distance) { distance = d; best = candidate; }
    }
    return best === null ? { point, walled: false } : { point: best, walled: true };
  };
}
