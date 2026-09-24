import { canTraverseRoadBoundary } from "../world/bridges";
import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile } from "../world/grid";
import type { Tile } from "../world/world.types";
import { tileToScreen } from "./iso";
import {
  groundDecalFor,
  roadConnectionArms,
  roadPebbleVariants,
  type CardinalDirection,
} from "./terrainDetails";
import { getTerrainPattern, terrainPatternQuarterTurn, type TerrainPatternAssets } from "./terrainPatterns";
import { snapToPixel, withAlpha } from "./style";
import { roadGroundPolygons, type RoadGroundPoint } from "./organicRoadGeometry";

type Point = { readonly x: number; readonly y: number };

const DIRECTION_OFFSET = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
} as const satisfies Record<CardinalDirection, { readonly dx: number; readonly dy: number }>;

export function drawGroundDecalDetail(
  context: CanvasRenderingContext2D,
  tile: Tile,
  seed: number,
): void {
  if (tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null) return;
  const decal = groundDecalFor(tile.tx, tile.ty, seed);
  if (decal.kind === "none") return;
  const center = tileCenter(tile);
  const offsetX = ((decal.variant >>> 3) % 17) - 8;
  const offsetY = ((decal.variant >>> 9) % 7) - 3;
  if (decal.kind === "rock") {
    context.fillStyle = SEMANTIC_PALETTE.stoneDark;
    traceSmallDiamond(context, { x: center.x + offsetX, y: center.y + offsetY }, 3, 2);
    context.fill();
    return;
  }
  context.fillStyle = SEMANTIC_PALETTE.sageDark;
  context.beginPath();
  for (let index = 0; index < decal.count; index += 1) {
    const x = center.x + offsetX + index * 3 - decal.count * 1.5;
    const y = center.y + offsetY + (index & 1);
    context.moveTo(snapToPixel(x - 1), snapToPixel(y + 2));
    context.lineTo(snapToPixel(x), snapToPixel(y - 3 - (index & 1)));
    context.lineTo(snapToPixel(x + 1), snapToPixel(y + 2));
    context.closePath();
  }
  context.fill();
}

export function drawRoadPath(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  terrainPatterns?: TerrainPatternAssets,
): void {
  const center = tileCenter(tile);
  const neighbours = Object.values(DIRECTION_OFFSET)
    .map(({ dx, dy }) => getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy }))
    .filter((candidate): candidate is Tile => candidate !== null && canTraverseRoadBoundary(state, tile, candidate));
  const arms = roadConnectionArms(tile, neighbours);
  const polygons = roadGroundPolygons({ tx: tile.tx, ty: tile.ty, seed: state.seed, arms });
  const pattern = getTerrainPattern(
    context,
    "packed_earth_road",
    terrainPatterns,
    terrainPatternQuarterTurn("packed_earth_road", tile.tx, tile.ty, state.seed),
  );
  context.fillStyle = SEMANTIC_PALETTE.earth;
  traceRoadBase(context, polygons);
  context.fill();
  if (pattern !== null) fillRoadPattern(context, polygons, pattern);

  context.fillStyle = withAlpha(SEMANTIC_PALETTE.stoneDark, 0.35);
  for (const [index, variant] of roadPebbleVariants(tile.tx, tile.ty, state.seed).entries()) {
    const x = center.x + ((variant >>> 4) % 19) - 9;
    const y = center.y + ((variant >>> 10) % 9) - 4 + index;
    traceSmallDiamond(context, { x, y }, 2, 1);
    context.fill();
  }
}

// The texture fills the road polygon itself. It used to clip to the polygon and fillRect the tile box: the same
// pixels (every road polygon lies inside that box), but on GPU canvases a pattern fillRect per road tile stalled
// the compositor (~150 ms frames on hamlet views, B11 P-F1; docs/verification/b11-render-metrics/REPORT.md).
function fillRoadPattern(
  context: CanvasRenderingContext2D,
  polygons: readonly (readonly RoadGroundPoint[])[],
  pattern: CanvasPattern,
): void {
  traceRoadBase(context, polygons);
  context.save();
  try {
    context.fillStyle = pattern;
    context.globalAlpha *= 0.18;
    context.fill();
  } finally {
    context.restore();
  }
}

function traceRoadBase(
  context: CanvasRenderingContext2D,
  polygons: readonly (readonly RoadGroundPoint[])[],
): void {
  context.beginPath();
  for (const polygon of polygons) {
    for (const [index, point] of polygon.entries()) {
      const screen = tileToScreen(point.tx, point.ty);
      if (index === 0) context.moveTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
      else context.lineTo(snapToPixel(screen.sx), snapToPixel(screen.sy));
    }
    context.closePath();
  }
}

function tileCenter(tile: Tile): Point {
  const center = tileToScreen(tile.tx, tile.ty);
  return { x: center.sx, y: center.sy };
}

function traceSmallDiamond(
  context: CanvasRenderingContext2D,
  center: Point,
  rx: number,
  ry: number,
): void {
  context.beginPath();
  appendSmallDiamond(context, center, rx, ry);
}

function appendSmallDiamond(
  context: CanvasRenderingContext2D,
  center: Point,
  rx: number,
  ry: number,
): void {
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - ry));
  context.lineTo(snapToPixel(center.x + rx), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + ry));
  context.lineTo(snapToPixel(center.x - rx), snapToPixel(center.y));
  context.closePath();
}
