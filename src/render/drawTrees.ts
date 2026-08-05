import { PALETTE } from "../content/palette";
import type { Tile } from "../world/world.types";
import { renderDetailLevel } from "./buildingVisualState";
import { ambientOffset } from "./renderMotion";
import {
  buildTreeCluster,
  type ForestLookup,
  type TreeDescriptor,
} from "./treeLayout";
import { applyInkOutline, drawFlatDiamondShadow, snapToPixel } from "./style";

export function drawTreeCluster(
  context: CanvasRenderingContext2D,
  tick: number,
  tile: Tile,
  forestLookup: ForestLookup,
  seed: number,
  zoom: number,
): void {
  for (const tree of buildTreeCluster({ tile, forestLookup, seed })) {
    drawTree(context, tick, tree, zoom);
  }
}

function drawTree(
  context: CanvasRenderingContext2D,
  tick: number,
  tree: TreeDescriptor,
  zoom: number,
): void {
  if (renderDetailLevel(zoom) !== "full") {
    context.fillStyle = PALETTE[tree.tone];
    context.beginPath();
    context.ellipse(
      snapToPixel(tree.x),
      snapToPixel(tree.y - 18 * tree.scale),
      snapToPixel(15 * tree.scale),
      snapToPixel(12 * tree.scale),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
    return;
  }
  const sway = ambientOffset({ tick, amplitude: 2 * tree.scale, frequency: 0.72, phase: tree.phase });
  drawFlatDiamondShadow(context, {
    centerX: tree.x,
    centerY: tree.y + 7 * tree.scale,
    radiusX: 13 * tree.scale,
    radiusY: 5 * tree.scale,
  });
  context.fillStyle = PALETTE.earthDark;
  traceRect(context, tree.x - 2 * tree.scale, tree.y - 20 * tree.scale, 4 * tree.scale, 24 * tree.scale);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = PALETTE[tree.tone];
  traceTreeCanopy(context, tree, sway);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function traceTreeCanopy(
  context: CanvasRenderingContext2D,
  tree: TreeDescriptor,
  sway: number,
): void {
  if (tree.silhouette === "rounded") {
    context.beginPath();
    context.ellipse(
      snapToPixel(tree.x + sway),
      snapToPixel(tree.y - 28 * tree.scale),
      snapToPixel(17 * tree.scale),
      snapToPixel(14 * tree.scale),
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  const width = tree.silhouette === "broad" ? 19 : 13;
  const baseLift = tree.silhouette === "narrow" ? 10 : 12;
  context.beginPath();
  context.moveTo(snapToPixel(tree.x + sway), snapToPixel(tree.y - 42 * tree.scale));
  context.lineTo(snapToPixel(tree.x + width * tree.scale + sway), snapToPixel(tree.y - baseLift * tree.scale));
  context.lineTo(snapToPixel(tree.x - width * tree.scale + sway), snapToPixel(tree.y - baseLift * tree.scale));
  context.closePath();
}

function traceRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.beginPath();
  context.rect(snapToPixel(x), snapToPixel(y), snapToPixel(width), snapToPixel(height));
}
