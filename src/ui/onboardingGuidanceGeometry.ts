import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";

export type GuidanceGeometryWorld = Pick<GameState, "height" | "width">;

export function sortedCandidateOrigins(
  state: GuidanceGeometryWorld,
  center: TileCoordinate,
): readonly TileCoordinate[] {
  const candidates: TileCoordinate[] = [];

  for (let ty = 0; ty < state.height; ty += 1) {
    for (let tx = 0; tx < state.width; tx += 1) {
      candidates.push({ tx, ty });
    }
  }

  return candidates.sort((left, right) => {
    const distance = manhattanDistance(left, center) - manhattanDistance(right, center);
    if (distance !== 0) return distance;
    if (left.ty !== right.ty) return left.ty - right.ty;
    return left.tx - right.tx;
  });
}

export function reserveFootprint(
  reserved: Set<string>,
  kind: BuildingKind,
  origin: TileCoordinate,
): void {
  for (const coordinate of footprint(kind, origin)) {
    reserved.add(tileKey(coordinate));
  }
}

export function reservedOverlaps(
  kind: BuildingKind,
  origin: TileCoordinate,
  reserved: ReadonlySet<string>,
): boolean {
  return footprint(kind, origin).some((coordinate) => reserved.has(tileKey(coordinate)));
}

export function tileKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

export function manhattanDistance(
  left: Pick<TileCoordinate, "tx" | "ty">,
  right: Pick<TileCoordinate, "tx" | "ty">,
): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function footprint(kind: BuildingKind, origin: TileCoordinate): readonly TileCoordinate[] {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const coordinates: TileCoordinate[] = [];
  for (let dy = 0; dy < definition.height; dy += 1) {
    for (let dx = 0; dx < definition.width; dx += 1) {
      coordinates.push({ tx: origin.tx + dx, ty: origin.ty + dy });
    }
  }
  return coordinates;
}
