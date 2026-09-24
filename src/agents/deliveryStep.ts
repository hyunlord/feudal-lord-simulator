import { observeMaterialReturn } from './materialActivity';
import { BALANCE } from "../content/balanceConfig";
import { WALL_CARRY_COST_FACTOR } from '../engine/wallCarryRoute';
import type { Building } from "../content/buildingConfig";
import {
  hasArrivedAtPathEnd,
  remainingPathCanBeTraversed,
  stepWalkerAlongPath,
} from "./movement";
import { returnPath } from "./deliveryCommon";
import { completeOutbound } from "./deliveryOutbound";
import {
  cancelCarter,
  canCompleteReturn,
  completeReturn,
} from "./deliveryReturn";
import type {
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
} from "./deliveryTypes";
import type { CarterWalker, Walker } from "./walker.types";

function routeIsIntact(
  buildings: readonly Building[],
  carter: CarterWalker,
  routes: DeliveryRoutePort,
): boolean {
  if (!remainingPathCanBeTraversed(carter, routes.canTraverse)) return false;
  const endpoint = carter.path.at(-1);
  const destination = carter.phase === "outbound" ? carter.destination
    : { kind: "building" as const, buildingId: carter.homeBuildingId };
  if (endpoint !== undefined && routes.canAccessDestination?.(endpoint, destination) === false) return false;
  const remainingPathIsRoad = carter.path
    .slice(Math.max(0, carter.pathIndex))
    .every((tile) => routes.isRoad(tile)
      || routes.canCarryForDestination?.(tile, carter.destination) === true);
  if (!remainingPathIsRoad || carter.phase !== "outbound") {
    return remainingPathIsRoad;
  }

  return returnPath(buildings, carter, routes) !== null;
}

export function stepCarters(input: DeliveryStepInput): DeliveryStepResult {
  let buildings = input.buildings;
  let constructionSites = input.constructionSites ?? [];
  let treasuryTimber = input.treasuryTimber ?? 0;
  const walkers: Walker[] = [];

  for (const walker of [...input.walkers].sort((a, b) => a.id.localeCompare(b.id))) {
    if (walker.kind !== "carter") {
      walkers.push(walker);
      continue;
    }
    if (walker.cancellation !== null) input.materialActivity?.({ kind: 'cancelled', tick: input.tick, homeId: walker.homeBuildingId, walkerId: walker.id });
    if (
      walker.phase === "returning" &&
      walker.cancellation !== null &&
      hasArrivedAtPathEnd(walker)
    ) {
      if (!canCompleteReturn(buildings, walker, input.inventory)) {
        walkers.push(walker);
        continue;
      }
      const returned = completeReturn(
        { buildings, constructionSites, treasuryTimber },
        walker,
        input.inventory,
      );
      observeMaterialReturn(input, walker);
      buildings = returned.buildings;
      constructionSites = returned.constructionSites;
      treasuryTimber = returned.treasuryTimber;
      continue;
    }
    if (!routeIsIntact(buildings, walker, input.routes)) {
      input.materialActivity?.({ kind: "cancelled", tick: input.tick, homeId: walker.homeBuildingId, walkerId: walker.id });
      const cancelled = cancelCarter(
        input.tick,
        { buildings, constructionSites, treasuryTimber },
        walker,
        input.inventory,
        input.routes,
        "road_removed",
      );
      buildings = cancelled.buildings;
      constructionSites = cancelled.constructionSites;
      treasuryTimber = cancelled.treasuryTimber;
      if (cancelled.walker !== null) walkers.push(cancelled.walker);
      continue;
    }

    const from = walker.path[walker.pathIndex];
    const to = walker.path[walker.pathIndex + 1];
    const carry = walker.destination.kind === 'construction_site' && from !== undefined && to !== undefined
      && (!input.routes.isRoad(from) || !input.routes.isRoad(to))
      && input.routes.canCarryForDestination?.(to, walker.destination) === true;
    const length = from === undefined || to === undefined ? 1
      : Math.abs(from.tx - to.tx) + Math.abs(from.ty - to.ty);
    const speed = carry && length > 0 ? BALANCE.CARTER_SPEED / WALL_CARRY_COST_FACTOR : BALANCE.CARTER_SPEED;
    const moved = stepWalkerAlongPath(walker, speed);
    if (!hasArrivedAtPathEnd(moved)) {
      walkers.push(moved);
      continue;
    }
    if (moved.phase === "returning") {
      if (!canCompleteReturn(buildings, moved, input.inventory)) {
        walkers.push(moved);
        continue;
      }
      const returned = completeReturn(
        { buildings, constructionSites, treasuryTimber },
        moved,
        input.inventory,
      );
      observeMaterialReturn(input, moved);
      buildings = returned.buildings;
      constructionSites = returned.constructionSites;
      treasuryTimber = returned.treasuryTimber;
      continue;
    }

    const completed = completeOutbound(
      { buildings, constructionSites, treasuryTimber },
      moved,
      input,
    );
    buildings = completed.buildings;
    constructionSites = completed.constructionSites;
    treasuryTimber = completed.treasuryTimber;
    if (completed.walker !== null) walkers.push(completed.walker);
  }

  return { buildings, constructionSites, walkers, treasuryTimber };
}
