import { SEMANTIC_PALETTE } from "../content/palette";
import type { Tile } from "../world/world.types";
import { renderDetailLevel } from "./buildingVisualState";
import { screenToTile } from "./iso";
import { ambientOffset } from "./renderMotion";
import {
  buildTreeCluster,
  type ForestLookup,
  type GroundCoverDescriptor,
  type StumpDescriptor,
  type TreeDescriptor,
} from "./treeLayout";
import { applyInkOutline, snapToPixel } from "./style";
import { drawWorldSpriteAtWorldAnchor, type WorldSpriteOptions } from "./worldSprite";

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

export function drawTreeDescriptor(
  context: CanvasRenderingContext2D,
  input: {
    readonly tick: number;
    readonly tree: TreeDescriptor;
    readonly zoom: number;
    readonly spriteOptions: WorldSpriteOptions;
  },
): void {
  if (renderDetailLevel(input.zoom) === "full") {
    const sway = ambientOffset({
      tick: input.tick,
      amplitude: 2 * input.tree.scale,
      frequency: 0.72,
      phase: input.tree.phase,
    });
    const anchor = screenToTile(input.tree.x + sway, input.tree.y);
    if (
      drawWorldSpriteAtWorldAnchor(context, input.tree.spriteKey, anchor.tx, anchor.ty, {
        ...input.spriteOptions,
        scale: input.tree.scale,
        tint: input.tree.tone,
      })
    ) {
      return;
    }
  }
  drawTree(context, input.tick, input.tree, input.zoom);
}

export function drawGroundCoverDescriptor(
  context: CanvasRenderingContext2D,
  input: {
    readonly descriptor: GroundCoverDescriptor;
    readonly zoom: number;
    readonly spriteOptions: WorldSpriteOptions;
  },
): void {
  if (renderDetailLevel(input.zoom) !== "full") return;
  if (
    drawWorldSpriteAtWorldAnchor(
      context,
      input.descriptor.spriteKey,
      input.descriptor.anchorTx,
      input.descriptor.anchorTy,
      { ...input.spriteOptions, scale: input.descriptor.scale },
    )
  ) {
    return;
  }
  drawGroundCoverPrimitive(context, input.descriptor, input.zoom);
}

export function drawStumpDescriptor(
  context: CanvasRenderingContext2D,
  input: {
    readonly descriptor: StumpDescriptor;
    readonly zoom: number;
    readonly spriteOptions: WorldSpriteOptions;
  },
): void {
  if (
    drawWorldSpriteAtWorldAnchor(
      context,
      input.descriptor.spriteKey,
      input.descriptor.anchorTx,
      input.descriptor.anchorTy,
      { ...input.spriteOptions, scale: input.descriptor.scale },
    )
  ) {
    return;
  }
  drawStumpPrimitive(context, input.descriptor, input.zoom);
}

function drawTree(
  context: CanvasRenderingContext2D,
  tick: number,
  tree: TreeDescriptor,
  zoom: number,
): void {
  if (renderDetailLevel(zoom) !== "full") {
    context.fillStyle = tree.tone;
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
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  traceRect(context, tree.x - 2 * tree.scale, tree.y - 20 * tree.scale, 4 * tree.scale, 24 * tree.scale);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = tree.tone;
  traceTreeCanopy(context, tree, sway);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawGroundCoverPrimitive(
  context: CanvasRenderingContext2D,
  descriptor: GroundCoverDescriptor,
  zoom: number,
): void {
  context.fillStyle = SEMANTIC_PALETTE.sageDark;
  context.beginPath();
  context.ellipse(
    snapToPixel(descriptor.x),
    snapToPixel(descriptor.y - 4 * descriptor.scale),
    snapToPixel(8 * descriptor.scale),
    snapToPixel(5 * descriptor.scale),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawStumpPrimitive(
  context: CanvasRenderingContext2D,
  descriptor: StumpDescriptor,
  zoom: number,
): void {
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  context.beginPath();
  context.ellipse(
    snapToPixel(descriptor.x),
    snapToPixel(descriptor.y - 3),
    snapToPixel(11),
    snapToPixel(5),
    0,
    0,
    Math.PI * 2,
  );
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
