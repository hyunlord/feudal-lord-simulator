import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { DistributorWalker } from "../agents/walker.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { findExistingRoadPath } from "../world/roadGraph";

export type DistributorBranchLabel =
  | "북쪽 가지"
  | "북동쪽 가지"
  | "동쪽 가지"
  | "남동쪽 가지"
  | "남쪽 가지"
  | "남서쪽 가지"
  | "서쪽 가지"
  | "북서쪽 가지"
  | "같은 자리";

export type DistributorRouteSummary = {
  readonly granaryId: string;
  readonly startedTick: number;
  readonly completedTick: number;
  readonly branchLabel: DistributorBranchLabel;
  readonly coordinates: readonly TileCoordinate[];
  readonly distance: number;
};

export type DistributorRouteMissReason = {
  readonly granaryId: string;
  readonly commonBranchLabel: DistributorBranchLabel | null;
  readonly houseRoadDistance: number | null;
  readonly serviceRadius: number;
  readonly label: string;
};

export type DistributorRouteHistory = {
  readonly routesByGranaryId: Readonly<Record<string, readonly DistributorRouteSummary[]>>;
  readonly activeByWalkerId: Readonly<Record<string, ActiveDistributorRoute>>;
};

type ActiveDistributorRoute = {
  readonly granaryId: string;
  readonly startedTick: number;
  readonly coordinates: readonly TileCoordinate[];
};

type DirectionVector = {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
};

const MAX_ROUTES_PER_GRANARY = 5;

export function createDistributorRouteHistory(): DistributorRouteHistory {
  return { routesByGranaryId: {}, activeByWalkerId: {} };
}

export function routeHistoryForGranary(
  history: DistributorRouteHistory,
  granaryId: string,
): readonly DistributorRouteSummary[] {
  return history.routesByGranaryId[granaryId] ?? [];
}

function distributorWalkers(state: GameState): readonly DistributorWalker[] {
  return state.walkers.filter((walker): walker is DistributorWalker => walker.kind === "distributor");
}

function sameCoordinate(left: TileCoordinate, right: TileCoordinate): boolean {
  return left.tx === right.tx && left.ty === right.ty;
}

function appendCoordinates(
  existing: readonly TileCoordinate[],
  next: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const coordinates: TileCoordinate[] = [...existing];
  for (const coordinate of next) {
    if (coordinates.some((candidate) => sameCoordinate(candidate, coordinate))) continue;
    coordinates.push(coordinate);
  }
  return coordinates;
}

function walkerRemainingRoute(walker: DistributorWalker): readonly TileCoordinate[] {
  return walker.path.slice(Math.min(walker.path.length, walker.pathIndex + 1));
}

function branchVector(granary: Building, coordinate: TileCoordinate): DirectionVector {
  const definition = BUILDING_CONFIG_BY_KIND[granary.kind];
  const minX = granary.tx;
  const maxX = granary.tx + definition.width - 1;
  const minY = granary.ty;
  const maxY = granary.ty + definition.height - 1;
  return {
    dx: (coordinate.tx < minX ? -1 : coordinate.tx > maxX ? 1 : 0),
    dy: (coordinate.ty < minY ? -1 : coordinate.ty > maxY ? 1 : 0),
  };
}

function branchLabel(vector: DirectionVector): DistributorBranchLabel {
  if (vector.dx === 0 && vector.dy === 0) return "같은 자리";
  if (vector.dx === 0 && vector.dy < 0) return "북쪽 가지";
  if (vector.dx > 0 && vector.dy < 0) return "북동쪽 가지";
  if (vector.dx > 0 && vector.dy === 0) return "동쪽 가지";
  if (vector.dx > 0 && vector.dy > 0) return "남동쪽 가지";
  if (vector.dx === 0 && vector.dy > 0) return "남쪽 가지";
  if (vector.dx < 0 && vector.dy > 0) return "남서쪽 가지";
  if (vector.dx < 0 && vector.dy === 0) return "서쪽 가지";
  return "북서쪽 가지";
}

function routeSummary(input: {
  readonly granary: Building;
  readonly active: ActiveDistributorRoute;
  readonly completedTick: number;
}): DistributorRouteSummary | null {
  if (input.active.coordinates.length === 0) return null;
  const firstCoordinate = input.active.coordinates[0];
  if (firstCoordinate === undefined) return null;
  return {
    granaryId: input.granary.id,
    startedTick: input.active.startedTick,
    completedTick: input.completedTick,
    branchLabel: branchLabel(branchVector(input.granary, firstCoordinate)),
    coordinates: input.active.coordinates,
    distance: input.active.coordinates.length,
  };
}

function appendCompletedRoute(
  history: DistributorRouteHistory,
  summary: DistributorRouteSummary,
): DistributorRouteHistory {
  const existing = routeHistoryForGranary(history, summary.granaryId);
  return {
    ...history,
    routesByGranaryId: {
      ...history.routesByGranaryId,
      [summary.granaryId]: [...existing, summary].slice(-MAX_ROUTES_PER_GRANARY),
    },
  };
}

function pruneHistory(
  history: DistributorRouteHistory,
  granaryIds: ReadonlySet<string>,
): DistributorRouteHistory {
  const routesByGranaryId: Record<string, readonly DistributorRouteSummary[]> = {};
  for (const [granaryId, routes] of Object.entries(history.routesByGranaryId)) {
    if (granaryIds.has(granaryId)) routesByGranaryId[granaryId] = routes;
  }
  const activeByWalkerId: Record<string, ActiveDistributorRoute> = {};
  for (const [walkerId, active] of Object.entries(history.activeByWalkerId)) {
    if (granaryIds.has(active.granaryId)) activeByWalkerId[walkerId] = active;
  }
  return { routesByGranaryId, activeByWalkerId };
}

function shouldReset(input: {
  readonly previousState: GameState;
  readonly nextState: GameState;
}): boolean {
  return (
    input.nextState.tick < input.previousState.tick ||
    input.nextState.seed !== input.previousState.seed ||
    input.nextState.width !== input.previousState.width ||
    input.nextState.height !== input.previousState.height
  );
}

export function observeDistributorRouteHistory(input: {
  readonly previousState: GameState;
  readonly nextState: GameState;
  readonly history: DistributorRouteHistory;
}): DistributorRouteHistory {
  const granaries = input.nextState.buildings.filter((building) => building.kind === "granary");
  const granaryIds = new Set(granaries.map((granary) => granary.id));
  let history = shouldReset(input)
    ? createDistributorRouteHistory()
    : pruneHistory(input.history, granaryIds);
  const previousDistributors = new Map(distributorWalkers(input.previousState).map((walker) => [walker.id, walker]));
  const activeByWalkerId: Record<string, ActiveDistributorRoute> = { ...history.activeByWalkerId };

  for (const nextWalker of distributorWalkers(input.nextState)) {
    if (!granaryIds.has(nextWalker.homeBuildingId)) continue;
    const previousWalker = previousDistributors.get(nextWalker.id);
    const existing = activeByWalkerId[nextWalker.id] ?? {
      granaryId: nextWalker.homeBuildingId,
      startedTick: nextWalker.spawnedTick,
      coordinates: [],
    };
    const previousRoute = previousWalker?.phase === "roaming"
      ? walkerRemainingRoute(previousWalker)
      : [];
    const nextRoute = nextWalker.phase === "roaming" ? walkerRemainingRoute(nextWalker) : [];
    const active = {
      ...existing,
      coordinates: appendCoordinates(existing.coordinates, [...previousRoute, ...nextRoute]),
    };
    if (previousWalker?.phase === "roaming" && nextWalker.phase === "returning") {
      const granary = granaries.find((candidate) => candidate.id === nextWalker.homeBuildingId);
      const summary = granary === undefined
        ? null
        : routeSummary({
            granary,
            active,
            completedTick: input.nextState.tick,
          });
      delete activeByWalkerId[nextWalker.id];
      if (summary !== null) history = appendCompletedRoute(history, summary);
      continue;
    }
    if (nextWalker.phase === "roaming") {
      activeByWalkerId[nextWalker.id] = active;
    } else {
      delete activeByWalkerId[nextWalker.id];
    }
  }

  return { ...history, activeByWalkerId };
}

function commonBranch(
  routes: readonly DistributorRouteSummary[],
): DistributorBranchLabel | null {
  const first = routes[0]?.branchLabel;
  if (first === undefined) return null;
  return routes.every((route) => route.branchLabel === first) ? first : null;
}

function shortestRoadDistance(input: {
  readonly state: GameState;
  readonly granary: Building;
  readonly home: Building;
}): number | null {
  let shortest: number | null = null;
  const granaryRoads = buildingRoadAccessTiles(input.state, input.granary);
  const houseRoads = buildingRoadAccessTiles(input.state, input.home);
  for (const start of granaryRoads) {
    for (const destination of houseRoads) {
      const path = findExistingRoadPath(input.state, { start, destination });
      if (path === null) continue;
      const distance = Math.max(0, path.length - 1);
      shortest = shortest === null ? distance : Math.min(shortest, distance);
    }
  }
  return shortest;
}

export function missedHouseRouteReason(input: {
  readonly state: GameState;
  readonly home: Building;
  readonly history: DistributorRouteHistory | null;
  readonly granaryIds?: ReadonlySet<string>;
}): DistributorRouteMissReason | null {
  if (input.history === null) return null;
  const history = input.history;
  const granaries = input.state.buildings.filter(
    (building) =>
      building.kind === "granary" &&
      (input.granaryIds === undefined || input.granaryIds.has(building.id)),
  );
  const candidates = granaries.flatMap((granary) => {
    const routes = routeHistoryForGranary(history, granary.id);
    const houseRoadDistance = shortestRoadDistance({ state: input.state, granary, home: input.home });
    return routes.length === 0 || houseRoadDistance === null
      ? []
      : [{
          granary,
          routes,
          houseRoadDistance,
        }];
  }).sort((left, right) =>
    left.houseRoadDistance - right.houseRoadDistance ||
    left.granary.id.localeCompare(right.granary.id),
  );
  const nearest = candidates[0];
  if (nearest === undefined) return null;
  const sharedBranch = commonBranch(nearest.routes);
  const branchText = sharedBranch === null
    ? `최근 배급 ${nearest.routes.length}회가 갈림길에서 나뉨`
    : `최근 배급 ${nearest.routes.length}회 모두 ${sharedBranch} 선택`;
  return {
    granaryId: nearest.granary.id,
    commonBranchLabel: sharedBranch,
    houseRoadDistance: nearest.houseRoadDistance,
    serviceRadius: BALANCE.DISTRIBUTOR_RANGE,
    label: `${branchText} — 이 집 도로거리 ${nearest.houseRoadDistance} / 순회범위 ${BALANCE.DISTRIBUTOR_RANGE}`,
  };
}
