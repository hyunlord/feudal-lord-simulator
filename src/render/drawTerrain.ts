import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import type { TileRange } from "./renderer";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { drawGroundDecalDetail, drawRoadPath } from "./drawTerrainDetails";
import { shade, snapToPixel } from "./style";

export {
  terrainSeamFor,
  terrainSeamMarkCount,
  type TerrainSeamKind,
} from "./drawTerrainSeams";

type TerrainRenderInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
};

const baseTerrainColor = (terrain: Tile["terrain"]): PaletteColor => {
  switch (terrain) {
    case "grass": return SEMANTIC_PALETTE.sage;
    case "forest": return SEMANTIC_PALETTE.forest;
    case "water": return SEMANTIC_PALETTE.water;
    case "rock": return SEMANTIC_PALETTE.stone;
  }
};

export function drawTerrain(
  context: CanvasRenderingContext2D,
  input: TerrainRenderInput,
): void {
  for (const tile of input.tiles) {
    drawGroundDiamond(context, tile, input.state.seed);
    if (input.zoom >= 0.7) drawGroundDecalDetail(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, input.zoom);
    if (tile.hasRoad) drawRoadPath(context, input.state, tile);
  }
}

function drawGroundDiamond(
  context: CanvasRenderingContext2D,
  tile: Tile,
  seed: number,
): void {
  const center = tileToScreen(tile.tx, tile.ty);
  context.fillStyle = shade(
    baseTerrainColor(tile.terrain),
    1 + terrainVariation(tile.tx, tile.ty, seed),
  );
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
  context.fill();
}
