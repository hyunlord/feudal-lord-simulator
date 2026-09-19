import { drawBridgeDeck } from "./drawBridges";
import { drawHistoricalWater } from "./drawWater";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { getTile } from "../world/grid";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { buildingSpriteKey } from "./buildingSprites";
import { buildBuildingVisualState, buildingBodyProfile, renderDetailLevel } from "./buildingVisualState";
import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderOrder";
import type { TileRange } from "./renderer";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { drawGroundDecalDetail, drawRoadPath } from "./drawTerrainDetails";
import {
  TERRAIN_TEXTURE_COMPOSITE_OPACITY,
  getTerrainPattern,
  terrainPatternQuarterTurn,
  terrainTextureKeyFor,
  type TerrainPatternAssets,
} from "./terrainPatterns";
import { drawGroundingShadow, shade, snapToPixel, withAlpha } from "./style";
import { spriteMeta } from "./worldAssets";
import { historicalFacilityReady } from "./historicalFacilityAssets";
import { historicalHouseReady } from "./historicalHouseAssets";
import { drawHouseContactShadow, drawHouseFrontage, houseFrontage } from "./houseFrontage";
import { buildingFrontage, drawBuildingContactShadow, drawBuildingFrontage, supportsBuildingFrontage } from "./buildingFrontage";

export {
  terrainSeamFor,
  terrainSeamMarkCount,
  type TerrainSeamKind,
} from "./drawTerrainSeams";
export { TERRAIN_TEXTURE_COMPOSITE_OPACITY, terrainPatternQuarterTurn } from "./terrainPatterns";

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
  const waterReady = drawHistoricalWater(context, input.tiles.filter(tile => tile.terrain === "water"));
  for (const tile of input.tiles) {
    if (waterReady && tile.terrain === "water") continue;
    drawGroundDiamond(context, tile, input.state.seed, input.terrainPatterns);
  }
  for (const tile of input.tiles) {
    if (input.zoom > 0.7) drawGroundDecalDetail(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, input.zoom, input.terrainPatterns);
  }
  for (const item of input.objectRenderItems ?? []) {
    if (item.kind !== "building") continue;
    if (supportsBuildingFrontage(item.building.kind) || item.building.houseLot !== undefined) {
      const frontage = buildingFrontage(input.state, item.building, input.state.seed);
      if (frontage !== null) drawBuildingFrontage(context, frontage, input.terrainPatterns);
      continue;
    }
    if (item.building.kind !== "house") continue;
    const tile = getTile(input.state, item.building);
    if (tile === null || tile.buildingId !== item.building.id) continue;
    const frontage = houseFrontage(input.state, tile, input.state.seed);
    if (frontage !== null) drawHouseFrontage(context, frontage);
  }
  for (const tile of input.tiles) {
    if (tile.hasRoad && tile.terrain !== "water") drawRoadPath(context, input.state, tile, input.terrainPatterns);
    if (tile.hasRoad && tile.terrain === "water") drawBridgeDeck(context, input.state, tile);
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
    } else if (item.kind === "stump") {
      drawGroundingShadow(context, {
        centerX: item.descriptor.x,
        centerY: item.descriptor.y + 2,
        height: 20,
        scale: item.descriptor.scale,
        baseRadiusX: 8,
        baseRadiusY: 3,
      });
    } else if (item.kind === "building") {
      const config = buildingFootprint(item.building);
      const center = buildingCenter(item);
      const visualState = buildBuildingVisualState(item.building, input.state.houses);
      const meta = spriteMeta(buildingSpriteKey(item.building, visualState.houseLevel));
      const body = buildingBodyProfile(item.building.kind, visualState.houseLevel);
      const historicalHouse = item.building.kind === "house" && historicalHouseReady(visualState.houseLevel);
      if (renderDetailLevel(input.zoom) === "full" && (historicalHouse || historicalFacilityReady(item.building, input.state))) {
        if (historicalHouse && item.building.houseLot === undefined) drawHouseContactShadow(context, tileToScreen(item.building.tx, item.building.ty));
        else drawBuildingContactShadow(context, item.building);
        continue;
      }
      const baked = meta?.bakedArchitecture === true && meta.status === "ready" && renderDetailLevel(input.zoom) === "full";
      const base = baked ? tileToScreen(
        item.building.tx + meta.footprint.width - 1,
        item.building.ty + meta.footprint.height - 1,
      ) : center;
      if (item.building.houseLot !== undefined) {
        drawBuildingContactShadow(context, item.building);
        continue;
      }
      if (baked && item.building.kind === "house") {
        drawHouseContactShadow(context, base);
        continue;
      }
      if (baked && supportsBuildingFrontage(item.building.kind)) {
        drawBuildingContactShadow(context, item.building);
        continue;
      }
      drawGroundingShadow(context, {
        centerX: base.sx,
        centerY: base.sy + (baked ? -3 : 10),
        height: baked ? meta.height * meta.renderScale : meta?.height ?? body.height,
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
  const config = buildingFootprint(item.building);
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
    terrainPatternQuarterTurn(terrainTextureKeyFor(tile.terrain), tile.tx, tile.ty, seed),
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
  switch (terrain) {
    case "grass":
    case "forest":
    case "water":
    case "rock":
      return TERRAIN_TEXTURE_COMPOSITE_OPACITY;
  }
}

export function grassPatternQuarterTurn(tx: number, ty: number, seed: number): 0 | 1 | 2 | 3 {
  return terrainPatternQuarterTurn("grass", tx, ty, seed);
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
