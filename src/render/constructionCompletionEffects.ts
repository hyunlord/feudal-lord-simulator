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
};

type ConstructionCompletionInput = {
  readonly previous: readonly ConstructionSite[];
  readonly current: readonly ConstructionSite[];
  readonly nowMs: number;
  readonly startedAtMs: number;
};

const COMPLETION_EFFECT_MS = 200;
let previousSites: readonly ConstructionSite[] = [];
let activeCompletionEffects: readonly (Omit<ConstructionCompletionEffect, "ageMs"> & {
  readonly startedAtMs: number;
})[] = [];

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
    const screen = tileToScreen(effect.tx, effect.ty);
    const progress = effect.ageMs / COMPLETION_EFFECT_MS;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
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
