import { drawCroppedWorldSprite } from "./worldSprite";
import { constructionArtImage } from "./constructionArtAssets";
import {
  constructionSiteAnchor,
  type ConstructionSite,
} from "../economy/construction";
import { tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { constructionSiteFootprint } from "../economy/construction";
import { drawConstructionArt } from "./constructionArtAssets";
import { FAST_PRESENTATION_SPEED, presentationSpeed } from "./presentationSpeed";
import { visibilityArt } from "./visibilityArtManifest";
import { constructionSiteLabelAnchor } from "./constructionSiteLabelLayout";
import { drawUiIcon } from "../ui/uiArt";

export type ConstructionCompletionEffect = {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly ageMs: number;
  readonly confirmedCompletion?: boolean;
  /** F0-V: the finished site (its roof-stage art fades out over the new building). */
  readonly site?: ConstructionSite;
};

type ConstructionCompletionInput = {
  readonly previous: readonly ConstructionSite[];
  readonly current: readonly ConstructionSite[];
  readonly nowMs: number;
  readonly startedAtMs: number;
};

const COMPLETION_EFFECT_MS = 200;
/**
 * F0-V completion sequence (visibility design 2절 완공, 1.2 s): the last hammer (sparks, 0-350 ms) and the roof-stage
 * art fading out over the new building (0-400 ms), the completion burst (350-950 ms), the plaque's filled bar with the
 * check (600-1,200 ms). At 5x only the dust (and the sound) of the first 400 ms.
 */
export const COMPLETION_SEQUENCE_MS = 1_200;
const FAST_COMPLETION_MS = 400;
type ActiveCompletionEffect = Omit<ConstructionCompletionEffect, "ageMs"> & {
  readonly startedAtMs: number;
  readonly site?: ConstructionSite;
};

export type ConstructionCompletionTracker = {
  previousSites: readonly ConstructionSite[];
  activeCompletionEffects: readonly ActiveCompletionEffect[];
};

export function createConstructionCompletionTracker(): ConstructionCompletionTracker {
  return { previousSites: [], activeCompletionEffects: [] };
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
  tracker: ConstructionCompletionTracker,
  current: readonly ConstructionSite[],
  nowMs: number,
  completedBuildingIds?: readonly string[],
): readonly ConstructionCompletionEffect[] {
  const currentIds = new Set(current.map((site) => site.id));
  const completedIds = completedBuildingIds === undefined ? null : new Set(completedBuildingIds);
  const newEffects = tracker.previousSites
    .filter((site) => !currentIds.has(site.id) && (completedIds === null || completedIds.has(site.id)))
    .map((site) => {
      const anchor = constructionSiteAnchor(site);
      return { id: site.id, tx: anchor.tx, ty: anchor.ty, startedAtMs: nowMs, ...(completedIds === null ? {} : { confirmedCompletion: true, site }) };
    });
  tracker.previousSites = current;
  const duration = presentationSpeed() >= FAST_PRESENTATION_SPEED ? FAST_COMPLETION_MS : COMPLETION_SEQUENCE_MS;
  tracker.activeCompletionEffects = [...tracker.activeCompletionEffects, ...newEffects].filter(
    (effect) => nowMs - effect.startedAtMs < (effect.confirmedCompletion === true ? duration : COMPLETION_EFFECT_MS),
  );
  return tracker.activeCompletionEffects.map((effect) => ({
    id: effect.id,
    tx: effect.tx,
    ty: effect.ty,
    ageMs: nowMs - effect.startedAtMs,
    ...(effect.confirmedCompletion === undefined ? {} : { confirmedCompletion: effect.confirmedCompletion }),
    ...(effect.site === undefined ? {} : { site: effect.site }),
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
    if (effect.confirmedCompletion === true && effect.site !== undefined && presentationSpeed() < FAST_PRESENTATION_SPEED) {
      drawCompletionSequence(context, effect, effect.site, input.zoom);
    }
    const screen = tileToScreen(effect.tx, effect.ty);
    const dustMs = effect.confirmedCompletion === true ? FAST_COMPLETION_MS : COMPLETION_EFFECT_MS;
    if (effect.ageMs >= dustMs) continue;
    const progress = effect.ageMs / dustMs;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    const dust = effect.confirmedCompletion ? constructionArtImage('dust') : null;
    if (dust !== null) {
      const frame = Math.min(3, Math.floor(progress * 4));
      context.imageSmoothingEnabled = true;
      drawCroppedWorldSprite(context, dust, { x: frame * 443.5, y: 0, width: 443.5, height: 887 },
        { x: screen.sx - 16, y: screen.sy - 47, width: 32, height: 64 }, false, true);
      context.restore();
      continue;
    }
    context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, 0.32);
    context.beginPath();
    context.ellipse(
      snapToPixel(screen.sx + 36),
      snapToPixel(screen.sy + 3),
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

/** The 1.2 s completion sequence (above), drawn in the overhang pass over the new building. */
function drawCompletionSequence(context: CanvasRenderingContext2D, effect: ConstructionCompletionEffect, site: ConstructionSite, zoom: number): void {
  const t = effect.ageMs;
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const span = (footprint.width + footprint.height) * 27;
  const anchor = constructionSiteLabelAnchor(site);
  context.save();
  if (t < 400) { context.globalAlpha = 1 - t / 400; drawConstructionArt(context, site, "roof"); }
  const sparks = visibilityArt("hammer_sparks");
  if (sparks !== null && t < 350) {
    context.globalAlpha = 1 - t / 350;
    const size = 14 + t / 40;
    drawCroppedWorldSprite(context, sparks, { x: 0, y: 0, width: 32, height: 32 }, { x: anchor.x - size / 2, y: anchor.topY - size / 2 + 6, width: size, height: size }, false, true);
  }
  const burst = visibilityArt("completion_burst");
  if (burst !== null && t >= 350 && t < 950) {
    const frame = Math.min(2, Math.floor((t - 350) / 200));
    context.globalAlpha = t < 800 ? 1 : 1 - (t - 800) / 150;
    const width = span * 1.3;
    drawCroppedWorldSprite(context, burst, { x: frame * 128, y: 0, width: 128, height: 128 }, { x: center.sx - width / 2, y: center.sy - width * 0.9, width, height: width }, false, true);
  }
  if (t >= 600) {
    const scale = 1 / Math.max(zoom, 0.5);
    context.globalAlpha = t < 1_000 ? 1 : 1 - (t - 1_000) / 200;
    const width = 72 * scale, height = 10 * scale;
    const x = anchor.x - width / 2, y = anchor.topY - 10 * scale - height;
    context.fillStyle = SEMANTIC_PALETTE.vellum;
    context.fillRect(snapToPixel(x), snapToPixel(y), snapToPixel(width), snapToPixel(height));
    context.fillStyle = PALETTE.gold;
    context.fillRect(snapToPixel(x + 4 * scale), snapToPixel(y + 3 * scale), snapToPixel(width - 8 * scale), snapToPixel(5 * scale));
    applyInkOutline(context, zoom);
    context.strokeRect(snapToPixel(x), snapToPixel(y), snapToPixel(width), snapToPixel(height));
    drawUiIcon(context, "prediction", "ok", x + width + 10 * scale, y + height / 2, 20 * scale);
  }
  context.restore();
}
