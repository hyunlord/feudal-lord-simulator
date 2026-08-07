import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import {
  constructionOnSiteLabel,
  constructionSiteAnchor,
  constructionSiteFootprint,
  constructionStage,
  type ConstructionSite,
} from "../economy/construction";
import { tileToScreen } from "./iso";
import { applyInkOutline, drawGroundingShadow, snapToPixel, withAlpha } from "./style";

export type ConstructionRenderSignature = "plot" | "foundation" | "frame" | "roof";

export type ConstructionCompletionEffect = {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly ageMs: number;
};

type DrawConstructionSiteInput = {
  readonly site: ConstructionSite;
  readonly zoom: number;
};

type ConstructionCompletionInput = {
  readonly previous: readonly ConstructionSite[];
  readonly current: readonly ConstructionSite[];
  readonly nowMs: number;
  readonly startedAtMs: number;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

const COMPLETION_EFFECT_MS = 200;
let previousSites: readonly ConstructionSite[] = [];
let activeCompletionEffects: readonly (Omit<ConstructionCompletionEffect, "ageMs"> & {
  readonly startedAtMs: number;
})[] = [];

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

export function constructionCompletionEffects(
  input: ConstructionCompletionInput,
): readonly ConstructionCompletionEffect[] {
  const currentIds = new Set(input.current.map((site) => site.id));
  const ageMs = input.nowMs - input.startedAtMs;
  if (ageMs < 0 || ageMs >= COMPLETION_EFFECT_MS) return [];
  return input.previous
    .filter((site) => !currentIds.has(site.id))
    .map((site) => {
      const anchor = constructionSiteAnchor(site);
      return { id: site.id, tx: anchor.tx, ty: anchor.ty, ageMs };
    });
}

export function constructionCompletionEffectsForFrame(
  current: readonly ConstructionSite[],
  nowMs: number,
): readonly ConstructionCompletionEffect[] {
  const currentIds = new Set(current.map((site) => site.id));
  const newEffects = previousSites
    .filter((site) => !currentIds.has(site.id))
    .map((site) => {
      const anchor = constructionSiteAnchor(site);
      return { id: site.id, tx: anchor.tx, ty: anchor.ty, startedAtMs: nowMs };
    });
  previousSites = current;
  activeCompletionEffects = [...activeCompletionEffects, ...newEffects].filter(
    (effect) => nowMs - effect.startedAtMs < COMPLETION_EFFECT_MS,
  );
  return activeCompletionEffects.map((effect) => ({
    id: effect.id,
    tx: effect.tx,
    ty: effect.ty,
    ageMs: nowMs - effect.startedAtMs,
  }));
}

export function drawConstructionCompletionEffects(
  context: CanvasRenderingContext2D,
  input: {
    readonly effects: readonly ConstructionCompletionEffect[];
    readonly zoom: number;
  },
): void {
  for (const effect of input.effects) {
    const anchor = siteAnchor(effect);
    const progress = effect.ageMs / COMPLETION_EFFECT_MS;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, 0.32);
    context.beginPath();
    context.ellipse(
      snapToPixel(anchor.x + 36),
      snapToPixel(anchor.y + 3),
      snapToPixel(10 + progress * 14),
      snapToPixel(3 + progress * 5),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    applyInkOutline(context, input.zoom);
    context.stroke();
    context.restore();
  }
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

function siteAnchor(site: ConstructionSite | Pick<ConstructionCompletionEffect, "tx" | "ty">): Point {
  const anchor = "kind" in site ? constructionSiteAnchor(site) : site;
  const screen = tileToScreen(anchor.tx, anchor.ty);
  return { x: screen.sx, y: screen.sy };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled construction render variant: ${JSON.stringify(value)}`);
}
