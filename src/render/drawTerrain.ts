import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { buildingSpriteKey } from "./buildingSprites";
import { buildBuildingVisualState, buildingBodyProfile } from "./buildingVisualState";
import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderOrder";
import type { TileRange } from "./renderer";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { drawGroundDecalDetail, drawRoadPath } from "./drawTerrainDetails";
import {
  getTerrainPattern,
  terrainTextureKeyFor,
  type TerrainPatternAssets,
} from "./terrainPatterns";
import { drawGroundingShadow, shade, snapToPixel, withAlpha } from "./style";
import { spriteMeta } from "./worldAssets";

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
  readonly objectRenderItems?: readonly RenderQueueItem[];
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
  drawObjectGrounding(context, input);
}

function drawObjectGrounding(
  context: CanvasRenderingContext2D,
  input: TerrainRenderInput,
): void {
  for (const item of input.objectRenderItems ?? []) {
    if (item.kind === "tree") {
      const meta = spriteMeta(item.descriptor.spriteKey);
      drawGroundingShadow(context, {
        centerX: item.descriptor.x,
        centerY: item.descriptor.y + 7 * item.descriptor.scale,
        height: meta?.height ?? 44,
        scale: item.descriptor.scale,
        baseRadiusX: 13 * item.descriptor.scale,
        baseRadiusY: 5 * item.descriptor.scale,
      });
    } else if (item.kind === "building") {
      const config = BUILDING_CONFIG_BY_KIND[item.building.kind];
      const center = buildingCenter(item);
      const visualState = buildBuildingVisualState(item.building, input.state.houses);
      const meta = spriteMeta(buildingSpriteKey(item.building, visualState.houseLevel));
      const body = buildingBodyProfile(item.building.kind, visualState.houseLevel);
      drawGroundingShadow(context, {
        centerX: center.sx,
        centerY: center.sy + 10,
        height: meta?.height ?? body.height,
        baseRadiusX: config.width * TILE_W * 0.3,
        baseRadiusY: config.height * TILE_H * 0.26,
      });
    }
  }
}

function buildingCenter(item: Extract<ObjectRenderItem, { readonly kind: "building" }>): {
  readonly sx: number;
  readonly sy: number;
} {
  const config = BUILDING_CONFIG_BY_KIND[item.building.kind];
  return tileToScreen(
    item.building.tx + (config.width - 1) / 2,
    item.building.ty + (config.height - 1) / 2,
  );
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
    tile.terrain === "grass" ? grassPatternQuarterTurn(tile.tx, tile.ty, seed) : 0,
  );
  if (pattern !== null) {
    context.fillStyle = baseTerrainColor(tile.terrain);
    traceTerrainDiamond(context, tile);
    context.fill();
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
  const previousAlpha = context.globalAlpha;
  context.save();
  try {
    context.clip();
    context.globalAlpha = previousAlpha * terrainTextureOpacity(tile.terrain);
    context.fillStyle = pattern;
    context.fillRect(
      snapToPixel(center.sx - TILE_W / 2),
      snapToPixel(center.sy - TILE_H / 2),
      TILE_W,
      TILE_H,
    );
  } finally {
    context.globalAlpha = previousAlpha;
    context.restore();
  }
}

export function terrainTextureOpacity(terrain: Tile["terrain"]): number {
  return terrain === "water" ? 0.18 : 0.45;
}

export function grassPatternQuarterTurn(tx: number, ty: number, seed: number): 0 | 1 | 2 | 3 {
  const regionTx = Math.floor(tx / 8);
  const regionTy = Math.floor(ty / 8);
  let hash = Math.imul(regionTx + 40_961, 73_856_093) ^ Math.imul(regionTy + 73_121, 19_349_663);
  hash ^= Math.imul(seed + 101_111, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0 & 3) as 0 | 1 | 2 | 3;
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
