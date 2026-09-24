import { roadTopologySignature } from "../world/roadTopologySignature";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { Building } from "../content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import {
  isBuildingConstructionSite,
  type PalisadeConstructionSite,
  type ConstructionSite,
} from "../economy/construction";
import type { TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import type { WallGrid } from "../world/wallTraversal";
import { canTraverseRoadBoundary } from "../world/bridges";
import { findExistingRoadPath } from "../world/roadGraph";
import type { GameState, RoadPathCache } from "./engine.types";
import { wallCarryRoute } from './wallCarryRoute';

export interface RouteResolution {
  readonly path: readonly TileCoordinate[] | null;
  readonly pathCache: RoadPathCache;
}

function compareCoordinates(left: TileCoordinate, right: TileCoordinate): number {
  if (left.ty !== right.ty) return left.ty - right.ty;
  return left.tx - right.tx;
}

function sameCoordinate(left: TileCoordinate, right: TileCoordinate): boolean {
  return left.tx === right.tx && left.ty === right.ty;
}

function cacheKey(
  state: GameState,
  sourceId: string,
  destinationId: string,
): string {
  return `road:${state.roadRevision}${roadTopologySignature(state.palisade)}:${sourceId}->${destinationId}`;
}

// The revision and completed-wall signature invalidate graph changes. Stable building IDs
// determine access footprints; inventory, tick, and caller direction do not affect the graph.
// Warm 100k natural-city lookups measured 26.55 ms before and 22.21 ms after this key change.
function buildingPairCacheKey(state: GameState, lowerId: string, higherId: string): string {
  return `road:${state.roadRevision}${roadTopologySignature(state.palisade)}:pair:${lowerId}|${higherId}`;
}

function reversedPath(
  path: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  return [...path].reverse();
}

function dedupeSortedRoads(
  grid: WallGrid,
  candidates: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const roads: TileCoordinate[] = [];

  for (const candidate of candidates) {
    if (getTile(grid, candidate)?.hasRoad !== true) continue;
    if (roads.some((road) => sameCoordinate(road, candidate))) continue;
    roads.push(candidate);
  }

  return roads.sort(compareCoordinates);
}

function dedupeSortedNonWaterRoads(
  grid: WallGrid,
  candidates: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const roads: TileCoordinate[] = [];

  for (const candidate of candidates) {
    const tile = getTile(grid, candidate);
    if (tile?.hasRoad !== true || tile.terrain === "water") continue;
    if (roads.some((road) => sameCoordinate(road, candidate))) continue;
    roads.push(candidate);
  }

  return roads.sort(compareCoordinates);
}

export function buildingRoadAccessTiles(
  grid: WallGrid,
  building: Building,
): readonly TileCoordinate[] {
  const definition = buildingFootprint(building);
  const candidates: TileCoordinate[] = [];

  for (let dx = 0; dx < definition.width; dx += 1) {
    candidates.push({ tx: building.tx + dx, ty: building.ty - 1 });
    candidates.push({ tx: building.tx + dx, ty: building.ty + definition.height });
  }

  for (let dy = 0; dy < definition.height; dy += 1) {
    candidates.push({ tx: building.tx - 1, ty: building.ty + dy });
    candidates.push({ tx: building.tx + definition.width, ty: building.ty + dy });
  }

  return dedupeSortedRoads(grid, candidates).filter(road => canTraverseRoadBoundary(grid, {
    tx: Math.max(building.tx, Math.min(road.tx, building.tx + definition.width - 1)),
    ty: Math.max(building.ty, Math.min(road.ty, building.ty + definition.height - 1)),
  }, road));
}

export function constructionSiteRoadAccessTiles(
  grid: WallGrid,
  site: ConstructionSite,
): readonly TileCoordinate[] {
  if (!isBuildingConstructionSite(site)) {
    return palisadeSegmentRoadAccessTiles(grid, site.path);
  }
  const definition = BUILDING_CONFIG_BY_KIND[site.kind];
  const candidates: TileCoordinate[] = [];

  for (let dx = 0; dx < definition.width; dx += 1) {
    candidates.push({ tx: site.tx + dx, ty: site.ty - 1 });
    candidates.push({ tx: site.tx + dx, ty: site.ty + definition.height });
  }

  for (let dy = 0; dy < definition.height; dy += 1) {
    candidates.push({ tx: site.tx - 1, ty: site.ty + dy });
    candidates.push({ tx: site.tx + definition.width, ty: site.ty + dy });
  }

  return dedupeSortedRoads(grid, candidates).filter(road => canTraverseRoadBoundary(grid, {
    tx: Math.max(site.tx, Math.min(road.tx, site.tx + definition.width - 1)),
    ty: Math.max(site.ty, Math.min(road.ty, site.ty + definition.height - 1)),
  }, road));
}

function palisadeSegmentRoadAccessTiles(
  grid: WallGrid,
  path: PalisadeConstructionSite["path"],
): readonly TileCoordinate[] {
  const candidates: TileCoordinate[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (from === undefined || to === undefined) continue;
    let current = from;
    while (current.x !== to.x || current.y !== to.y) {
      const next = {
        x: current.x + Math.sign(to.x - current.x),
        y: current.y + Math.sign(to.y - current.y),
      };
      candidates.push(...palisadeStepAdjacentTiles(current, next));
      current = next;
    }
  }
  return dedupeSortedNonWaterRoads(grid, candidates);
}

function palisadeStepAdjacentTiles(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): readonly TileCoordinate[] {
  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  if (from.y === to.y) {
    return [
      { tx: minX, ty: from.y - 1 },
      { tx: minX, ty: from.y },
    ];
  }
  if (from.x === to.x) {
    return [
      { tx: from.x - 1, ty: minY },
      { tx: from.x, ty: minY },
    ];
  }
  return [
    { tx: minX, ty: minY },
    { tx: minX + 1, ty: minY },
    { tx: minX, ty: minY + 1 },
    { tx: minX + 1, ty: minY + 1 },
  ];
}

function shortestRoadPathBetweenAccessTiles(
  grid: WallGrid,
  starts: readonly TileCoordinate[],
  destinations: readonly TileCoordinate[],
): readonly TileCoordinate[] | null {
  let bestPath: readonly TileCoordinate[] | null = null;

  for (const start of starts) {
    for (const destination of destinations) {
      const path = findExistingRoadPath(grid, { start, destination });
      if (path === null) continue;
      if (bestPath === null || path.length < bestPath.length) {
        bestPath = path;
      }
    }
  }

  return bestPath;
}

export function resolveBuildingRoute(
  state: GameState,
  source: Building,
  destination: Building,
): RouteResolution {
  const canonicalSource = source.id <= destination.id ? source : destination;
  const canonicalDestination = canonicalSource === source ? destination : source;
  const reverse = canonicalSource !== source;
  const key = buildingPairCacheKey(state, canonicalSource.id, canonicalDestination.id);
  const cached = state.pathCache[key];
  if (cached !== undefined) {
    return { path: reverse ? reversedPath(cached) : cached, pathCache: state.pathCache };
  }

  const starts = buildingRoadAccessTiles(state, canonicalSource);
  const destinations = buildingRoadAccessTiles(state, canonicalDestination);
  const path = shortestRoadPathBetweenAccessTiles(state, starts, destinations);
  if (path === null) {
    return {
      path: null,
      pathCache: state.pathCache,
    };
  }

  return {
    path: reverse ? reversedPath(path) : path,
    pathCache: {
      ...state.pathCache,
      [key]: path,
    },
  };
}

export function resolveBuildingToConstructionSiteRoute(
  state: GameState,
  source: Building,
  destination: ConstructionSite,
): RouteResolution {
  const destinationId = `construction_site:${destination.id}`;
  const forwardKey = cacheKey(state, source.id, destinationId);
  const forwardPath = state.pathCache[forwardKey];
  if (forwardPath !== undefined) {
    return { path: forwardPath, pathCache: state.pathCache };
  }

  const starts = buildingRoadAccessTiles(state, source);
  const destinations = constructionSiteRoadAccessTiles(state, destination);
  const direct = shortestRoadPathBetweenAccessTiles(state, starts, destinations);
  const carried = destination.kind === 'palisade_segment' || destination.kind === 'stone_wall_segment'
    ? wallCarryRoute(state, starts, destination) : null;
  const path = carried !== null && (direct === null || carried.cost < direct.length - 1)
    ? carried.path : direct;
  if (path === null) return { path: null, pathCache: state.pathCache };
  return { path, pathCache: { ...state.pathCache, [forwardKey]: path } };
}

export function resolveDirectBuildingToConstructionSiteRoute(
  state: GameState,
  source: Building,
  destination: ConstructionSite,
): readonly TileCoordinate[] | null {
  return shortestRoadPathBetweenAccessTiles(state,
    buildingRoadAccessTiles(state, source), constructionSiteRoadAccessTiles(state, destination));
}

export function resolveRoadToConstructionSiteRoute(
  state: GameState,
  currentRoadTile: TileCoordinate,
  destination: ConstructionSite,
): readonly TileCoordinate[] | null {
  const destinations = constructionSiteRoadAccessTiles(state, destination);
  return shortestRoadPathBetweenAccessTiles(state, [currentRoadTile], destinations);
}

export function resolveRoadToBuildingRoute(
  state: GameState,
  currentRoadTile: TileCoordinate,
  destination: Building,
): readonly TileCoordinate[] | null {
  const destinations = buildingRoadAccessTiles(state, destination);
  return shortestRoadPathBetweenAccessTiles(state, [currentRoadTile], destinations);
}
