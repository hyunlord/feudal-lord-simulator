import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "./economy.types";
import { availableStock } from "./storage";

export interface ResourceDemand {
  readonly requesterBuildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
}

export type SourceDistance = (
  source: Building,
  requester: Building,
) => number | null;

const manhattanDistance: SourceDistance = (source, requester) =>
  Math.abs(source.tx - requester.tx) + Math.abs(source.ty - requester.ty);

export function findNearestSource(
  buildings: readonly Building[],
  demand: ResourceDemand,
  distance: SourceDistance = manhattanDistance,
): Building | null {
  if (demand.amount <= 0) return null;
  const requester =
    buildings.find((building) => building.id === demand.requesterBuildingId) ??
    null;
  if (requester === null) return null;

  return (
    buildings
      .filter(
        (building) =>
          building.id !== requester.id &&
          availableStock(building, demand.resource) > 0,
      )
      .map((building) => ({
        building,
        distance: distance(building, requester),
      }))
      .filter(
        (
          candidate,
        ): candidate is { readonly building: Building; readonly distance: number } =>
          candidate.distance !== null &&
          Number.isFinite(candidate.distance) &&
          candidate.distance >= 0,
      )
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          left.building.id.localeCompare(right.building.id),
      )[0]?.building ?? null
  );
}
