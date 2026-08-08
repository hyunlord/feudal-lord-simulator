import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import { findExistingRoadPath } from "../world/roadGraph";
import type {
  DistributorBranchLabel,
  DistributorRouteHistory,
  DistributorRouteSummary,
} from "./distributorRouteHistory";

export type DistributorRouteMissReason = {
  readonly granaryId: string;
  readonly commonBranchLabel: DistributorBranchLabel | null;
  readonly houseRoadDistance: number | null;
  readonly serviceRadius: number;
  readonly label: string;
};

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
    const routes = history.routesByGranaryId[granary.id] ?? [];
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
