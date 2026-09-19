import type { TileEdgePoint } from "../world/palisadeGeometry";
import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile } from "../world/grid";
import { canTraverseRoadBoundary } from "../world/bridges";
import type { Tile } from "../world/world.types";
import { tileToScreen } from "./iso";
import { roadGroundPolygons } from "./organicRoadGeometry";
import { roadConnectionArms } from "./terrainDetails";
import { snapToPixel } from "./style";

export const ROAD_READABILITY_OVERLAY_ALPHA = 0.72;

export function roadReadabilityTiles(tiles: readonly Tile[], stoneGates: readonly TileEdgePoint[] = []): readonly Tile[] {
  return tiles.filter(tile => tile.hasRoad && tile.terrain !== "water" && !stoneGates.some(gate => Math.hypot(tile.tx - gate.x, tile.ty - gate.y) < 2));
}

export function drawRoadReadabilityOverlay(
  context: CanvasRenderingContext2D,
  state: GameState,
  tiles: readonly Tile[],
  stoneGates: readonly TileEdgePoint[] = [],
): void {
  const roadTiles = roadReadabilityTiles(tiles, stoneGates);
  if (roadTiles.length === 0) return;
  const previousAlpha = context.globalAlpha;
  context.save();
  try {
    context.globalAlpha = previousAlpha * ROAD_READABILITY_OVERLAY_ALPHA;
    context.fillStyle = SEMANTIC_PALETTE.earth;
    for (const tile of roadTiles) {
      const neighbours = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)
        .flatMap(([dx, dy]) => {
          const neighbour = getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy });
          return neighbour === null || !canTraverseRoadBoundary(state, tile, neighbour) ? [] : [neighbour];
        });
      const polygons = roadGroundPolygons({
        tx: tile.tx, ty: tile.ty, seed: state.seed,
        arms: roadConnectionArms(tile, neighbours), widthScale: 0.45,
      });
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
  } finally {
    context.globalAlpha = previousAlpha;
    context.restore();
  }
}
