import { PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import {
  distributionReachTiles,
  selectedBuildingRoadComponent,
} from "../ui/diagnosticOverlayModel";
import type { TileCoordinate } from "../world/grid";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { snapToPixel, withAlpha } from "./style";

type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];

type DiagnosticOverlayInput = Readonly<{
  context: CanvasRenderingContext2D;
  state: GameState;
  zoom: number;
  selectedBuildingId: string | null;
}>;

function traceDiamond(context: CanvasRenderingContext2D, coordinate: TileCoordinate): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}

function drawTiles(
  context: CanvasRenderingContext2D,
  coordinates: readonly TileCoordinate[],
  color: PaletteColor,
): void {
  context.save();
  context.fillStyle = withAlpha(color, 0.3);
  for (const coordinate of coordinates) {
    traceDiamond(context, coordinate);
    context.fill();
  }
  context.restore();
}

export function drawDistributionReach(input: DiagnosticOverlayInput): void {
  drawTiles(input.context, distributionReachTiles(input.state), PALETTE.gold);
}

export function drawSelectedRoadComponent(input: DiagnosticOverlayInput): void {
  drawTiles(
    input.context,
    selectedBuildingRoadComponent(input.state, input.selectedBuildingId),
    PALETTE.ultramarine,
  );
}
