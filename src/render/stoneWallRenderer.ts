import { drawMasonrySolid } from "./stoneWallMasonry";
import { drawRegisteredGate } from "./gateArtRenderer";
import { stoneWallNodeSolids } from "./stoneWallNodeGeometry";
import type { StoneWallNode } from "./stoneWallTopology";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { preloadStoneWallAssets, stoneWallImage, stoneWallMaterial } from "./stoneWallAssets";
import { STONE_WALL_SOURCES, stoneWallPieces, stoneWallTransform, type StoneWallPiece } from "./stoneWallGeometry";
import { drawCroppedWorldSprite } from "./worldSprite";
import { stoneWallFallbackSolids } from "./stoneWallFallbackGeometry";

const drawCounts = { sprites: 0, fallbackPieces: 0, gateClearances: 0 };
export function stoneWallDrawCounts() { return { ...drawCounts }; }

export function drawStoneWall(context: CanvasRenderingContext2D, input: Readonly<{ path: readonly TileEdgePoint[]; gate: TileEdgePoint | null; gates?: readonly TileEdgePoint[] | undefined; nodes?: readonly StoneWallNode[] | undefined }>): void {
  void preloadStoneWallAssets();
  for (const piece of stoneWallPieces(input.path, input.gate, input.gates)) {
    if (piece.from > 0 || piece.to < 1) drawCounts.gateClearances += 1;
    const image = piece.axis === null ? null : stoneWallImage(piece.axis);
    if (image === null || piece.axis === null) { drawCounts.fallbackPieces += 1; drawFallback(context, piece); continue; }
    drawCounts.sprites += 1;
    const matrix = stoneWallTransform(piece, STONE_WALL_SOURCES[piece.axis]);
    const left = piece.start.x + (piece.end.x - piece.start.x) * piece.from;
    const right = piece.start.x + (piece.end.x - piece.start.x) * piece.to;
    context.save();
    context.beginPath();
    context.rect(left, Math.min(piece.start.y, piece.end.y) - 48, right - left, Math.abs(piece.end.y - piece.start.y) + 64);
    context.clip();
    context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 1254, height: 1254 },
      { x: 0, y: 0, width: 1254, height: 1254 }, false);
    context.restore();
  }
  for (const node of input.nodes ?? []) {
    if (node.kind === "gate" && drawRegisteredGate(context, node, "stone")) continue;
    for (const solid of stoneWallNodeSolids(node)) drawMasonrySolid(context, solid, stoneWallMaterial());
  }
}

function drawFallback(context: CanvasRenderingContext2D, piece: StoneWallPiece): void {
  context.save();
  for (const solid of stoneWallFallbackSolids(piece)) drawMasonrySolid(context, solid);
  context.restore();
}
