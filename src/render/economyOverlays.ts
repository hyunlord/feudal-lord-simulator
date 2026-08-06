import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";

export type EconomyOverlayRenderInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly zoom: number;
};

type FootprintOverlayInput = {
  readonly context: CanvasRenderingContext2D;
  readonly building: Building;
  readonly color: typeof PALETTE.vermilion;
  readonly zoom: number;
};

export function drawWaterOverlay(input: EconomyOverlayRenderInput): void {
  input.context.save();
  for (const well of input.state.buildings.filter((building) => building.kind === "well")) {
    input.context.fillStyle = withAlpha(SEMANTIC_PALETTE.water, 0.16);
    for (const coordinate of wellCoverageTiles(input.state, well)) {
      traceDiamond(input.context, coordinate);
      input.context.fill();
    }
  }
  for (const house of input.state.houses) {
    if (house.hasWater) continue;
    const building = input.state.buildings.find((candidate) => candidate.id === house.buildingId);
    if (building !== undefined) {
      drawFootprint({ context: input.context, building, color: PALETTE.vermilion, zoom: input.zoom });
    }
  }
  input.context.restore();
}

export function wellCoverageTiles(
  world: Pick<GameState, "width" | "height">,
  well: Building,
): readonly TileCoordinate[] {
  const radius = BUILDING_CONFIG_BY_KIND.well.serviceRadius;
  const coordinates: TileCoordinate[] = [];
  for (let ty = well.ty - radius; ty <= well.ty + radius; ty += 1) {
    for (let tx = well.tx - radius; tx <= well.tx + radius; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) continue;
      if (Math.abs(tx - well.tx) + Math.abs(ty - well.ty) > radius) continue;
      coordinates.push({ tx, ty });
    }
  }
  return coordinates;
}

export function drawLabourOverlay(input: EconomyOverlayRenderInput): void {
  input.context.save();
  for (const building of input.state.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (definition.workersRequired === 0 || building.workers >= definition.workersRequired) continue;
    drawFootprint({ context: input.context, building, color: PALETTE.vermilion, zoom: input.zoom });
  }
  input.context.restore();
}

function drawFootprint(input: FootprintOverlayInput): void {
  const definition = BUILDING_CONFIG_BY_KIND[input.building.kind];
  input.context.fillStyle = withAlpha(input.color, 0.42);
  for (let ty = input.building.ty; ty < input.building.ty + definition.height; ty += 1) {
    for (let tx = input.building.tx; tx < input.building.tx + definition.width; tx += 1) {
      traceDiamond(input.context, { tx, ty });
      input.context.fill();
      applyInkOutline(input.context, input.zoom);
      input.context.stroke();
    }
  }
}

function traceDiamond(context: CanvasRenderingContext2D, coordinate: TileCoordinate): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}
