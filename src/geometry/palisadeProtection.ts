import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { PalisadePath, TileEdgePoint } from "../world/palisadeGeometry";

export type PalisadeProtection = "inactive" | "inside" | "outside";

export type PalisadeProtectionSource = {
  readonly polygon: PalisadePath;
  readonly segments: readonly {
    readonly completed: boolean;
  }[];
} | null;

function isCompletedPalisade(source: PalisadeProtectionSource): source is Exclude<PalisadeProtectionSource, null> {
  return source !== null && source.segments.length > 0 && source.segments.every((segment) => segment.completed);
}

function isPointOnSegment(point: TileEdgePoint, from: TileEdgePoint, to: TileEdgePoint): boolean {
  const cross = (point.y - from.y) * (to.x - from.x) - (point.x - from.x) * (to.y - from.y);
  if (cross !== 0) return false;
  return (
    point.x >= Math.min(from.x, to.x) &&
    point.x <= Math.max(from.x, to.x) &&
    point.y >= Math.min(from.y, to.y) &&
    point.y <= Math.max(from.y, to.y)
  );
}

function isPointInsideClosedPolygon(point: TileEdgePoint, polygon: PalisadePath): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length - 1; index += 1) {
    const from = polygon[index];
    const to = polygon[index + 1];
    if (from === undefined || to === undefined) continue;
    if (isPointOnSegment(point, from, to)) return true;
    const crossesRay = from.y > point.y !== to.y > point.y;
    if (crossesRay) {
      const xAtPointY = ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x;
      if (point.x < xAtPointY) inside = !inside;
    }
  }
  return inside;
}

function buildingCorners(building: Building): readonly TileEdgePoint[] {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return [
    { x: building.tx, y: building.ty },
    { x: building.tx + definition.width, y: building.ty },
    { x: building.tx + definition.width, y: building.ty + definition.height },
    { x: building.tx, y: building.ty + definition.height },
  ];
}

export function palisadeProtectionForBuilding(
  building: Building,
  source: PalisadeProtectionSource,
): PalisadeProtection {
  if (!isCompletedPalisade(source)) return "inactive";
  return buildingCorners(building).every((point) => isPointInsideClosedPolygon(point, source.polygon))
    ? "inside"
    : "outside";
}
