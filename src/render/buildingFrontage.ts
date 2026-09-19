import { buildingFootprint } from "../geometry/buildingFootprint";
import { type Building, type BuildingKind } from "../content/buildingConfig";
import { SEMANTIC_PALETTE } from "../content/palette";
import { buildingRoadAccessTiles } from "../engine/routing";
import { getTile, type Grid, type TileCoordinate } from "../world/grid";
import { tileToScreen } from "./iso";
import { snapToPixel, withAlpha } from "./style";
import { getTerrainPattern, terrainPatternQuarterTurn, type PatternQuarterTurn, type TerrainPatternAssets } from "./terrainPatterns";

type Polygon = readonly TileCoordinate[];
export type BuildingFrontage = {
  readonly pad: Polygon;
  readonly paths: readonly {
    readonly road: TileCoordinate;
    readonly polygon: Polygon;
    readonly edge: Polygon;
    readonly interior: Polygon;
    readonly interiorEdge: Polygon;
    readonly textureTurn: PatternQuarterTurn;
  }[];
};

export function supportsBuildingFrontage(kind: BuildingKind): boolean {
  return kind !== "house" && kind !== "wheat_farm";
}

export function buildingFrontage(grid: Grid, building: Building, seed: number): BuildingFrontage | null {
  if (!supportsBuildingFrontage(building.kind) && !(building.kind === "house" && building.houseLot !== undefined)) return null;
  const size = buildingFootprint(building);
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) {
      const tile = getTile(grid, { tx: building.tx + dx, ty: building.ty + dy });
      if (tile === null || tile.buildingId !== building.id || tile.terrain === "water" || tile.terrain === "rock") return null;
    }
  }
  const center = { tx: building.tx + (size.width - 1) / 2, ty: building.ty + (size.height - 1) / 2 };
  const phase = building.tx * 13 + building.ty * 7 + seed * 3;
  const pad = ([
    [-0.32, -0.22], [-0.14, -0.34], [0.23, -0.30], [0.35, -0.08],
    [0.31, 0.24], [0.08, 0.34], [-0.27, 0.29], [-0.35, 0.06],
  ] as const).map(([x, y], index) => ({
    tx: center.tx + (x + Math.sin(phase + index * 1.7) * 0.015) * size.width,
    ty: center.ty + (y + Math.cos(phase + index * 1.3) * 0.015) * size.height,
  }));
  const roads = buildingRoadAccessTiles(grid, building).filter(road => {
    const tile = getTile(grid, road);
    return tile !== null && tile.buildingId === null && tile.terrain !== "water" && tile.terrain !== "rock";
  });
  const paths = roads.map(road => {
    const origin = {
      tx: Math.max(building.tx, Math.min(road.tx, building.tx + size.width - 1)),
      ty: Math.max(building.ty, Math.min(road.ty, building.ty + size.height - 1)),
    };
    const dx = road.tx - origin.tx;
    const dy = road.ty - origin.ty;
    const side = (sign: number, feather = 0): Polygon => Array.from({ length: 7 }, (_, index) => {
      const distance = 0.10 + index / 6 * 0.90;
      const width = 0.075 + distance * 0.04 + Math.sin(phase + index * 1.8) * 0.012;
      const across = sign * (width + feather) + Math.sin(distance * Math.PI) * Math.sin(phase) * 0.035;
      return { tx: origin.tx + dx * distance - dy * across, ty: origin.ty + dy * distance + dx * across };
    });
    const legacyAnchor = building.kind === "storehouse" || building.kind === "granary";
    const anchor = legacyAnchor ? { tx: building.tx + size.width - 1, ty: building.ty + size.height - 1 } : center;
    const end = { tx: origin.tx + dx * 0.24, ty: origin.ty + dy * 0.24 };
    const length = Math.hypot(end.tx - anchor.tx, end.ty - anchor.ty);
    const forward = { tx: (end.tx - anchor.tx) / length, ty: (end.ty - anchor.ty) / length };
    const interior = (width: number): Polygon => [
      { along: -0.06, side: width }, { along: length, side: width },
      { along: length, side: -width }, { along: -0.06, side: -width },
    ].map(point => ({ tx: anchor.tx + forward.tx * point.along - forward.ty * point.side,
      ty: anchor.ty + forward.ty * point.along + forward.tx * point.side }));
    return { road, interior: interior(0.095), interiorEdge: interior(0.135), polygon: [...side(1), ...[...side(-1)].reverse()],
      edge: [...side(1, 0.04), ...[...side(-1, 0.04)].reverse()],
      textureTurn: terrainPatternQuarterTurn("packed_earth_road", road.tx, road.ty, seed) };
  });
  return { pad, paths };
}

export function buildingContactPolygon(building: Building): Polygon {
  const size = buildingFootprint(building);
  const divisor = building.kind === "storehouse" || building.kind === "granary" ? 1 : 2;
  const center = { tx: building.tx + (size.width - 1) / divisor, ty: building.ty + (size.height - 1) / divisor };
  return ([[-0.18, -0.09], [0.05, -0.17], [0.24, -0.04], [0.19, 0.16], [-0.03, 0.22], [-0.20, 0.07]] as const)
    .map(([x, y]) => ({ tx: center.tx + x * size.width, ty: center.ty + y * size.height }));
}

export function drawBuildingFrontage(
  context: CanvasRenderingContext2D,
  frontage: BuildingFrontage,
  terrainPatterns?: TerrainPatternAssets,
): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, 0.16);
  fillPolygons(context, [frontage.pad]);
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, 0.24);
  fillPolygons(context, frontage.paths.flatMap(path => [path.edge, path.interiorEdge]));
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, 0.74);
  fillPolygons(context, frontage.paths.flatMap(path => [path.polygon, path.interior]));
  for (const turn of [0, 1, 2, 3] as const) {
    const polygons = frontage.paths.filter(path => path.textureTurn === turn).flatMap(path => [path.polygon, path.interior]);
    if (polygons.length === 0) continue;
    const pattern = getTerrainPattern(context, "packed_earth_road", terrainPatterns, turn);
    if (pattern === null) continue;
    context.save();
    try {
      context.fillStyle = pattern;
      context.globalAlpha *= 0.18;
      fillPolygons(context, polygons);
    } finally {
      context.restore();
    }
  }
}

export function drawBuildingContactShadow(context: CanvasRenderingContext2D, building: Building): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, 0.24);
  fillPolygons(context, [buildingContactPolygon(building)]);
}

function fillPolygons(context: CanvasRenderingContext2D, polygons: readonly Polygon[]): void {
  context.beginPath();
  for (const polygon of polygons) {
    for (const [index, point] of polygon.entries()) {
      const screen = tileToScreen(point.tx, point.ty);
      if (index === 0) context.moveTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
      else context.lineTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
    }
    context.closePath();
  }
  context.fill();
}
