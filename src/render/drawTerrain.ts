import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import type { TileRange } from "./renderer";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { drawGroundDecalDetail, drawRoadPath } from "./drawTerrainDetails";
import {
  getTerrainPattern,
  terrainTextureKeyFor,
  type TerrainPatternAssets,
} from "./terrainPatterns";
import { shade, snapToPixel, withAlpha } from "./style";

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
  readonly terrainPatterns?: TerrainPatternAssets;
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
    drawGroundDiamond(context, tile, input.state.seed, input.terrainPatterns);
    if (input.zoom > 0.7) drawGroundDecalDetail(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, input.zoom);
    if (tile.hasRoad) drawRoadPath(context, input.state, tile, input.terrainPatterns);
  }
}

function drawGroundDiamond(
  context: CanvasRenderingContext2D,
  tile: Tile,
  seed: number,
  terrainPatterns: TerrainPatternAssets | undefined,
): void {
  const variation = terrainVariation(tile.tx, tile.ty, seed);
  const pattern = getTerrainPattern(
    context,
    terrainTextureKeyFor(tile.terrain),
    terrainPatterns,
  );
  if (pattern !== null) {
    fillTerrainPattern(context, tile, pattern);
    context.fillStyle = variationOverlayStyle(variation);
    traceTerrainDiamond(context, tile);
    context.fill();
    return;
  }

  context.fillStyle = shade(baseTerrainColor(tile.terrain), 1 + variation);
  traceTerrainDiamond(context, tile);
  context.fill();
}

function fillTerrainPattern(
  context: CanvasRenderingContext2D,
  tile: Tile,
  pattern: CanvasPattern,
): void {
  const center = tileToScreen(tile.tx, tile.ty);
  traceTerrainDiamond(context, tile);
  context.save();
  try {
    context.clip();
    context.fillStyle = pattern;
    context.fillRect(
      snapToPixel(center.sx - TILE_W / 2),
      snapToPixel(center.sy - TILE_H / 2),
      TILE_W,
      TILE_H,
    );
  } finally {
    context.restore();
  }
}

function traceTerrainDiamond(
  context: CanvasRenderingContext2D,
  tile: Tile,
): void {
  const center = tileToScreen(tile.tx, tile.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}

function variationOverlayStyle(variation: number): string {
  const color = variation >= 0 ? SEMANTIC_PALETTE.vellum : SEMANTIC_PALETTE.ink;
  return withAlpha(color, Math.abs(variation));
}
