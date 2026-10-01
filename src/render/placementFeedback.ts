import { ZonePlacementFailure } from "../zones/zonePlacement";
import type { ZoneKind } from "../zones/zone.types";
import { ZONE_BRUSH_COPY } from "./zoneBrushCopy.ko";
import { PLACEMENT_FEEDBACK_COPY } from "./placementFeedbackCopy.ko";
import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { TileCoordinate } from "../world/grid";
import { PlacementFailure } from "../world/placement";
import { resourceName } from "../content/resourceCatalog.ko";
import { adjacentTerrainNeed } from "./adjacentTerrainNeed";

const PLACEMENT_FEEDBACK_DURATION_MS = {
  success: 600,
  failure: 4500,
} as const;

export type PlacementTool =
  | {
      readonly kind: "building";
      readonly buildingKind: BuildingKind;
    }
  | {
      readonly kind: "road";
    };

export type PlacementFeedbackAnchor =
  | {
      readonly kind: "tile";
      readonly tile: TileCoordinate;
    }
  | {
      readonly kind: "path";
      readonly path: readonly TileCoordinate[];
    };

export type PlacementFeedbackKind = keyof typeof PLACEMENT_FEEDBACK_DURATION_MS;

export interface CreatePlacementFeedbackRequest {
  readonly kind: PlacementFeedbackKind;
  readonly message: string;
  readonly anchor: PlacementFeedbackAnchor;
  readonly nowMs: number;
}

export interface PlacementFeedback {
  readonly kind: PlacementFeedbackKind;
  readonly message: string;
  readonly anchor: PlacementFeedbackAnchor;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export type PlacementFailureReason = PlacementFailure | ZonePlacementFailure;

export type FormatPlacementFailureRequest = {
  readonly reason: PlacementFailureReason;
  readonly buildingKind: BuildingKind;
  readonly shortfalls?: Partial<Record<ResourceType, number>>;
  /** The zone kind the zone rule asked for (zone failures only). */
  readonly zoneRule?: ZoneKind;
};

function assertNever(value: never): string {
  return value;
}

export function formatPlacementFailure(
  request: FormatPlacementFailureRequest,
): string {
  const reason = request.reason;
  switch (reason) {
    case PlacementFailure.occupied:
      return PLACEMENT_FEEDBACK_COPY.occupied;
    case PlacementFailure.wall_clearance:
      return PLACEMENT_FEEDBACK_COPY.wallClearance;
    case PlacementFailure.wrong_terrain:
      return PLACEMENT_FEEDBACK_COPY.wrongTerrain;
    case PlacementFailure.out_of_bounds:
      return PLACEMENT_FEEDBACK_COPY.outOfBounds;
    case PlacementFailure.needs_road:
      return PLACEMENT_FEEDBACK_COPY.needsRoad;
    case PlacementFailure.needs_adjacent_terrain: // MA-10: by what the building needs beside it
      return PLACEMENT_FEEDBACK_COPY.needsAdjacent[adjacentTerrainNeed(request.buildingKind)];
    case PlacementFailure.insufficient_materials: {
      const shortfallLabel = resourceAmountsLabel(request.shortfalls ?? {});
      if (shortfallLabel !== PLACEMENT_FEEDBACK_COPY.none) return PLACEMENT_FEEDBACK_COPY.resourcesShort(shortfallLabel);
      const timberCost = BUILDING_CONFIG_BY_KIND[request.buildingKind].buildCost.timber ?? 0;
      return PLACEMENT_FEEDBACK_COPY.timberShort(timberCost);
    }
    case PlacementFailure.locked_era:
      return PLACEMENT_FEEDBACK_COPY.lockedEra;
    case ZonePlacementFailure.outside_zone:
      return request.zoneRule === "burgage" ? ZONE_BRUSH_COPY.outsideBurgage
        : request.zoneRule === "arable" ? ZONE_BRUSH_COPY.outsideArable : ZONE_BRUSH_COPY.outsideZone;
    case ZonePlacementFailure.arable_inside_wall:
      return ZONE_BRUSH_COPY.arableInsideWall;
    default:
      return assertNever(reason);
  }
}

function resourceAmountsLabel(amounts: Partial<Record<ResourceType, number>>): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => (amounts[resource] ?? 0) > 0)
    .map((resource) => PLACEMENT_FEEDBACK_COPY.resourceAmount(resourceName(resource), amounts[resource] ?? 0));
  return parts.length === 0 ? PLACEMENT_FEEDBACK_COPY.none : parts.join(" · ");
}

export function getPlacementToolStatus(tool: PlacementTool | null): string {
  if (tool === null) return PLACEMENT_FEEDBACK_COPY.chooseTool;

  switch (tool.kind) {
    case "building":
      return PLACEMENT_FEEDBACK_COPY.placeBuilding(BUILDING_CONFIG_BY_KIND[tool.buildingKind].name);
    case "road":
      return PLACEMENT_FEEDBACK_COPY.placeRoad;
    default:
      return assertNever(tool);
  }
}

export function createPlacementFeedback(
  request: CreatePlacementFeedbackRequest,
): PlacementFeedback {
  return {
    kind: request.kind,
    message: request.message,
    anchor: request.anchor,
    createdAtMs: request.nowMs,
    expiresAtMs: request.nowMs + PLACEMENT_FEEDBACK_DURATION_MS[request.kind],
  };
}

export function isPlacementFeedbackVisible(
  feedback: PlacementFeedback | null,
  nowMs: number,
): boolean {
  return feedback !== null && nowMs < feedback.expiresAtMs;
}
