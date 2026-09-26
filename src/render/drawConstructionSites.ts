export { preloadConstructionArtAssets, constructionArtAssetStatuses } from "./constructionArtAssets";
import { constructionArtImage, constructionArtLayers, drawConstructionArt } from "./constructionArtAssets";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import {
  constructionOnSiteLabel,
  constructionSiteFootprint,
  constructionStage,
  type ConstructionSite,
} from "../economy/construction";
import {
  isPalisadeConstructionSite,
  isStoneWallConstructionSite,
  type PalisadeConstructionSchedule,
} from "../economy/palisadeConstruction";
import {
  drawConstructionStageBand,
  type ConstructionRenderSignature,
} from "./constructionStageBands";
import { drawPalisadeConstructionSite } from "./drawPalisadeConstructionSites";
import { tileToScreen } from "./iso";
import { applyInkOutline, drawGroundingShadow, snapToPixel } from "./style";
import { drawWorldSpriteAtWorldAnchor, type WorldSpriteOptions } from "./worldSprite";
import { OBJECT_OUTLINE_ALPHA, type ObjectRenderViewMode } from "./occlusionModel";
import type { GameState } from "../engine/engine.types";
import { currentConstructionSiteLabel } from "../ui/constructionAccessModel";
import { constructionSiteLabelBoxes, type ConstructionLabelEntry } from "./constructionSiteLabelLayout";
import { drawConstructionPiles, drawConstructionPlaque, drawConstructionSign, drawWellStage } from "./constructionPlaque";
import { constructionMoment, CROSSFADE_MS, drawSiteDust } from "./constructionMoments";
import { constructionWorkProgress } from "./constructionVisibility";
import { drawConstructionGhost, drawConstructionSignIcon } from "./constructionGhost";
export {
  createConstructionCompletionTracker,
  constructionCompletionEffects,
  constructionCompletionEffectsForFrame,
  drawConstructionCompletionEffects,
  type ConstructionCompletionTracker,
  type ConstructionCompletionEffect,
} from "./constructionCompletionEffects";

type DrawConstructionSiteInput = {
  readonly site: ConstructionSite;
  readonly state?: GameState;
  readonly schedule?: PalisadeConstructionSchedule;
  readonly zoom: number;
  readonly presentationProgress?: number;
  readonly viewMode?: ObjectRenderViewMode;
  /** F0-V: wall-clock ms of the frame (stage crossfade, dust); absent in tests that draw one still frame. */
  readonly nowMs?: number;
  /** F0-V: the frame's sprite options (camera, DPR, viewport) for the completed-building ghost. */
  readonly spriteOptions?: WorldSpriteOptions;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

const CONSTRUCTION_BUILDER_SPRITE_KEY = "walker_builder";

export function constructionSiteRenderSignature(
  site: ConstructionSite,
  presentationProgress?: number,
): ConstructionRenderSignature {
  const progress = clampedPresentationProgress(presentationProgress);
  if (progress !== null) return renderSignatureForProgress(progress);
  const stage = constructionStage(site);
  switch (stage) {
    case "marked_plot":
      return "plot";
    case "foundation":
      return "foundation";
    case "frame":
      return "frame";
    case "roof":
      return "roof";
    default:
      return assertNever(stage);
  }
}

export function drawConstructionSite(
  context: CanvasRenderingContext2D,
  input: DrawConstructionSiteInput,
): void {
  if ((input.viewMode ?? "normal") === "outlines") {
    drawConstructionSiteSilhouette(context, input.site, input.zoom);
    return;
  }
  if (isPalisadeConstructionSite(input.site) || isStoneWallConstructionSite(input.site)) {
    drawPalisadeConstructionSite(context, {
      site: input.site,
      state: input.state,
      schedule: input.schedule ?? { kind: "active" },
      zoom: input.zoom,
    });
    return;
  }
  const anchor = siteAnchor(input.site);
  const footprint = constructionSiteFootprint(input.site);
  const presentationProgress = clampedPresentationProgress(input.presentationProgress);
  const artLayers = constructionArtLayers(input.site, constructionSiteRenderSignature(input.site, presentationProgress ?? undefined));
  const usesArt = artLayers.length > 0 && artLayers.every(layer => constructionArtImage(layer.key) !== null);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  drawGroundingShadow(context, usesArt ? {
    centerX: center.sx, centerY: center.sy + 3, height: 8,
    baseRadiusX: (footprint.width + footprint.height) * 12,
    baseRadiusY: (footprint.width + footprint.height) * 4,
  } : {
    centerX: anchor.x + footprint.width * 18,
    centerY: anchor.y + footprint.height * 6,
    height: 28,
    baseRadiusX: 20 + footprint.width * 15,
    baseRadiusY: 5 + footprint.height * 3,
  });
  // F0-V: a building site with a state draws its plaque (name, stage bar, arrival / owed material, blocker) after its
  // art; without a state (a still test frame) the UX-1 stall label stays.
  if (input.state === undefined) drawSiteLabel(context, input.site, input.state, input.zoom);
  const progress = constructionWorkProgress(input.site, presentationProgress ?? undefined);
  const moment = input.state === undefined || input.nowMs === undefined ? null
    : constructionMoment(input.site, input.nowMs, input.state.tick - input.site.startedTick < 8, presentationProgress ?? undefined);
  const signature = constructionSiteRenderSignature(input.site, presentationProgress ?? undefined);
  const drawStage = (stage: ConstructionRenderSignature, stageProgress: number | null, alpha: number) => {
    context.save();
    context.globalAlpha *= alpha;
    const drawn = input.site.kind === "well" ? drawWellStage(context, input.site, stageProgressFor(stage))
      : drawConstructionArt(context, input.site, stage);
    if (!drawn) drawConstructionStageBand(context, { signature: stage, anchor, zoom: input.zoom, progress: stageProgress });
    context.restore();
  };
  // The stage change fades the previous stage's art out over CROSSFADE_MS (visibility design 2절 작업 국면).
  const fade = moment === null || moment.previousStage === null ? 1 : Math.min(1, moment.stageAgeMs / CROSSFADE_MS);
  if (fade < 1 && moment?.previousStage !== null && moment?.previousStage !== undefined) drawStage(SIGNATURES[moment.previousStage], null, 1 - fade);
  drawStage(signature, presentationProgress, fade);
  if (input.state !== undefined) drawConstructionGhost(context, input.state, input.site, progress, input.spriteOptions);
  drawConstructionSign(context, input.site);
  drawConstructionSignIcon(context, input.site);
  drawConstructionPiles(context, input.site, progress);
  if (moment !== null) drawSiteDust(context, input.site, moment);
  // F0-V: the builders are the real builder walkers at the site; the static marker (a builder sprite, else a gold
  // square) stays only for still test frames without a state.
  if (input.state === undefined) drawBuilderMarker(context, input.site, anchor, input.zoom);
  if (input.state !== undefined && (input.viewMode ?? "normal") === "normal") drawConstructionPlaque(context, input.state, input.site, progress, input.zoom);
}

const SIGNATURES = ["plot", "foundation", "frame", "roof"] as const satisfies readonly ConstructionRenderSignature[];
function stageProgressFor(stage: ConstructionRenderSignature): number {
  return stage === "plot" ? 0 : stage === "foundation" ? 0.25 : stage === "frame" ? 0.55 : 0.85;
}


function drawConstructionSiteSilhouette(
  context: CanvasRenderingContext2D,
  site: ConstructionSite,
  zoom: number,
): void {
  const anchor = siteAnchor(site);
  const footprint = constructionSiteFootprint(site);
  const previousAlpha = context.globalAlpha;
  context.save();
  try {
    context.globalAlpha = previousAlpha * OBJECT_OUTLINE_ALPHA;
    context.fillStyle = PALETTE.ink;
    context.beginPath();
    context.moveTo(snapToPixel(anchor.x + footprint.width * 16), snapToPixel(anchor.y - 10));
    context.lineTo(snapToPixel(anchor.x + footprint.width * 34), snapToPixel(anchor.y + footprint.height * 9));
    context.lineTo(snapToPixel(anchor.x + footprint.width * 15), snapToPixel(anchor.y + footprint.height * 20));
    context.lineTo(snapToPixel(anchor.x - 4), snapToPixel(anchor.y + footprint.height * 4));
    context.closePath();
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  } finally {
    context.globalAlpha = previousAlpha;
    context.restore();
  }
}

function drawBuilderMarker(
  context: CanvasRenderingContext2D,
  site: ConstructionSite,
  anchor: Point,
  zoom: number,
): void {
  const footprint = constructionSiteFootprint(site);
  if (
    drawWorldSpriteAtWorldAnchor(
      context,
      CONSTRUCTION_BUILDER_SPRITE_KEY,
      footprint.tx,
      footprint.ty,
      { scale: 0.55 },
    )
  ) {
    return;
  }
  context.fillStyle = PALETTE.gold;
  context.fillRect(snapToPixel(anchor.x + 31), snapToPixel(anchor.y - 11), 10, 8);
  applyInkOutline(context, zoom);
  context.strokeRect(snapToPixel(anchor.x + 31), snapToPixel(anchor.y - 11), 10, 8);
  context.fillRect(snapToPixel(anchor.x + 35), snapToPixel(anchor.y - 19), 2, 8);
}

function drawSiteLabel(
  context: CanvasRenderingContext2D,
  site: ConstructionSite,
  state: GameState | undefined,
  zoom: number,
): void {
  const label = state === undefined ? constructionOnSiteLabel(site) : currentConstructionSiteLabel(state, site);
  if (label === "") return;
  context.font = `${Math.round(12 / Math.max(zoom, 0.5))}px Georgia, serif`;
  const box = constructionSiteLabelBoxes(labelEntriesThrough(state, site, label), zoom,
    text => context.measureText(text).width).get(site.id);
  if (box === undefined) return;
  applyInkOutline(context, zoom);
  context.beginPath();
  context.moveTo(snapToPixel(box.leaderX), snapToPixel(box.leaderTopY));
  context.lineTo(snapToPixel(box.leaderX), snapToPixel(box.leaderBottomY));
  context.stroke();
  const x = snapToPixel(box.x);
  const y = snapToPixel(box.y);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(x, y, box.width, box.height);
  context.strokeRect(x, y, box.width, box.height);
  context.fillStyle = PALETTE.ink;
  context.fillText(label, snapToPixel(box.textX), snapToPixel(box.textY));
}

/**
 * Labelled building sites up to and including `site`, in state order: the stagger is greedy in that order, so the
 * sites after this one cannot move its label. Wall sites draw their own queue labels and take no part.
 */
function labelEntriesThrough(state: GameState | undefined, site: ConstructionSite, label: string): readonly ConstructionLabelEntry[] {
  if (state === undefined) return [{ site, label }];
  const entries: ConstructionLabelEntry[] = [];
  for (const other of state.constructionSites) {
    if (other.id === site.id) return [...entries, { site, label }];
    if (isPalisadeConstructionSite(other) || isStoneWallConstructionSite(other)) continue;
    const otherLabel = currentConstructionSiteLabel(state, other);
    if (otherLabel !== "") entries.push({ site: other, label: otherLabel });
  }
  return [...entries, { site, label }];
}

function siteAnchor(site: ConstructionSite): Point {
  const origin = constructionSiteFootprint(site);
  const screen = tileToScreen(origin.tx, origin.ty);
  return { x: screen.sx, y: screen.sy };
}

function clampedPresentationProgress(progress: number | undefined): number | null {
  if (progress === undefined || !Number.isFinite(progress)) return null;
  return Math.max(0, Math.min(1, progress));
}

function renderSignatureForProgress(progress: number): ConstructionRenderSignature {
  if (progress < 0.25) return "plot";
  if (progress < 0.55) return "foundation";
  if (progress < 0.85) return "frame";
  return "roof";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled construction render variant: ${JSON.stringify(value)}`);
}
