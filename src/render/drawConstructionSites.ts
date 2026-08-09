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
import { drawWorldSpriteAtWorldAnchor } from "./worldSprite";
import { OBJECT_OUTLINE_ALPHA, type ObjectRenderViewMode } from "./occlusionModel";
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
  readonly schedule?: PalisadeConstructionSchedule;
  readonly zoom: number;
  readonly presentationProgress?: number;
  readonly viewMode?: ObjectRenderViewMode;
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
      schedule: input.schedule ?? { kind: "active" },
      zoom: input.zoom,
    });
    return;
  }
  const anchor = siteAnchor(input.site);
  const footprint = constructionSiteFootprint(input.site);
  const presentationProgress = clampedPresentationProgress(input.presentationProgress);
  drawGroundingShadow(context, {
    centerX: anchor.x + footprint.width * 18,
    centerY: anchor.y + footprint.height * 6,
    height: 28,
    baseRadiusX: 20 + footprint.width * 15,
    baseRadiusY: 5 + footprint.height * 3,
  });
  drawSiteLabel(context, input.site, anchor, input.zoom);
  drawConstructionStageBand(context, {
    signature: constructionSiteRenderSignature(
      input.site,
      presentationProgress ?? undefined,
    ),
    anchor,
    zoom: input.zoom,
    progress: presentationProgress,
  });
  drawBuilderMarker(context, input.site, anchor, input.zoom);
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
  anchor: Point,
  zoom: number,
): void {
  const label = constructionOnSiteLabel(site);
  if (label === "") return;
  const x = snapToPixel(anchor.x - 22);
  const y = snapToPixel(anchor.y - 64);
  context.font = `${Math.round(12 / Math.max(zoom, 0.5))}px Georgia, serif`;
  const width = Math.ceil(context.measureText(label).width);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(x - 4, y - 13, width + 8, 18);
  applyInkOutline(context, zoom);
  context.strokeRect(x - 4, y - 13, width + 8, 18);
  context.fillStyle = PALETTE.ink;
  context.fillText(label, x, y);
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
