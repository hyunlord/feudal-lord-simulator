import type { WallConstructionSite } from '../economy/construction';
import { WALL_CARRY_COST_FACTOR } from '../content/wallConstructionConfig';
import { canTraverseRoadBoundary } from '../world/bridges';
import { getTile, type TileCoordinate } from '../world/grid';
import { getOrthogonalRoadNeighbors } from '../world/roadGraph';
import { isPointInsidePalisade, type TileEdgePoint } from '../world/palisadeGeometry';
import type { GameState } from './engine.types';
import { palisadeRingPoints, palisadeStepPoints } from './palisadeSegments';

export type WallCarryRoute = Readonly<{
  path: readonly TileCoordinate[];
  cost: number;
  wallSteps: number;
  anchorEdge: number;
}>;

type WallNode = Readonly<{ edge: number; tile: TileCoordinate }>;
type WallNetwork = Readonly<{ nodes: readonly WallNode[]; edgeNodes: readonly (readonly number[])[];
  edgeKeys: readonly string[]; tileKeys: ReadonlySet<string>; transitions: ReadonlySet<string> }>;

/* Wall and tile-array identity invalidate this graph when construction completion or roads/occupancy change.
   Width/height are immutable for a wall+tile array; stock and workers affect route sources, not this graph.
   Natural 12-site fixture, 200 lookups: cold wall identity 14.3 ms; reused graph 8.9 ms (local run). */
const networkCache = new WeakMap<NonNullable<GameState['palisade']>, WeakMap<GameState['tiles'], WallNetwork>>();
const tileKey = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
const edgeKey = (from: TileEdgePoint, to: TileEdgePoint): string =>
  `${from.x},${from.y}:${to.x},${to.y}`;
const distance = (left: TileCoordinate, right: TileCoordinate): number =>
  Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
const transitionKey = (from: TileCoordinate, to: TileCoordinate): string => `${tileKey(from)}>${tileKey(to)}`;

function adjacentTiles(from: TileEdgePoint, to: TileEdgePoint): readonly TileCoordinate[] {
  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  if (from.y === to.y) return [{ tx: minX, ty: from.y - 1 }, { tx: minX, ty: from.y }];
  if (from.x === to.x) return [{ tx: from.x - 1, ty: minY }, { tx: from.x, ty: minY }];
  return [
    { tx: minX, ty: minY }, { tx: minX + 1, ty: minY },
    { tx: minX, ty: minY + 1 }, { tx: minX + 1, ty: minY + 1 },
  ];
}

function openDiagonalCorner(state: GameState, from: TileCoordinate, to: TileCoordinate): boolean {
  const polygon = state.palisade?.polygon;
  if (polygon === undefined) return false;
  return [{ tx: from.tx, ty: to.ty }, { tx: to.tx, ty: from.ty }].some(side => {
    const ground = getTile(state, side);
    return ground !== null && ground.terrain !== 'water' && ground.buildingId === null
      && isPointInsidePalisade({ x: side.tx + 0.5, y: side.ty + 0.5 }, polygon)
      && canTraverseRoadBoundary(state, from, side)
      && canTraverseRoadBoundary(state, side, to);
  });
}

function wallNetwork(state: GameState): WallNetwork | null {
  const wall = state.palisade;
  if (wall === null) return null;
  const cached = networkCache.get(wall)?.get(state.tiles);
  if (cached !== undefined) return cached;
  const ring = palisadeRingPoints(wall.polygon);
  const nodes: WallNode[] = [];
  const edgeNodes: number[][] = [];
  const edgeKeys: string[] = [];
  const tileKeys = new Set<string>();
  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];
    if (from === undefined || to === undefined) continue;
    edgeKeys.push(edgeKey(from, to));
    const candidates = adjacentTiles(from, to).filter(tile => {
      const ground = getTile(state, tile);
      return ground !== null && ground.terrain !== 'water' && ground.buildingId === null
        && isPointInsidePalisade({ x: tile.tx + 0.5, y: tile.ty + 0.5 }, wall.polygon);
    });
    edgeNodes.push(candidates.map(tile => {
      const id = nodes.length;
      nodes.push({ edge: index, tile });
      tileKeys.add(tileKey(tile));
      return id;
    }));
  }
  const transitions = new Set<string>();
  for (let edge = 0; edge < edgeNodes.length; edge += 1) {
    for (const fromId of edgeNodes[edge] ?? []) {
      const from = nodes[fromId];
      if (from === undefined) continue;
      for (const toId of edgeNodes[(edge + 1) % edgeNodes.length] ?? []) {
        const to = nodes[toId];
        if (to === undefined || Math.max(Math.abs(from.tile.tx - to.tile.tx),
          Math.abs(from.tile.ty - to.tile.ty)) > 1) continue;
        if (distance(from.tile, to.tile) <= 1
          && !canTraverseRoadBoundary(state, from.tile, to.tile)) continue;
        if (distance(from.tile, to.tile) === 2
          && !openDiagonalCorner(state, from.tile, to.tile)) continue;
        if (!isPointInsidePalisade({ x: (from.tile.tx + to.tile.tx) / 2 + 0.5,
          y: (from.tile.ty + to.tile.ty) / 2 + 0.5 }, wall.polygon)) continue;
        transitions.add(transitionKey(from.tile, to.tile));
        transitions.add(transitionKey(to.tile, from.tile));
      }
    }
  }
  const network = { nodes, edgeNodes, edgeKeys, tileKeys, transitions };
  let forWall = networkCache.get(wall);
  if (forWall === undefined) {
    forWall = new WeakMap<GameState['tiles'], WallNetwork>();
    networkCache.set(wall, forWall);
  }
  forWall.set(state.tiles, network);
  return network;
}

function roadPaths(state: GameState, starts: readonly TileCoordinate[]): ReadonlyMap<string, readonly TileCoordinate[]> {
  const paths = new Map<string, readonly TileCoordinate[]>();
  const queue: TileCoordinate[] = [];
  for (const tile of [...starts].sort((a, b) => a.ty - b.ty || a.tx - b.tx)) {
    const key = tileKey(tile);
    if (getTile(state, tile)?.hasRoad !== true || paths.has(key)) continue;
    paths.set(key, [tile]);
    queue.push(tile);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    const prefix = paths.get(tileKey(current));
    if (prefix === undefined) continue;
    for (const next of getOrthogonalRoadNeighbors(state, current)) {
      const key = tileKey(next);
      if (paths.has(key)) continue;
      paths.set(key, [...prefix, next]);
      queue.push(next);
    }
  }
  return paths;
}

function siteEdges(network: WallNetwork, site: WallConstructionSite): ReadonlySet<number> {
  const steps = palisadeStepPoints(site.path);
  const keys = new Set<string>();
  for (let index = 1; index < steps.length; index += 1) {
    const from = steps[index - 1];
    const to = steps[index];
    if (from === undefined || to === undefined) continue;
    keys.add(edgeKey(from, to));
    keys.add(edgeKey(to, from));
  }
  return new Set(network.edgeKeys.flatMap((key, index) => keys.has(key) ? [index] : []));
}

export function wallCarrySiteAccessTile(state: GameState, site: WallConstructionSite, tile: TileCoordinate): boolean {
  const network = wallNetwork(state);
  if (network === null) return false;
  return [...siteEdges(network, site)].some(edge =>
    network.edgeNodes[edge]?.some(id => tileKey(network.nodes[id]?.tile ?? { tx: -1, ty: -1 }) === tileKey(tile)));
}

export function isWallCarryTile(state: GameState, tile: TileCoordinate): boolean {
  return wallNetwork(state)?.tileKeys.has(tileKey(tile)) === true;
}

export function canTraverseWallCarryEdge(state: GameState, from: TileCoordinate, to: TileCoordinate): boolean {
  return wallNetwork(state)?.transitions.has(transitionKey(from, to)) === true;
}

export function wallCarryRoute(
  state: GameState,
  starts: readonly TileCoordinate[],
  site: WallConstructionSite,
): WallCarryRoute | null {
  const network = wallNetwork(state);
  if (network === null || site.wallId !== state.palisade?.id) return null;
  const targets = siteEdges(network, site);
  if (targets.size === 0) return null;
  const roads = roadPaths(state, starts);
  const best = new Map<number, WallCarryRoute>();
  const queue: { readonly id: number; readonly route: WallCarryRoute }[] = [];
  const offer = (id: number, route: WallCarryRoute): void => {
    const prior = best.get(id);
    if (prior !== undefined && prior.cost <= route.cost) return;
    best.set(id, route);
    queue.push({ id, route });
  };
  for (let edge = 0; edge < network.edgeNodes.length; edge += 1) {
    const ids = network.edgeNodes[edge] ?? [];
    const fromKey = network.edgeKeys[edge];
    if (fromKey === undefined) continue;
    const [fromString, toString] = fromKey.split(':');
    if (fromString === undefined || toString === undefined) continue;
    const [fromX, fromY] = fromString.split(',').map(Number);
    const [toX, toY] = toString.split(',').map(Number);
    if (fromX === undefined || fromY === undefined || toX === undefined || toY === undefined) continue;
    for (const road of adjacentTiles({ x: fromX, y: fromY }, { x: toX, y: toY })) {
      const roadPath = roads.get(tileKey(road));
      if (roadPath === undefined) continue;
      for (const id of ids) {
        const node = network.nodes[id];
        if (node === undefined || distance(road, node.tile) > 1
          || !canTraverseRoadBoundary(state, road, node.tile)) continue;
        const gap = distance(road, node.tile);
        const carried = gap > 0 && getTile(state, node.tile)?.hasRoad !== true;
        offer(id, { path: gap === 0 ? roadPath : [...roadPath, node.tile],
          cost: roadPath.length - 1 + gap * (carried ? WALL_CARRY_COST_FACTOR : 1),
          wallSteps: carried ? gap : 0, anchorEdge: edge });
      }
    }
  }
  while (queue.length > 0) {
    queue.sort((left, right) => left.route.cost - right.route.cost || left.id - right.id);
    const head = queue.shift();
    if (head === undefined || best.get(head.id) !== head.route) continue;
    const node = network.nodes[head.id];
    if (node === undefined) continue;
    if (targets.has(node.edge)) return head.route;
    const count = network.edgeNodes.length;
    for (const nextEdge of [(node.edge + 1) % count, (node.edge + count - 1) % count]) {
      for (const nextId of network.edgeNodes[nextEdge] ?? []) {
        const next = network.nodes[nextId];
        if (next === undefined || !network.transitions.has(transitionKey(node.tile, next.tile))) continue;
        const steps = distance(node.tile, next.tile);
        const carried = steps > 0 && (getTile(state, node.tile)?.hasRoad !== true
          || getTile(state, next.tile)?.hasRoad !== true);
        const path = steps === 0 ? head.route.path : [...head.route.path, next.tile];
        offer(nextId, { path, cost: head.route.cost + steps * (carried ? WALL_CARRY_COST_FACTOR : 1),
          wallSteps: head.route.wallSteps + (carried ? steps : 0), anchorEdge: head.route.anchorEdge });
      }
    }
  }
  return null;
}
