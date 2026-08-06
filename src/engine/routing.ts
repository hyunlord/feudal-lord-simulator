import type { Building } from "../content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { ConstructionSite } from "../economy/construction";
import type { Grid, TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import { findExistingRoadPath } from "../world/roadGraph";
import type { GameState, RoadPathCache } from "./engine.types";

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
  roadRevision: number,
  sourceId: string,
  destinationId: string,
): string {
  return `road:${roadRevision}:${sourceId}->${destinationId}`;
}

function reversedPath(
  path: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  return [...path].reverse();
}

function dedupeSortedRoads(
  grid: Grid,
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

export function buildingRoadAccessTiles(
  grid: Grid,
  building: Building,
): readonly TileCoordinate[] {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const candidates: TileCoordinate[] = [];

  for (let dx = 0; dx < definition.width; dx += 1) {
    candidates.push({ tx: building.tx + dx, ty: building.ty - 1 });
    candidates.push({ tx: building.tx + dx, ty: building.ty + definition.height });
  }

  for (let dy = 0; dy < definition.height; dy += 1) {
    candidates.push({ tx: building.tx - 1, ty: building.ty + dy });
    candidates.push({ tx: building.tx + definition.width, ty: building.ty + dy });
  }

  return dedupeSortedRoads(grid, candidates);
}

export function constructionSiteRoadAccessTiles(
  grid: Grid,
  site: ConstructionSite,
): readonly TileCoordinate[] {
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

  return dedupeSortedRoads(grid, candidates);
}

function shortestRoadPathBetweenAccessTiles(
  grid: Grid,
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
  const forwardKey = cacheKey(state.roadRevision, source.id, destination.id);
  const forwardPath = state.pathCache[forwardKey];
  if (forwardPath !== undefined) {
    return {
      path: forwardPath,
      pathCache: state.pathCache,
    };
  }

  const reverseKey = cacheKey(state.roadRevision, destination.id, source.id);
  const reversePath = state.pathCache[reverseKey];
  if (reversePath !== undefined) {
    const path = reversedPath(reversePath);
    return {
      path,
      pathCache: {
        ...state.pathCache,
        [forwardKey]: path,
      },
    };
  }

  const starts = buildingRoadAccessTiles(state, source);
  const destinations = buildingRoadAccessTiles(state, destination);
  const path = shortestRoadPathBetweenAccessTiles(state, starts, destinations);
  if (path === null) {
    return {
      path: null,
      pathCache: state.pathCache,
    };
  }

  return {
    path,
    pathCache: {
      ...state.pathCache,
      [forwardKey]: path,
    },
  };
}

export function resolveBuildingToConstructionSiteRoute(
  state: GameState,
  source: Building,
  destination: ConstructionSite,
): RouteResolution {
  const destinationId = `construction_site:${destination.id}`;
  const forwardKey = cacheKey(state.roadRevision, source.id, destinationId);
  const forwardPath = state.pathCache[forwardKey];
  if (forwardPath !== undefined) {
    return { path: forwardPath, pathCache: state.pathCache };
  }

  const starts = buildingRoadAccessTiles(state, source);
  const destinations = constructionSiteRoadAccessTiles(state, destination);
  const path = shortestRoadPathBetweenAccessTiles(state, starts, destinations);
  if (path === null) return { path: null, pathCache: state.pathCache };
  return { path, pathCache: { ...state.pathCache, [forwardKey]: path } };
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
