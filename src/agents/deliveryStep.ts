import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import {
  hasArrivedAtPathEnd,
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
  const remainingPathIsRoad = carter.path
    .slice(Math.max(0, carter.pathIndex))
    .every((tile) => routes.isRoad(tile));
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
      buildings = returned.buildings;
      constructionSites = returned.constructionSites;
      treasuryTimber = returned.treasuryTimber;
      continue;
    }
    if (!routeIsIntact(buildings, walker, input.routes)) {
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

    const moved = stepWalkerAlongPath(walker, BALANCE.CARTER_SPEED);
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
