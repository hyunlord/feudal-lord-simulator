import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { shade, snapToPixel } from "./style";

interface WorldDimensions {
  readonly width: number;
  readonly height: number;
}

interface VignettePoint {
  readonly x: number;
  readonly y: number;
}

interface VignettePoints {
  readonly top: VignettePoint;
  readonly right: VignettePoint;
  readonly bottom: VignettePoint;
  readonly left: VignettePoint;
}

export interface WorldVignetteBand {
  readonly marginTiles: number;
  readonly color: string;
  readonly points: VignettePoints;
}

export const CANVAS_SURROUND_COLOR = PALETTE.ink;

const VIGNETTE_BANDS = [
  { marginTiles: 3, color: shade(SEMANTIC_PALETTE.earthDark, 0.55) },
  { marginTiles: 2, color: shade(SEMANTIC_PALETTE.earthDark, 0.65) },
  { marginTiles: 1, color: shade(SEMANTIC_PALETTE.earthDark, 0.75) },
] as const;

export function worldVignetteBands(
  world: WorldDimensions,
): readonly WorldVignetteBand[] {
  return VIGNETTE_BANDS.map((band) => ({
    ...band,
    points: expandedWorldDiamond(world, band.marginTiles),
  }));
}

export function drawWorldVignette(
  context: Pick<
    CanvasRenderingContext2D,
    "beginPath" | "closePath" | "fill" | "fillStyle" | "lineTo" | "moveTo"
  >,
  world: WorldDimensions,
): void {
  for (const band of worldVignetteBands(world)) {
    context.fillStyle = band.color;
    context.beginPath();
    context.moveTo(snapToPixel(band.points.top.x), snapToPixel(band.points.top.y));
    context.lineTo(
      snapToPixel(band.points.right.x),
      snapToPixel(band.points.right.y),
    );
    context.lineTo(
      snapToPixel(band.points.bottom.x),
      snapToPixel(band.points.bottom.y),
    );
    context.lineTo(
      snapToPixel(band.points.left.x),
      snapToPixel(band.points.left.y),
    );
    context.closePath();
    context.fill();
  }
}

function expandedWorldDiamond(
  world: WorldDimensions,
  marginTiles: number,
): VignettePoints {
  const top = tileToScreen(-marginTiles, -marginTiles);
  const right = tileToScreen(world.width - 1 + marginTiles, -marginTiles);
  const bottom = tileToScreen(
    world.width - 1 + marginTiles,
    world.height - 1 + marginTiles,
  );
  const left = tileToScreen(-marginTiles, world.height - 1 + marginTiles);

  return {
    top: { x: top.sx, y: top.sy - TILE_H / 2 },
    right: { x: right.sx + TILE_W / 2, y: right.sy },
    bottom: { x: bottom.sx, y: bottom.sy + TILE_H / 2 },
    left: { x: left.sx - TILE_W / 2, y: left.sy },
  };
}
