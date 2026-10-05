import { SEMANTIC_PALETTE } from "../content/palette";
import type { Tile } from "../world/world.types";
import { renderDetailLevel } from "./buildingVisualState";
import { screenToTile } from "./iso";
import { treeSway } from "./renderMotion";
import {
  buildTreeCluster,
  type ForestLookup,
  type GroundCoverDescriptor,
  type TreeDescriptor,
} from "./treeLayout";
import { applyInkOutline, snapToPixel } from "./style";
import type { GameState } from "../engine/engine.types";
import { calendarProgress } from "./calendarProgress";
import { treeProgression, treeWinterVariant } from "./seasonProgression";
import { seasonSprite, seasonVariant } from "./seasonArt";
import { seasonBlend as legacySeasonBlend, seasonForObject, type SeasonBlend } from "./seasonTransition";
import { drawWorldSpriteAtWorldAnchor, type WorldSpriteOptions } from "./worldSprite";

/**
 * INSTALL-15: a tree, shrub, tuft or stone in this season's art (the Wave 15 variant on the base's canvas and
 * registration; the base art where there is none or it is still loading). While the season turns, each object switches
 * at its own moment (seasonForObject). Variants are drawn untinted: the foliage-ramp tint only moves exact ramp
 * colours, and the received Wave 15 art has none (0 of ~3,000 opaque pixels on the large oak and each of its variants).
 * `salt` (the object's position) picks between a winter oak's bare and snowy art and its moment in the turn.
 */
function drawSeasonalSprite(context: CanvasRenderingContext2D, key: string, tx: number, ty: number, options: WorldSpriteOptions,
  blend: SeasonBlend | undefined, salt: number, identity = `${key}:${tx}:${ty}`): boolean {
  if (blend === undefined) return drawWorldSpriteAtWorldAnchor(context, key, tx, ty, options);
  const stage = blend.calendar === undefined ? null : treeProgression(blend.calendar, identity, blend.firstYear);
  let variant = seasonVariant(key, stage?.season ?? seasonForObject(blend, salt), salt);
  if (stage?.season === 3) {
    const specific = treeWinterVariant(key, stage.snowy);
    if (specific !== undefined) variant = specific;
  }
  const image = variant === null ? null : seasonSprite(variant);
  if (image === null) return drawWorldSpriteAtWorldAnchor(context, key, tx, ty, options);
  return drawWorldSpriteAtWorldAnchor(context, key, tx, ty, { ...options, image });
}

/** The object pass carries calendar phase without changing the legacy ground-transition receipt. */
export function seasonBlend(state: Pick<GameState, "tick" | "scenarioId">, nowMs: number = performance.now()): SeasonBlend {
  const calendar = calendarProgress(state);
  return { ...legacySeasonBlend(state, nowMs), calendar,
    firstYear: calendar.year === calendarProgress({ ...state, tick: 0 }).year };
}

const saltOf = (tx: number, ty: number): number => Math.floor(tx * 31 + ty * 17);

export function drawTreeCluster(
  context: CanvasRenderingContext2D,
  nowMs: number,
  tile: Tile,
  forestLookup: ForestLookup,
  seed: number,
  zoom: number,
): void {
  for (const tree of buildTreeCluster({ tile, forestLookup, seed })) {
    drawTree(context, nowMs, tree, zoom);
  }
}

export function drawTreeDescriptor(
  context: CanvasRenderingContext2D,
  input: {
    /** NAT-2 (QA-001): the wall clock the crowns sway on (moving while paused, the same pace at every speed). */
    readonly nowMs: number;
    readonly tree: TreeDescriptor;
    readonly zoom: number;
    readonly spriteOptions: WorldSpriteOptions;
    readonly season?: SeasonBlend;
  },
): void {
  // NAT-2 QA-008: the painted tree above block detail (its mip level when small); flat crowns on the strategic map.
  if (renderDetailLevel(input.zoom) !== "blocks") {
    // NAT-2 QA-001: the crown leans (a shear about the trunk's foot, which stays put) instead of the whole tree sliding.
    const anchor = screenToTile(input.tree.x, input.tree.y);
    if (
      drawSeasonalSprite(context, input.tree.spriteKey, anchor.tx, anchor.ty, {
        ...input.spriteOptions,
        scale: input.tree.scale,
        flipX: input.tree.flipX,
        shearX: treeSway(input.nowMs, input.tree.phase, input.tree.scale),
      }, input.season, saltOf(input.tree.anchorTx, input.tree.anchorTy), input.tree.id)
    ) {
      return;
    }
  }
  drawTree(context, input.nowMs, input.tree, input.zoom);
}

export function drawGroundCoverDescriptor(
  context: CanvasRenderingContext2D,
  input: {
    readonly descriptor: GroundCoverDescriptor;
    readonly zoom: number;
    readonly spriteOptions: WorldSpriteOptions;
    readonly season?: SeasonBlend;
  },
): void {
  if (renderDetailLevel(input.zoom) !== "full") return;
  if (
    drawSeasonalSprite(
      context,
      input.descriptor.spriteKey,
      input.descriptor.anchorTx,
      input.descriptor.anchorTy,
      { ...input.spriteOptions, scale: input.descriptor.scale },
      input.season, saltOf(input.descriptor.anchorTx, input.descriptor.anchorTy),
    )
  ) {
    return;
  }
  drawGroundCoverPrimitive(context, input.descriptor, input.zoom);
}

function drawTree(
  context: CanvasRenderingContext2D,
  nowMs: number,
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
  const sway = treeSway(nowMs, tree.phase, tree.scale);
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
