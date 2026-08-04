import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import type { TileRange } from "./renderer";
import { applyInkOutline, shade, snapToPixel } from "./style";
import { PALETTE, type PaletteColor } from "../content/palette";

type TerrainRenderInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
};

type Diamond = {
  readonly x: number;
  readonly y: number;
};

const baseTerrainColor = (terrain: Tile["terrain"]): PaletteColor => {
  switch (terrain) {
    case "grass":
      return PALETTE.sage;
    case "forest":
      return PALETTE.forest;
    case "water":
      return PALETTE.water;
    case "rock":
      return PALETTE.stone;
  }
};

export function drawTerrain(
  context: CanvasRenderingContext2D,
  input: TerrainRenderInput,
): void {
  for (const tile of input.tiles) {
    drawGroundDiamond(context, tile, input.zoom);
    drawTerrainTransitions(context, input.state, tile, input.zoom);
    if (tile.hasRoad) {
      drawRoad(context, input.state, tile, input.zoom);
    }
  }
}

function drawGroundDiamond(context: CanvasRenderingContext2D, tile: Tile, zoom: number): void {
  const center = tileCenter(tile);
  const base = baseTerrainColor(tile.terrain);
  const multiplier = 1 + terrainVariation(tile.tx, tile.ty);
  const lit = shade(base, multiplier);
  const shaded = shade(base, multiplier * 0.8);
  context.fillStyle = lit;
  traceHalfDiamond(context, center, "upperLeft");
  context.fill();
  context.fillStyle = shaded;
  traceHalfDiamond(context, center, "downRight");
  context.fill();
  applyInkOutline(context, zoom);
  traceDiamond(context, center);
  context.stroke();
}

function drawTerrainTransitions(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  zoom: number,
): void {
  for (const neighbor of orthogonalNeighbors(tile)) {
    const neighborTile = getTile(state, neighbor);
    if (neighborTile === null || neighborTile.terrain === tile.terrain) {
      continue;
    }
    if (!transitionTerrain(neighborTile.terrain) && !transitionTerrain(tile.terrain)) {
      continue;
    }
    context.fillStyle = baseTerrainColor(neighborTile.terrain);
    if (neighborTile.terrain === "water" || tile.terrain === "water") {
      traceWaterBoundary(context, tileCenter(tile), neighbor.tx - tile.tx, neighbor.ty - tile.ty, tile);
    } else {
      traceForestTuft(context, tileCenter(tile), neighbor.tx - tile.tx, neighbor.ty - tile.ty);
    }
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
}

function drawRoad(context: CanvasRenderingContext2D, state: GameState, tile: Tile, zoom: number): void {
  const center = tileCenter(tile);
  context.fillStyle = PALETTE.earth;
  traceSmallDiamond(context, center, TILE_W * 0.22, TILE_H * 0.22);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  for (const neighbor of orthogonalNeighbors(tile)) {
    if (getTile(state, neighbor)?.hasRoad === true) {
      traceRoadConnector(context, center, neighbor.tx - tile.tx, neighbor.ty - tile.ty);
      context.fill();
      applyInkOutline(context, zoom);
      context.stroke();
    }
  }
}

function transitionTerrain(terrain: Tile["terrain"]): boolean {
  return terrain === "water" || terrain === "forest";
}

function orthogonalNeighbors(tile: Tile): readonly TileCoordinate[] {
  return [
    { tx: tile.tx, ty: tile.ty - 1 },
    { tx: tile.tx + 1, ty: tile.ty },
    { tx: tile.tx, ty: tile.ty + 1 },
    { tx: tile.tx - 1, ty: tile.ty },
  ];
}

function tileCenter(tile: Tile): Diamond {
  const center = tileToScreen(tile.tx, tile.ty);
  return { x: center.sx, y: center.sy };
}

function traceDiamond(context: CanvasRenderingContext2D, center: Diamond): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - TILE_H / 2));
  context.lineTo(snapToPixel(center.x + TILE_W / 2), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + TILE_H / 2));
  context.lineTo(snapToPixel(center.x - TILE_W / 2), snapToPixel(center.y));
  context.closePath();
}

function traceHalfDiamond(context: CanvasRenderingContext2D, center: Diamond, side: "upperLeft" | "downRight"): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y));
  if (side === "upperLeft") {
    context.lineTo(snapToPixel(center.x), snapToPixel(center.y - TILE_H / 2));
    context.lineTo(snapToPixel(center.x - TILE_W / 2), snapToPixel(center.y));
  } else {
    context.lineTo(snapToPixel(center.x + TILE_W / 2), snapToPixel(center.y));
    context.lineTo(snapToPixel(center.x), snapToPixel(center.y + TILE_H / 2));
  }
  context.closePath();
}

function traceSmallDiamond(context: CanvasRenderingContext2D, center: Diamond, rx: number, ry: number): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - ry));
  context.lineTo(snapToPixel(center.x + rx), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + ry));
  context.lineTo(snapToPixel(center.x - rx), snapToPixel(center.y));
  context.closePath();
}

function traceWaterBoundary(
  context: CanvasRenderingContext2D,
  center: Diamond,
  dx: number,
  dy: number,
  tile: Tile,
): void {
  const edgeX = center.x + ((dx - dy) * TILE_W) / 8;
  const edgeY = center.y + ((dx + dy) * TILE_H) / 8;
  const ripple = ((tile.tx * 17 + tile.ty * 11 + dx * 5 + dy * 7) % 5) - 2;
  context.beginPath();
  context.moveTo(snapToPixel(edgeX - TILE_W * 0.17), snapToPixel(edgeY + ripple));
  context.lineTo(snapToPixel(edgeX + TILE_W * 0.04), snapToPixel(edgeY - TILE_H * 0.09 - ripple));
  context.lineTo(snapToPixel(edgeX + TILE_W * 0.2), snapToPixel(edgeY + TILE_H * 0.05 + ripple));
  context.lineTo(snapToPixel(edgeX - TILE_W * 0.03), snapToPixel(edgeY + TILE_H * 0.12 - ripple));
  context.closePath();
}

function traceForestTuft(context: CanvasRenderingContext2D, center: Diamond, dx: number, dy: number): void {
  const edgeX = center.x + ((dx - dy) * TILE_W) / 8;
  const edgeY = center.y + ((dx + dy) * TILE_H) / 8;
  context.beginPath();
  context.moveTo(snapToPixel(edgeX - TILE_W * 0.12), snapToPixel(edgeY + TILE_H * 0.08));
  context.lineTo(snapToPixel(edgeX), snapToPixel(edgeY - TILE_H * 0.13));
  context.lineTo(snapToPixel(edgeX + TILE_W * 0.12), snapToPixel(edgeY + TILE_H * 0.08));
  context.closePath();
}

function traceRoadConnector(context: CanvasRenderingContext2D, center: Diamond, dx: number, dy: number): void {
  const endX = center.x + ((dx - dy) * TILE_W) / 4;
  const endY = center.y + ((dx + dy) * TILE_H) / 4;
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - 3));
  context.lineTo(snapToPixel(endX), snapToPixel(endY - 3));
  context.lineTo(snapToPixel(endX), snapToPixel(endY + 3));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + 3));
  context.closePath();
}
