import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import {
  constructionOnSiteLabel,
  constructionSiteFootprint,
  constructionStage,
  type ConstructionSite,
} from "../economy/construction";
import {
  isPalisadeConstructionSite,
  type PalisadeConstructionSchedule,
} from "../economy/palisadeConstruction";
import { drawPalisadeConstructionSite } from "./drawPalisadeConstructionSites";
import { tileToScreen } from "./iso";
import { applyInkOutline, drawGroundingShadow, snapToPixel, withAlpha } from "./style";
export {
  constructionCompletionEffects,
  constructionCompletionEffectsForFrame,
  drawConstructionCompletionEffects,
  type ConstructionCompletionEffect,
} from "./constructionCompletionEffects";

export type ConstructionRenderSignature = "plot" | "foundation" | "frame" | "roof";

type DrawConstructionSiteInput = {
  readonly site: ConstructionSite;
  readonly schedule?: PalisadeConstructionSchedule;
  readonly zoom: number;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

export function constructionSiteRenderSignature(
  site: ConstructionSite,
): ConstructionRenderSignature {
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
  if (isPalisadeConstructionSite(input.site)) {
    drawPalisadeConstructionSite(context, {
      site: input.site,
      schedule: input.schedule ?? { kind: "active" },
      zoom: input.zoom,
    });
    return;
  }
  const anchor = siteAnchor(input.site);
  const footprint = constructionSiteFootprint(input.site);
  drawGroundingShadow(context, {
    centerX: anchor.x + footprint.width * 18,
    centerY: anchor.y + footprint.height * 6,
    height: 28,
    baseRadiusX: 20 + footprint.width * 15,
    baseRadiusY: 5 + footprint.height * 3,
  });
  drawSiteLabel(context, input.site, anchor, input.zoom);
  drawStage(context, {
    signature: constructionSiteRenderSignature(input.site),
    anchor,
    zoom: input.zoom,
  });
  drawBuilderMarker(context, anchor, input.zoom);
}

function drawStage(
  context: CanvasRenderingContext2D,
  input: {
    readonly signature: ConstructionRenderSignature;
    readonly anchor: Point;
    readonly zoom: number;
  },
): void {
  switch (input.signature) {
    case "plot":
      drawPlot(context, input.anchor, input.zoom);
      return;
    case "foundation":
      drawFoundation(context, input.anchor, input.zoom);
      return;
    case "frame":
      drawFrame(context, input.anchor, input.zoom);
      return;
    case "roof":
      drawRoof(context, input.anchor, input.zoom);
      return;
    default:
      assertNever(input.signature);
  }
}

function drawPlot(context: CanvasRenderingContext2D, anchor: Point, zoom: number): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.sage, 0.32);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 16), snapToPixel(anchor.y));
  context.lineTo(snapToPixel(anchor.x + 52), snapToPixel(anchor.y - 10));
  context.lineTo(snapToPixel(anchor.x + 72), snapToPixel(anchor.y + 5));
  context.lineTo(snapToPixel(anchor.x + 34), snapToPixel(anchor.y + 16));
  context.closePath();
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 56), snapToPixel(anchor.y + 4));
  context.lineTo(snapToPixel(anchor.x + 58), snapToPixel(anchor.y - 8));
  context.stroke();
}

function drawFoundation(context: CanvasRenderingContext2D, anchor: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.stone;
  context.beginPath();
  context.rect(snapToPixel(anchor.x + 1), snapToPixel(anchor.y - 4), 70, 12);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 14), snapToPixel(anchor.y - 8));
  context.lineTo(snapToPixel(anchor.x + 63), snapToPixel(anchor.y - 8));
  context.stroke();
}

function drawFrame(context: CanvasRenderingContext2D, anchor: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  for (const x of [anchor.x + 9, anchor.x + 54]) {
    context.beginPath();
    context.rect(snapToPixel(x), snapToPixel(anchor.y - 38), 10, 40);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
}

function drawRoof(context: CanvasRenderingContext2D, anchor: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.earth;
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 4), snapToPixel(anchor.y - 34));
  context.lineTo(snapToPixel(anchor.x + 37), snapToPixel(anchor.y - 58));
  context.lineTo(snapToPixel(anchor.x + 72), snapToPixel(anchor.y - 33));
  context.closePath();
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawBuilderMarker(context: CanvasRenderingContext2D, anchor: Point, zoom: number): void {
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

function assertNever(value: never): never {
  throw new Error(`Unhandled construction render variant: ${JSON.stringify(value)}`);
}
