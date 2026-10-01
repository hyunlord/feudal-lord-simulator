import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { Tile } from "../world/world.types";
import { GROUND_CHUNK_TILES } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import type { FlowDirection } from "./waterMotionModel";
import { mix } from "./weatherPlacement";

// INSTALL-29 water motion placement: where each effect goes. Pure in (the tiles, the seed, the shore loops).
//  - Depth classes per tile (`kind`), from the distance to the shore in tiles (Chebyshev, off-map is not shore):
//    deep = water with no land among its 8 neighbours; shallow = water with land among them, and land with water among
//    them (the smoothed shoreline cuts into both sides' corner diamonds: the shallow fill is clipped to the water, so
//    only its water part shows). The shallow mask thus runs from the shore line to ~1.5 tiles out; the lake inside it
//    is deep. Every water tile is exactly one class, so no two ripple sheets meet on a pixel.
//  - River, in a state without the engine's river (saves v31 and older: a water tile is a water tile), from the
//    shape: a water tile whose contiguous water run along its row or its column is at most RIVER_MAX_WIDTH (a run reaching the map
//    edge counts as open: the water goes on), in an 8-connected set of such tiles of at least RIVER_MIN_TILES that
//    runs at least RIVER_MIN_LENGTH steps from its upstream end (a lake's tapering tip or a narrow bay is a few tiles
//    and a step or two long: still water, no flow; the palisade-construction save's south bay is one). Its flow
//    direction per tile: the channel's local axis (the principal axis of the set's tiles within 2 of it), pointed
//    away from the upstream end — where the channel meets open water (it drains the lake), or, touching none, its end
//    nearest the top of the screen — and snapped to the four sheets' screen diagonals. Land beside a river takes the neighbouring river tile's class and flow.
//    LAND-UI: with the engine's river (`state.river`) the channel and its flow are the river's instead
//    (waterRiverFlow.ts, passed as `options.river`): its cells are river, every other water is deep or shallow as above.
//    Ford roads (`options.fordRoads`) and the land beside them keep their class (so no neighbour's changes) but lose
//    their flow: the ford art covers them. The mill race cells (`chunkWater`'s `race`) leave the flow lists for the race's.
//  - Glints and fish rings: sparse seeded picks of deep tiles (GLINT_PICK, FISH_PICK), jittered inside the tile.
//  - The foam and ice bands along the shore: waterShoreBand.ts.
export const KIND = { none: 0, deep: 1, shallow: 2, river: 3 } as const;
export const RIVER_MAX_WIDTH = 3;
export const RIVER_MIN_TILES = 8;
export const RIVER_MIN_LENGTH = 6;
const LOCAL_ANISOTROPY = 2;
const GLINT_PICK = 12;
const FISH_PICK = 5;
const JITTER = 0.3;

export interface WaterMap {
  readonly width: number;
  readonly height: number;
  /** Per tile (ty * width + tx): a KIND value. */
  readonly kind: Uint8Array;
  /** Per tile: the flow direction of a river tile, else null. */
  readonly flow: readonly (FlowDirection | null)[];
}

export interface WaterSpot { readonly x: number; readonly y: number; readonly hash: number }
export interface ChunkWater {
  readonly deep: readonly Tile[];
  readonly shallow: readonly Tile[];
  readonly flow: Readonly<Record<FlowDirection, readonly Tile[]>>;
  /** The mill race's tiles by their flow (none without a `race`). */
  readonly race: Readonly<Record<FlowDirection, readonly Tile[]>>;
  readonly glints: readonly WaterSpot[];
  readonly fish: readonly WaterSpot[];
}

const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/** Contiguous water run lengths along rows (axis 0) or columns (axis 1); a run touching the map edge is Infinity. */
function runs(water: readonly boolean[], width: number, height: number, axis: 0 | 1): Float64Array {
  const out = new Float64Array(width * height);
  const lines = axis === 0 ? height : width; const length = axis === 0 ? width : height;
  const at = (line: number, step: number) => axis === 0 ? line * width + step : step * width + line;
  for (let line = 0; line < lines; line += 1) {
    for (let step = 0; step < length;) {
      if (!water[at(line, step)]) { step += 1; continue; }
      let end = step;
      while (end + 1 < length && water[at(line, end + 1)]) end += 1;
      const run = step === 0 || end === length - 1 ? Infinity : end - step + 1;
      for (let index = step; index <= end; index += 1) out[at(line, index)] = run;
      step = end + 1;
    }
  }
  return out;
}

/** The most steps (8-connected, inside the set) from the upstream end to a tile of the set: the channel's length. */
function channelLength(inSet: ReadonlySet<number>, ends: readonly number[], width: number): number {
  const steps = new Map<number, number>(ends.map(index => [index, 0]));
  const queue = [...ends]; let longest = 0;
  for (let at = 0; at < queue.length; at += 1) {
    const index = queue[at] as number; const step = steps.get(index) ?? 0; longest = Math.max(longest, step);
    for (const [dx, dy] of NEIGHBOURS) {
      const x = (index % width) + dx; const next = index + dy * width + dx;
      if (x < 0 || x >= width || !inSet.has(next) || steps.has(next)) continue;
      steps.set(next, step + 1); queue.push(next);
    }
  }
  return longest;
}

function screenDirection(dx: number, dy: number): FlowDirection {
  const sx = dx - dy; const sy = dx + dy;
  return sx >= 0 ? (sy < 0 ? "ne" : "se") : (sy < 0 ? "nw" : "sw");
}

/** The river tiles' flow (see the head comment), keyed by tile index. */
function riverFlow(water: readonly boolean[], width: number, height: number): Map<number, FlowDirection> {
  const byRow = runs(water, width, height, 0); const byColumn = runs(water, width, height, 1);
  const narrow = water.map((wet, index) => wet && Math.min(byRow[index] ?? 0, byColumn[index] ?? 0) <= RIVER_MAX_WIDTH);
  const flow = new Map<number, FlowDirection>();
  const seen = new Uint8Array(width * height);
  for (let first = 0; first < narrow.length; first += 1) {
    if (!narrow[first] || seen[first] === 1) continue;
    const members: number[] = []; const stack = [first]; seen[first] = 1;
    while (stack.length > 0) {
      const index = stack.pop() as number; members.push(index);
      const tx = index % width; const ty = Math.floor(index / width);
      for (const [dx, dy] of NEIGHBOURS) {
        const x = tx + dx; const y = ty + dy; const next = y * width + x;
        if (x < 0 || y < 0 || x >= width || y >= height || !narrow[next] || seen[next] === 1) continue;
        seen[next] = 1; stack.push(next);
      }
    }
    if (members.length < RIVER_MIN_TILES) continue;
    const inSet = new Set(members);
    const point = (index: number) => ({ x: index % width, y: Math.floor(index / width) });
    const contact = members.filter(index => NEIGHBOURS.some(([dx, dy]) => {
      const { x, y } = point(index); const next = (y + dy) * width + x + dx;
      return x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height && water[next] === true && !narrow[next];
    }));
    const ends = contact.length > 0 ? contact : [members.reduce((best, index) => { const a = point(index); const b = point(best); return a.x + a.y < b.x + b.y ? index : best; })];
    if (channelLength(inSet, ends, width) < RIVER_MIN_LENGTH) continue;
    const upstream = { x: ends.reduce((sum, index) => sum + point(index).x, 0) / ends.length, y: ends.reduce((sum, index) => sum + point(index).y, 0) / ends.length };
    // The whole channel's way: from the upstream end to its farthest tile.
    const farthest = point(members.reduce((best, index) => Math.hypot(point(index).x - upstream.x, point(index).y - upstream.y) > Math.hypot(point(best).x - upstream.x, point(best).y - upstream.y) ? index : best));
    const way = { x: farthest.x - upstream.x, y: farthest.y - upstream.y };
    const raw = new Map<number, FlowDirection>();
    for (const index of members) {
      const at = point(index);
      const local: BoundaryPoint[] = [];
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (inSet.has((at.y + dy) * width + at.x + dx) && at.x + dx >= 0 && at.x + dx < width) local.push({ x: at.x + dx, y: at.y + dy });
      const mean = { x: local.reduce((sum, p) => sum + p.x, 0) / local.length, y: local.reduce((sum, p) => sum + p.y, 0) / local.length };
      let xx = 0, yy = 0, xy = 0;
      for (const p of local) { xx += (p.x - mean.x) ** 2; yy += (p.y - mean.y) ** 2; xy += (p.x - mean.x) * (p.y - mean.y); }
      // A local axis only where the channel is clearly longer than wide there (eigenvalue ratio >= LOCAL_ANISOTROPY);
      // in a blob-like stretch the channel's whole way instead.
      const spread = Math.sqrt(((xx - yy) / 2) ** 2 + xy ** 2); const major = (xx + yy) / 2 + spread; const minor = (xx + yy) / 2 - spread;
      const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
      let axis = major >= LOCAL_ANISOTROPY * Math.max(minor, 1e-6) ? { x: Math.cos(angle), y: Math.sin(angle) } : way;
      const along = axis.x * (at.x - upstream.x) + axis.y * (at.y - upstream.y);
      const sign = Math.abs(along) >= 0.5 ? along : axis.x * way.x + axis.y * way.y;
      if (sign < 0) axis = { x: -axis.x, y: -axis.y };
      raw.set(index, screenDirection(axis.x, axis.y));
    }
    // A lone tile against its neighbours (at a junction or the channel's last tile, where the local axis turns) takes
    // their direction: each tile the most common one within 2 of it (its own on a tie), so a channel reads as one stream.
    for (const index of members) {
      const tally = new Map<FlowDirection, number>();
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        const x = (index % width) + dx; const direction = raw.get(index + dy * width + dx);
        if (x >= 0 && x < width && direction !== undefined) tally.set(direction, (tally.get(direction) ?? 0) + 1);
      }
      const own = raw.get(index) as FlowDirection;
      flow.set(index, [...tally].reduce((best, [direction, count]) => count > (tally.get(best) ?? 0) ? direction : best, own));
    }
  }
  return flow;
}

export interface WaterOptions {
  /** The engine's river: its water cells' flow (waterRiverFlow.ts riverFlowCells); absent: read from the shape. */
  readonly river?: ReadonlyMap<number, FlowDirection> | null;
  /** The ford cells with a road: river with no flow, and the land beside them too. */
  readonly fordRoads?: ReadonlySet<number>;
}

export function analyseWater(tiles: readonly Tile[], width: number, height: number, options: WaterOptions = {}): WaterMap {
  const water = Array.from({ length: width * height }, (_, index) => tiles[index]?.terrain === "water");
  const rivers = options.river ?? riverFlow(water, width, height);
  const kind = new Uint8Array(width * height);
  const flow: (FlowDirection | null)[] = new Array(width * height).fill(null);
  for (let index = 0; index < water.length; index += 1) {
    const tx = index % width; const ty = Math.floor(index / width);
    const around = NEIGHBOURS.map(([dx, dy]) => tx + dx < 0 || ty + dy < 0 || tx + dx >= width || ty + dy >= height ? -1 : (ty + dy) * width + tx + dx).filter(next => next >= 0);
    const river = rivers.get(index);
    if (water[index]) {
      if (river !== undefined) { kind[index] = KIND.river; flow[index] = river; } else kind[index] = around.some(next => !water[next]) ? KIND.shallow : KIND.deep;
      continue;
    }
    const wet = around.filter(next => water[next]);
    if (wet.length === 0) continue;
    const beside = wet.find(next => rivers.has(next));
    if (wet.every(next => rivers.has(next)) && beside !== undefined) { kind[index] = KIND.river; flow[index] = rivers.get(beside) ?? null; } else kind[index] = KIND.shallow;
  }
  for (const index of options.fordRoads ?? []) {
    flow[index] = null;
    for (const [dx, dy] of NEIGHBOURS) {
      const x = (index % width) + dx; const y = Math.floor(index / width) + dy; const next = y * width + x;
      if (x >= 0 && y >= 0 && x < width && y < height && !water[next]) flow[next] = null;
    }
  }
  return { width, height, kind, flow };
}

/** The tiles of chunk (cx, cy) by class, and its glint / fish spots (world px). */
export function chunkWater(map: WaterMap, tiles: readonly Tile[], seed: number, cx: number, cy: number, race?: ReadonlyMap<number, FlowDirection>): ChunkWater {
  const deep: Tile[] = []; const shallow: Tile[] = []; const flow: Record<FlowDirection, Tile[]> = { ne: [], nw: [], se: [], sw: [] };
  const races: Record<FlowDirection, Tile[]> = { ne: [], nw: [], se: [], sw: [] };
  const glints: WaterSpot[] = []; const fish: WaterSpot[] = [];
  for (let ty = cy * GROUND_CHUNK_TILES; ty < Math.min(map.height, (cy + 1) * GROUND_CHUNK_TILES); ty += 1) {
    for (let tx = cx * GROUND_CHUNK_TILES; tx < Math.min(map.width, (cx + 1) * GROUND_CHUNK_TILES); tx += 1) {
      const index = ty * map.width + tx; const tile = tiles[index];
      if (tile === undefined) continue;
      const kind = map.kind[index]; const raced = race?.get(index);
      if (raced !== undefined) races[raced].push(tile);
      else if (kind === KIND.shallow) shallow.push(tile);
      else if (kind === KIND.river) { const direction = map.flow[index]; if (direction !== null && direction !== undefined) flow[direction].push(tile); }
      else if (kind === KIND.deep) {
        deep.push(tile);
        const spot = (salt: number): WaterSpot => {
          const hash = mix(seed, tx, ty, salt);
          const jx = ((hash % 1000) / 1000 - 0.5) * 2 * JITTER; const jy = ((Math.floor(hash / 1000) % 1000) / 1000 - 0.5) * 2 * JITTER;
          const at = tileToScreen(tx + jx, ty + jy);
          return { x: at.sx, y: at.sy, hash };
        };
        if (mix(seed, tx, ty, 29_101) % GLINT_PICK === 0) glints.push(spot(29_103));
        if (mix(seed, tx, ty, 29_201) % FISH_PICK === 0) fish.push(spot(29_203));
      }
    }
  }
  return { deep, shallow, flow, race: races, glints, fish };
}
