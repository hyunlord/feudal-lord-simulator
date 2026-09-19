import { drawCroppedWorldSprite } from "./worldSprite";
import { constructionArtImage } from "./constructionArtAssets";
import {
  constructionSiteAnchor,
  type ConstructionSite,
} from "../economy/construction";
import { tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";
import { SEMANTIC_PALETTE } from "../content/palette";

export type ConstructionCompletionEffect = {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly ageMs: number;
  readonly confirmedCompletion?: boolean;
};

type ConstructionCompletionInput = {
  readonly previous: readonly ConstructionSite[];
  readonly current: readonly ConstructionSite[];
  readonly nowMs: number;
  readonly startedAtMs: number;
};

const COMPLETION_EFFECT_MS = 200;
type ActiveCompletionEffect = Omit<ConstructionCompletionEffect, "ageMs"> & {
  readonly startedAtMs: number;
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
      return { id: site.id, tx: anchor.tx, ty: anchor.ty, startedAtMs: nowMs, ...(completedIds === null ? {} : { confirmedCompletion: true }) };
    });
  tracker.previousSites = current;
  tracker.activeCompletionEffects = [...tracker.activeCompletionEffects, ...newEffects].filter(
    (effect) => nowMs - effect.startedAtMs < COMPLETION_EFFECT_MS,
  );
  return tracker.activeCompletionEffects.map((effect) => ({
    id: effect.id,
    tx: effect.tx,
    ty: effect.ty,
    ageMs: nowMs - effect.startedAtMs,
    ...(effect.confirmedCompletion === undefined ? {} : { confirmedCompletion: effect.confirmedCompletion }),
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
    const screen = tileToScreen(effect.tx, effect.ty);
    const progress = effect.ageMs / COMPLETION_EFFECT_MS;
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
