import type { TileCoordinate } from "./grid";
import { getTile } from "./grid";
import type { WallGrid } from "./wallTraversal";
import { canTraverseRoadBoundary } from "./bridges";

export interface RoadPathRequest {
  readonly start: TileCoordinate;
  readonly destination: TileCoordinate;
}

export function canPlaceRoad(grid: WallGrid, coordinate: TileCoordinate): boolean {
  const tile = getTile(grid, coordinate);
  return (
    tile !== null &&
    tile.buildingId === null &&
    !tile.hasRoad &&
    tile.terrain !== "water"
  );
}

export function roadLine(
  start: TileCoordinate,
  destination: TileCoordinate,
): readonly TileCoordinate[] {
  const deltaX = destination.tx - start.tx;
  const deltaY = destination.ty - start.ty;
  // Equal diagonal drags resolve horizontally for stable pointer behavior.
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
  const steps = Math.abs(horizontal ? deltaX : deltaY);
  const direction = Math.sign(horizontal ? deltaX : deltaY);
  const coordinates: TileCoordinate[] = [];

  for (let step = 0; step <= steps; step += 1) {
    coordinates.push(
      horizontal
        ? { tx: start.tx + step * direction, ty: start.ty }
        : { tx: start.tx, ty: start.ty + step * direction },
    );
  }

  return coordinates;
}

// SMOOTH-2E: each tile's road steps (north, east, south, west — the neighbour order every search keeps) and whether it
// is a road tile at all, read once per immutable tile array and wall. The key is `labelRoadComponents`' own: tiles and
// wall are immutable, so their identities are the whole input of `canTraverseRoadBoundary` (terrain, roads, a bridge's
// tiles, the palisade); a new road or building makes a new tile array. Before, every step of every search re-derived
// both with fresh objects (the 1380 town's tick allocated ~3.4 MB, a third of it in the road searches).
const STEP_X = [0, 1, 0, -1] as const;
const STEP_Y = [-1, 0, 1, 0] as const;
const COMPUTED = 0x80;
const ROAD = 0x10;
interface RoadSteps { readonly width: number; readonly height: number; readonly wall: WallGrid["palisade"]; readonly masks: Uint8Array }
const roadSteps = new WeakMap<WallGrid["tiles"], RoadSteps>();

function roadStepsOf(grid: WallGrid): RoadSteps {
  const cached = typeof grid.tiles === "object" && grid.tiles !== null ? roadSteps.get(grid.tiles) : undefined;
  if (cached?.width === grid.width && cached.height === grid.height && cached.wall === grid.palisade) return cached;
  const fresh = { width: grid.width, height: grid.height, wall: grid.palisade, masks: new Uint8Array(Math.max(0, grid.width * grid.height) || 0) };
  if (typeof grid.tiles === "object" && grid.tiles !== null) roadSteps.set(grid.tiles, fresh);
  return fresh;
}

function stepMask(grid: WallGrid, steps: RoadSteps, index: number): number {
  const known = steps.masks[index]!;
  if (known !== 0) return known;
  const tx = index % grid.width;
  const ty = (index - tx) / grid.width;
  const from = { tx, ty };
  let mask = COMPUTED;
  if (grid.tiles[index]?.hasRoad === true && canTraverseRoadBoundary(grid, from, from)) mask |= ROAD;
  for (let direction = 0; direction < 4; direction += 1) {
    const to = { tx: tx + STEP_X[direction]!, ty: ty + STEP_Y[direction]! };
    if (getTile(grid, to)?.hasRoad === true && canTraverseRoadBoundary(grid, from, to)) mask |= 1 << direction;
  }
  steps.masks[index] = mask;
  return mask;
}

/** The tile's index, or -1 off the map (or off the integer grid: those keep the old per-call reading). */
function tileIndex(grid: WallGrid, coordinate: TileCoordinate): number {
  const { tx, ty } = coordinate;
  return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height ? ty * grid.width + tx : -1;
}

export function getOrthogonalRoadNeighbors(
  grid: WallGrid,
  coordinate: TileCoordinate,
): readonly TileCoordinate[] {
  const index = tileIndex(grid, coordinate);
  if (index < 0) {
    const candidates = [0, 1, 2, 3].map(direction => ({ tx: coordinate.tx + STEP_X[direction]!, ty: coordinate.ty + STEP_Y[direction]! }));
    return candidates.filter((candidate) => getTile(grid, candidate)?.hasRoad === true && canTraverseRoadBoundary(grid, coordinate, candidate));
  }
  const mask = stepMask(grid, roadStepsOf(grid), index);
  const neighbours: TileCoordinate[] = [];
  for (let direction = 0; direction < 4; direction += 1) {
    if ((mask & (1 << direction)) !== 0) neighbours.push({ tx: coordinate.tx + STEP_X[direction]!, ty: coordinate.ty + STEP_Y[direction]! });
  }
  return neighbours;
}

function roadCoordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function isRoadTile(grid: WallGrid, coordinate: TileCoordinate): boolean {
  const index = tileIndex(grid, coordinate);
  if (index < 0) return getTile(grid, coordinate)?.hasRoad === true && canTraverseRoadBoundary(grid, coordinate, coordinate);
  return (stepMask(grid, roadStepsOf(grid), index) & ROAD) !== 0;
}

export function existingRoadComponent(
  grid: WallGrid,
  starts: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const frontier = starts.filter((start) => isRoadTile(grid, start));
  const component: TileCoordinate[] = [];
  const visited = new Set<string>();

  for (let queueIndex = 0; queueIndex < frontier.length; queueIndex += 1) {
    const current = frontier[queueIndex];
    if (current === undefined) continue;
    const currentKey = roadCoordinateKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    component.push(current);

    for (const neighbor of getOrthogonalRoadNeighbors(grid, current)) {
      if (!visited.has(roadCoordinateKey(neighbor))) frontier.push(neighbor);
    }
  }

  return component;
}

// SMOOTH-2E: a breadth-first search in reused buffers — a visit stamp (no clearing between searches), the parent index
// and the queue. The order is the old search's (queue order, neighbours north, east, south, west, a parent set when a
// tile is first reached), so every path is the same tile for tile; its first and last entries are the caller's own
// start and destination objects, as before.
let visitStamp = new Uint32Array(0);
let parentOf = new Int32Array(0);
let queue = new Int32Array(0);
let stamp = 0;

/** Searches from `start` until every target index is reached or the road runs out; the parents are left in the buffers. */
function searchFrom(grid: WallGrid, start: number, targets: readonly number[]): void {
  const size = grid.width * grid.height;
  if (visitStamp.length < size) { visitStamp = new Uint32Array(size); parentOf = new Int32Array(size); queue = new Int32Array(size); stamp = 0; }
  stamp += 1;
  if (stamp === 0xffffffff) { visitStamp.fill(0); stamp = 1; }
  const steps = roadStepsOf(grid);
  visitStamp[start] = stamp;
  parentOf[start] = -1;
  queue[0] = start;
  let tail = 1;
  let unreached = 0;
  for (let at = 0; at < targets.length; at += 1) if (targets[at]! >= 0 && targets[at] !== start) unreached += 1;
  for (let head = 0; head < tail && unreached > 0; head += 1) {
    const current = queue[head]!;
    const mask = stepMask(grid, steps, current);
    const tx = current % grid.width;
    const ty = (current - tx) / grid.width;
    for (let direction = 0; direction < 4; direction += 1) {
      if ((mask & (1 << direction)) === 0) continue;
      const next = (ty + STEP_Y[direction]!) * grid.width + tx + STEP_X[direction]!;
      if (visitStamp[next] === stamp) continue;
      visitStamp[next] = stamp;
      parentOf[next] = current;
      queue[tail++] = next;
      for (let at = 0; at < targets.length; at += 1) if (targets[at] === next) unreached -= 1;
    }
  }
}

/** Tiles on the searched path to `destination` (1 for the start itself), or null when the search did not reach it. */
function reachedLength(destination: number): number | null {
  if (destination < 0 || visitStamp[destination] !== stamp) return null;
  let length = 1;
  for (let at = parentOf[destination]!; at >= 0; at = parentOf[at]!) length += 1;
  return length;
}

function reachedPath(grid: WallGrid, start: TileCoordinate, destination: TileCoordinate, destinationIndex: number): readonly TileCoordinate[] {
  const path: TileCoordinate[] = [destination];
  for (let at = parentOf[destinationIndex]!; at >= 0; at = parentOf[at]!) {
    if (parentOf[at] === -1) { path.push(start); break; }
    const tx = at % grid.width;
    path.push({ tx, ty: (at - tx) / grid.width });
  }
  return path.reverse();
}

export function findExistingRoadPath(
  grid: WallGrid,
  request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  if (!isRoadTile(grid, request.start) || !isRoadTile(grid, request.destination)) {
    return null;
  }
  const start = tileIndex(grid, request.start);
  const destination = tileIndex(grid, request.destination);
  if (start === destination) return [request.destination];
  searchFrom(grid, start, [destination]);
  return reachedLength(destination) === null ? null : reachedPath(grid, request.start, request.destination, destination);
}

/**
 * The shortest `findExistingRoadPath(start, destination)` over every start and destination — among equals the first
 * (starts in order, then destinations) — with one search per start instead of one per pair. A search sets a tile's
 * parent when it first reaches it, so the tree toward each destination is the pair search's own.
 */
export function shortestExistingRoadPath(
  grid: WallGrid,
  starts: readonly TileCoordinate[],
  destinations: readonly TileCoordinate[],
): readonly TileCoordinate[] | null {
  const targets = destinations.map(destination => isRoadTile(grid, destination) ? tileIndex(grid, destination) : -1);
  if (!targets.some(target => target >= 0)) return null;
  let best: readonly TileCoordinate[] | null = null;
  for (const start of starts) {
    if (!isRoadTile(grid, start)) continue;
    const from = tileIndex(grid, start);
    searchFrom(grid, from, targets);
    let chosen = -1;
    let chosenLength = best?.length ?? Infinity;
    for (let position = 0; position < destinations.length; position += 1) {
      const length = targets[position] === from ? 1 : reachedLength(targets[position]!);
      if (length !== null && length < chosenLength) { chosen = position; chosenLength = length; }
    }
    if (chosen < 0) continue;
    // The buffers belong to this start's search: take its path before the next start searches.
    best = targets[chosen] === from ? [destinations[chosen]!] : reachedPath(grid, start, destinations[chosen]!, targets[chosen]!);
  }
  return best;
}

export function findRoadPath(
  grid: WallGrid,
  request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  const line = roadLine(request.start, request.destination);
  if (!line.every((coordinate) => canPlaceRoad(grid, coordinate))) return null;

  return line;
}

// Keep only the latest wall/dimension interpretation of an immutable tile array.
const componentLabels = new WeakMap<WallGrid["tiles"], {
  readonly width: number;
  readonly height: number;
  readonly wall: WallGrid["palisade"];
  readonly labels: ReadonlyMap<string, number>;
}>();

/** Membership only: ordered BFS and transport route selection remain unchanged. */
export function labelRoadComponents(grid: WallGrid): ReadonlyMap<string, number> {
  const cached = componentLabels.get(grid.tiles);
  if (cached?.width === grid.width && cached.height === grid.height && cached.wall === grid.palisade) return cached.labels;
  const labels = new Map<string, number>();
  let component = 0;
  for (let index = 0; index < grid.width * grid.height; index += 1) {
    const tile = { tx: index % grid.width, ty: Math.floor(index / grid.width) };
    if (labels.has(roadCoordinateKey(tile)) || !isRoadTile(grid, tile)) continue;
    for (const coordinate of existingRoadComponent(grid, [tile])) labels.set(roadCoordinateKey(coordinate), component);
    component += 1;
  }
  componentLabels.set(grid.tiles, { width: grid.width, height: grid.height, wall: grid.palisade, labels });
  return labels;
}
