import { PALETTE } from "../content/palette";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { PlacementFailure } from "../world/placement";
import type { TileCoordinate } from "../world/grid";
import type { PlacementTool } from "./renderer";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";

export type EconomyOverlayRenderInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly mode: OverlayMode;
  readonly zoom: number;
};

type FootprintOverlayInput = {
  readonly context: CanvasRenderingContext2D;
  readonly building: Building;
  readonly color: typeof PALETTE.vermilion;
  readonly zoom: number;
};

export function drawOverlay(input: EconomyOverlayRenderInput): void {
  switch (input.mode) {
    case "none":
    case "food":
    case "roads":
      return;
    case "water":
      drawWaterOverlay(input);
      return;
    case "labour":
      drawLabourOverlay(input);
      return;
  }
}

export type PlacementPreview = {
  readonly tool: PlacementTool;
  readonly tile: TileCoordinate | null;
  readonly footprint: readonly TileCoordinate[];
  readonly roadPath: readonly TileCoordinate[];
  readonly ok: boolean;
  readonly reason: PlacementFailure | null;
  readonly cursor: TileCoordinate | null;
};

export type PlacementOverlayInput = {
  readonly preview: PlacementPreview;
  readonly zoom: number;
};

export function drawPlacementOverlay(
  context: CanvasRenderingContext2D,
  input: PlacementOverlayInput,
): void {
  const coordinates = input.preview.tool === "road" ? input.preview.roadPath : input.preview.footprint;
  context.fillStyle = withAlpha(input.preview.ok ? PALETTE.sage : PALETTE.vermilion, 0.35);
  for (const coordinate of coordinates) {
    traceDiamond(context, coordinate);
    context.fill();
    applyInkOutline(context, input.zoom);
    context.stroke();
  }
  if (!input.preview.ok && input.preview.reason !== null && input.preview.cursor !== null) {
    drawFailureText(context, input.preview.cursor, input.preview.reason, input.zoom);
  }
}

function drawFailureText(
  context: CanvasRenderingContext2D,
  coordinate: TileCoordinate,
  reason: PlacementFailure,
  zoom: number,
): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  const label = reason.replaceAll("_", " ");
  const fontSize = 14 / zoom;
  const padding = 4 / zoom;
  const labelX = snapToPixel(center.sx + TILE_W / 3);
  const labelY = snapToPixel(center.sy - TILE_H / 2);
  context.font = `${fontSize}px Georgia, serif`;
  const plaqueX = snapToPixel(labelX - padding);
  const plaqueY = snapToPixel(labelY - fontSize - padding);
  const plaqueWidth = snapToPixel(context.measureText(label).width + padding * 2);
  const plaqueHeight = snapToPixel(fontSize + padding * 2);

  context.fillStyle = PALETTE.vellum;
  context.fillRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  applyInkOutline(context, zoom);
  context.strokeRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  context.fillStyle = PALETTE.vermilion;
  context.fillText(label, labelX, labelY);
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

function drawWaterOverlay(input: EconomyOverlayRenderInput): void {
  input.context.save();
  for (const well of input.state.buildings.filter((building) => building.kind === "well")) {
    input.context.fillStyle = withAlpha(PALETTE.water, 0.16);
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

function drawLabourOverlay(input: EconomyOverlayRenderInput): void {
  input.context.save();
  for (const building of input.state.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (definition.workersRequired === 0) continue;
    if (building.workers >= definition.workersRequired) continue;
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
