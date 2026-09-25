import { drawCachedWorldRaster } from "./worldRasterCache";
import { stoneWallAssetStatuses } from "./stoneWallAssets";
import { gateAssetStatuses } from "./gateArtAssets";
import { timberWallAssetStatus } from "./timberWallAssets";
import { timberWallPostPoints } from "./timberGateGeometry";
import { drawRegisteredGate } from "./gateArtRenderer";
import { preloadTimberWallAssets } from "./timberWallAssets";
import { drawGateMarker, drawPost } from "./timberGateRenderer";
import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { PalisadeSegment } from "../engine/engine.types";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import {
  palisadeScreenPath,
  type PalisadeRenderPath,
} from "./palisadeRenderGeometry";
import type { StoneWallNode } from "./stoneWallTopology";
import { drawStoneWall } from "./stoneWallRenderer";
import { applyInkOutline, applyPaletteStroke, snapToPixel } from "./style";
import { drawWallFaceSlice, drawWallModules, type WallFaceSlice } from "./drawWallFaces";
import type { WallNode, WallPillar } from "../world/boundary/wallBaseline";
import { wallFaceReadiness } from "./terrainVariantAssets";

type DrawPalisadeSegmentInput = {
  readonly segment: PalisadeSegment;
  /** Curved ground (D3b): this unit edge's stretch of extruded face and the modules it owns. */
  readonly face?: { readonly slice: WallFaceSlice | null; readonly nodes: readonly WallNode[]; readonly pillars: readonly WallPillar[] } | undefined;
  readonly stoneNodes?: readonly StoneWallNode[] | undefined;
  readonly gate: TileEdgePoint | null;
  readonly gates?: readonly TileEdgePoint[] | undefined;
  readonly zoom: number;
};

type DrawPalisadeRunInput = {
  readonly path: PalisadeRenderPath;
  readonly style: PalisadeRunStyle;
  readonly zoom: number;
};

export type PalisadeRunStyle =
  | "queued"
  | "plot"
  | "foundation"
  | "frame"
  | "roof"
  | "completed";

export function drawPalisadeSegment(context: CanvasRenderingContext2D, input: DrawPalisadeSegmentInput): void {
  const points = palisadeScreenPath([...input.segment.edgePath,
    ...(input.stoneNodes ?? []).flatMap(node => [node.point, ...node.neighbors]),
    ...(input.face?.nodes ?? []).flatMap(node => [node.point, ...node.neighbors])]);
  if (points.length === 0) return;
  // A face slice enters the key by its chain hash and range (the samples themselves are large).
  const face = input.face === undefined ? null : { chain: input.face.slice?.chain.hash ?? null, t0: input.face.slice?.t0, t1: input.face.slice?.t1,
    material: input.face.slice?.chain.material, nodes: input.face.nodes, pillars: input.face.pillars, faces: wallFaceReadiness() };
  const key = JSON.stringify([{ ...input, face }, stoneWallAssetStatuses(), gateAssetStatuses(), timberWallAssetStatus()]);
  drawCachedWorldRaster(context, key, {
    left: Math.min(...points.map(point => point.x)) - 96,
    right: Math.max(...points.map(point => point.x)) + 96,
    top: Math.min(...points.map(point => point.y)) - 128,
    bottom: Math.max(...points.map(point => point.y)) + 48,
  }, paint => drawPalisadeSegmentUncached(paint, input));
}

export function drawPalisadeSegmentUncached(
  context: CanvasRenderingContext2D,
  input: DrawPalisadeSegmentInput,
): void {
  if (input.face !== undefined) {
    if (input.face.slice !== null) drawWallFaceSlice(context, input.face.slice);
    drawWallModules(context, input.face.nodes, input.face.pillars, input.segment.material === "stone" ? "stone" : "timber", input.zoom);
    return;
  }
  if (input.segment.material === "stone") {
    drawStoneWall(context, { path: input.segment.edgePath, gate: input.gate, gates: input.gates, nodes: input.stoneNodes });
    return;
  }
  drawCompletedPosts(context, input.segment.edgePath, input.zoom, "timber", input.gate, input.gates);
  if (input.stoneNodes !== undefined) {
    for (const node of input.stoneNodes) {
      if (node.kind !== "gate" || drawRegisteredGate(context, node, "timber")) continue;
      const path = node.neighbors.flatMap(point => [point, node.point]);
      drawGateMarker(context, path, node.point, input.zoom, node);
    }
  } else if (input.gate !== null) drawGateMarker(context, input.segment.edgePath, input.gate, input.zoom);
}

export function drawPalisadeRun(
  context: CanvasRenderingContext2D,
  input: DrawPalisadeRunInput,
): void {
  switch (input.style) {
    case "queued":
      drawLine(context, input.path, "queued", input.zoom);
      return;
    case "plot":
      drawLine(context, input.path, "plot", input.zoom);
      return;
    case "foundation":
      drawLine(context, input.path, "foundation", input.zoom);
      drawMidPost(context, input.path, input.zoom);
      return;
    case "frame":
      drawLine(context, input.path, "frame", input.zoom);
      drawEndPosts(context, input.path, input.zoom);
      return;
    case "roof":
      drawLine(context, input.path, "roof", input.zoom);
      drawBuilderMarker(context, input.path, input.zoom);
      return;
    case "completed":
      drawCompletedPosts(context, input.path, input.zoom, "timber");
      return;
    default:
      return assertNever(input.style);
  }
}

export function drawPalisadeGateFlourish(
  context: CanvasRenderingContext2D,
  input: { readonly gate: TileEdgePoint; readonly zoom: number; readonly progress: number },
): void {
  const screen = palisadeScreenPath([input.gate])[0];
  if (screen === undefined) return;
  const radius = 10 + Math.max(0, Math.min(1, input.progress)) * 14;
  context.save();
  context.globalAlpha = Math.max(0, 1 - input.progress * 0.55);
  context.fillStyle = SEMANTIC_PALETTE.gold;
  context.beginPath();
  context.ellipse(snapToPixel(screen.x + 3), snapToPixel(screen.y - 5), radius, radius * 0.45, 0, 0, Math.PI * 2);
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
  context.restore();
}

function drawLine(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  style: Exclude<PalisadeRunStyle, "completed">,
  zoom: number,
): void {
  context.save();
  if (style === "queued") context.setLineDash([6 / zoom, 4 / zoom]);
  if (style === "plot") context.setLineDash([4 / zoom, 4 / zoom]);
  context.beginPath();
  const points = palisadeScreenPath(path);
  const first = points[0];
  if (first === undefined) {
    context.restore();
    return;
  }
  context.moveTo(snapToPixel(first.x), snapToPixel(first.y));
  for (const point of points.slice(1)) {
    context.lineTo(snapToPixel(point.x), snapToPixel(point.y));
  }
  applyPaletteStroke(context, strokeColor(style), zoom);
  if (style === "plot") context.lineWidth = 2 / zoom;
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawMidPost(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  const midpoint = pathPointAt(path, 0.5);
  drawPost(context, midpoint, { width: 7, height: 16 }, zoom);
}

function drawEndPosts(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  for (const ratio of [0.25, 0.75]) {
    drawPost(context, pathPointAt(path, ratio), { width: 6, height: 38 }, zoom);
  }
}

function drawBuilderMarker(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  const center = pathPointAt(path, 0.5);
  context.fillStyle = PALETTE.gold;
  context.fillRect(snapToPixel(center.x - 3), snapToPixel(center.y - 5), 10, 8);
  applyInkOutline(context, zoom);
  context.strokeRect(snapToPixel(center.x - 3), snapToPixel(center.y - 5), 10, 8);
  context.fillRect(snapToPixel(center.x + 1), snapToPixel(center.y - 13), 2, 8);
}

function drawCompletedPosts(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
  material: "timber" | "stone",
  gate: TileEdgePoint | null = null,
  gates?: readonly TileEdgePoint[],
): void {
  void preloadTimberWallAssets();
  for (const point of palisadeScreenPath(timberWallPostPoints(path, gate, gates))) {
    drawPost(context, point, { width: 8, height: 30 }, zoom, material);
  }
}

function pathPointAt(
  path: PalisadeRenderPath,
  ratio: number,
): { readonly x: number; readonly y: number } {
  const points = palisadeScreenPath(path);
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? first;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  if (totalLength === 0) return first;

  const target = totalLength * Math.max(0, Math.min(1, ratio));
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    const start = points[index];
    const end = points[index + 1];
    if (length === undefined || start === undefined || end === undefined || length === 0) continue;
    if (target <= traversed + length) {
      const segmentRatio = (target - traversed) / length;
      return {
        x: start.x + (end.x - start.x) * segmentRatio,
        y: start.y + (end.y - start.y) * segmentRatio,
      };
    }
    traversed += length;
  }
  return last;
}

function strokeColor(style: Exclude<PalisadeRunStyle, "completed">): PaletteColor {
  switch (style) {
    case "queued":
      return SEMANTIC_PALETTE.inkLight;
    case "plot":
      return SEMANTIC_PALETTE.gold;
    case "foundation":
      return SEMANTIC_PALETTE.stone;
    case "frame":
    case "roof":
      return SEMANTIC_PALETTE.earthDark;
    default:
      return assertNever(style);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled palisade render style: ${JSON.stringify(value)}`);
}
