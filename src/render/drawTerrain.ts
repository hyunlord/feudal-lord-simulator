import { PALETTE, type PaletteColor } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { terrainVariation } from "../world/terrain";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import type { TileRange } from "./renderer";
import { applyInkOutline, shade, snapToPixel } from "./style";

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

type EdgeBasis = {
  readonly edgeX: number;
  readonly edgeY: number;
  readonly inwardX: number;
  readonly inwardY: number;
  readonly tangentX: number;
  readonly tangentY: number;
};

export type TerrainSeamKind =
  | "shoreline"
  | "forestTufts"
  | "rockPebbles";

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

export function terrainSeamFor(
  terrain: Tile["terrain"],
  neighbourTerrain: Tile["terrain"],
): TerrainSeamKind | null {
  if (terrain !== "grass") return null;

  switch (neighbourTerrain) {
    case "water":
      return "shoreline";
    case "forest":
      return "forestTufts";
    case "rock":
      return "rockPebbles";
    case "grass":
      return null;
  }
}

export function terrainSeamMarkCount(
  seam: TerrainSeamKind,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  seed: number,
): number {
  if (seam === "shoreline") return 1;
  return 2 + (seamHash(tx, ty, dx, dy, seed) & 1);
}

export function drawTerrain(
  context: CanvasRenderingContext2D,
  input: TerrainRenderInput,
): void {
  for (const tile of input.tiles) {
    drawGroundDiamond(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, input.zoom);
    if (tile.hasRoad) {
      drawRoad(context, input.state, tile, input.zoom);
    }
  }
}

function drawGroundDiamond(
  context: CanvasRenderingContext2D,
  tile: Tile,
  seed: number,
): void {
  const center = tileCenter(tile);
  const base = baseTerrainColor(tile.terrain);
  const multiplier = 1 + terrainVariation(tile.tx, tile.ty, seed);
  context.fillStyle = shade(base, multiplier);
  traceDiamond(context, center);
  context.fill();
}

function drawTerrainTransitions(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  zoom: number,
): void {
  for (const neighbour of orthogonalNeighbors(tile)) {
    const neighbourTile = getTile(state, neighbour);
    if (neighbourTile === null) continue;

    const seam = terrainSeamFor(tile.terrain, neighbourTile.terrain);
    if (seam === null) continue;

    const dx = neighbour.tx - tile.tx;
    const dy = neighbour.ty - tile.ty;
    const count = terrainSeamMarkCount(
      seam,
      tile.tx,
      tile.ty,
      dx,
      dy,
      state.seed,
    );
    context.fillStyle = seamColor(seam);

    switch (seam) {
      case "shoreline":
        traceShoreline(context, tileCenter(tile), dx, dy);
        break;
      case "forestTufts":
        traceForestTufts(context, tileCenter(tile), dx, dy, count);
        break;
      case "rockPebbles":
        traceRockPebbles(context, tileCenter(tile), dx, dy, count);
        break;
    }

    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
}

function seamColor(seam: TerrainSeamKind): PaletteColor {
  switch (seam) {
    case "shoreline":
      return PALETTE.earth;
    case "forestTufts":
      return PALETTE.sageDark;
    case "rockPebbles":
      return PALETTE.stoneDark;
  }
}

function drawRoad(
  context: CanvasRenderingContext2D,
  state: GameState,
  tile: Tile,
  zoom: number,
): void {
  const center = tileCenter(tile);
  context.fillStyle = PALETTE.earth;
  traceSmallDiamond(context, center, TILE_W * 0.22, TILE_H * 0.22);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  for (const neighbour of orthogonalNeighbors(tile)) {
    if (getTile(state, neighbour)?.hasRoad === true) {
      traceRoadConnector(
        context,
        center,
        neighbour.tx - tile.tx,
        neighbour.ty - tile.ty,
      );
      context.fill();
      applyInkOutline(context, zoom);
      context.stroke();
    }
  }
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

function traceDiamond(
  context: CanvasRenderingContext2D,
  center: Diamond,
): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - TILE_H / 2));
  context.lineTo(snapToPixel(center.x + TILE_W / 2), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + TILE_H / 2));
  context.lineTo(snapToPixel(center.x - TILE_W / 2), snapToPixel(center.y));
  context.closePath();
}


function traceSmallDiamond(
  context: CanvasRenderingContext2D,
  center: Diamond,
  rx: number,
  ry: number,
): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - ry));
  context.lineTo(snapToPixel(center.x + rx), snapToPixel(center.y));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + ry));
  context.lineTo(snapToPixel(center.x - rx), snapToPixel(center.y));
  context.closePath();
}

function traceShoreline(
  context: CanvasRenderingContext2D,
  center: Diamond,
  dx: number,
  dy: number,
): void {
  const basis = edgeBasis(center, dx, dy);
  const startX = basis.edgeX - basis.tangentX * 0.38;
  const startY = basis.edgeY - basis.tangentY * 0.38;
  const endX = basis.edgeX + basis.tangentX * 0.38;
  const endY = basis.edgeY + basis.tangentY * 0.38;

  context.beginPath();
  context.moveTo(snapToPixel(startX), snapToPixel(startY));
  context.lineTo(snapToPixel(endX), snapToPixel(endY));
  context.lineTo(
    snapToPixel(endX + basis.inwardX),
    snapToPixel(endY + basis.inwardY),
  );
  context.lineTo(
    snapToPixel(startX + basis.inwardX),
    snapToPixel(startY + basis.inwardY),
  );
  context.closePath();
}

function traceForestTufts(
  context: CanvasRenderingContext2D,
  center: Diamond,
  dx: number,
  dy: number,
  count: number,
): void {
  const basis = edgeBasis(center, dx, dy);
  context.beginPath();

  for (let index = 0; index < count; index += 1) {
    const position = (index + 1) / (count + 1) - 0.5;
    const baseX =
      basis.edgeX + basis.inwardX + basis.tangentX * position * 0.72;
    const baseY =
      basis.edgeY + basis.inwardY + basis.tangentY * position * 0.72;
    const halfWidth = 2 + (index % 2);
    const height = 4 + (index % 2);

    context.moveTo(
      snapToPixel(baseX - halfWidth),
      snapToPixel(baseY + height / 2),
    );
    context.lineTo(snapToPixel(baseX), snapToPixel(baseY - height));
    context.lineTo(
      snapToPixel(baseX + halfWidth),
      snapToPixel(baseY + height / 2),
    );
    context.closePath();
  }
}

function traceRockPebbles(
  context: CanvasRenderingContext2D,
  center: Diamond,
  dx: number,
  dy: number,
  count: number,
): void {
  const basis = edgeBasis(center, dx, dy);
  context.beginPath();

  for (let index = 0; index < count; index += 1) {
    const position = (index + 1) / (count + 1) - 0.5;
    const pebbleX =
      basis.edgeX + basis.inwardX + basis.tangentX * position * 0.68;
    const pebbleY =
      basis.edgeY + basis.inwardY + basis.tangentY * position * 0.68;
    const radiusX = 2 + (index % 2);
    const radiusY = 1 + (index % 2);

    context.moveTo(snapToPixel(pebbleX), snapToPixel(pebbleY - radiusY));
    context.lineTo(snapToPixel(pebbleX + radiusX), snapToPixel(pebbleY));
    context.lineTo(snapToPixel(pebbleX), snapToPixel(pebbleY + radiusY));
    context.lineTo(snapToPixel(pebbleX - radiusX), snapToPixel(pebbleY));
    context.closePath();
  }
}

function edgeBasis(
  center: Diamond,
  dx: number,
  dy: number,
): EdgeBasis {
  return {
    edgeX: center.x + ((dx - dy) * TILE_W) / 4,
    edgeY: center.y + ((dx + dy) * TILE_H) / 4,
    inwardX: -((dx - dy) * TILE_W) * 0.035,
    inwardY: -((dx + dy) * TILE_H) * 0.035,
    tangentX: -((dx + dy) * TILE_W) / 2,
    tangentY: ((dx - dy) * TILE_H) / 2,
  };
}

function seamHash(
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  seed: number,
): number {
  let hash =
    Math.imul(tx, 73_856_093) ^
    Math.imul(ty, 19_349_663) ^
    Math.imul(dx + 2, 83_492_791) ^
    Math.imul(dy + 2, 2_654_435_761) ^
    Math.imul(seed, 374_761_393);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function traceRoadConnector(
  context: CanvasRenderingContext2D,
  center: Diamond,
  dx: number,
  dy: number,
): void {
  const endX = center.x + ((dx - dy) * TILE_W) / 4;
  const endY = center.y + ((dx + dy) * TILE_H) / 4;
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - 3));
  context.lineTo(snapToPixel(endX), snapToPixel(endY - 3));
  context.lineTo(snapToPixel(endX), snapToPixel(endY + 3));
  context.lineTo(snapToPixel(center.x), snapToPixel(center.y + 3));
  context.closePath();
}
