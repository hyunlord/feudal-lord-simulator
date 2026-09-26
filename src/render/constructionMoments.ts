import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { tileToScreen } from "./iso";
import { visibilityArt } from "./visibilityArtManifest";
import { drawCroppedWorldSprite } from "./worldSprite";
import { constructionMaterialShare, constructionStageIndex, constructionWorkProgress } from "./constructionVisibility";

// F0-V construction moments (visibility design 2절): a stage change (25 / 55 / 85 %) fades the previous stage's art
// out over CROSSFADE_MS and puffs dust for DUST_MS; a new site (placed this session) puffs dust once; a delivery (the
// delivered share rising) is remembered for the unloading sound. Presentation memory, not state and not a cache: keyed
// by site id (never reused), it only records when the site's own stage / share last changed in wall time; a site that
// is gone is forgotten on the next observation. At most the live sites are held.
export const CROSSFADE_MS = 200;
export const DUST_MS = 450;

type Memory = { stage: 0 | 1 | 2 | 3; previousStage: 0 | 1 | 2 | 3 | null; stageAtMs: number; share: number; shareAtMs: number; placedAtMs: number | null };
const memory = new Map<string, Memory>();
let lastLiveKey = "";

export type ConstructionMoment = {
  readonly previousStage: 0 | 1 | 2 | 3 | null;
  readonly stageAgeMs: number;
  readonly placedAgeMs: number | null;
  readonly deliveryAgeMs: number | null;
};

/**
 * The site's moment at `nowMs`. `fresh`: the site was placed moments ago (its start tick is within a few ticks of the
 * state's), so its first sighting is a placement, not a loaded save.
 */
export function constructionMoment(site: ConstructionSite, nowMs: number, fresh: boolean, presentationProgress?: number): ConstructionMoment {
  const stage = constructionStageIndex(constructionWorkProgress(site, presentationProgress));
  const share = constructionMaterialShare(site);
  let entry = memory.get(site.id);
  if (entry === undefined) {
    entry = { stage, previousStage: null, stageAtMs: -Infinity, share, shareAtMs: -Infinity, placedAtMs: fresh ? nowMs : null };
    memory.set(site.id, entry);
  }
  if (stage !== entry.stage) { entry.previousStage = entry.stage; entry.stage = stage; entry.stageAtMs = nowMs; }
  if (share > entry.share) entry.shareAtMs = nowMs;
  entry.share = share;
  return {
    previousStage: nowMs - entry.stageAtMs < DUST_MS ? entry.previousStage : null,
    stageAgeMs: nowMs - entry.stageAtMs,
    placedAgeMs: entry.placedAtMs === null ? null : nowMs - entry.placedAtMs,
    deliveryAgeMs: Number.isFinite(entry.shareAtMs) ? nowMs - entry.shareAtMs : null,
  };
}

/** Drops the memory of sites that are gone (called once per frame with the live ids). */
export function forgetGoneConstructionSites(sites: readonly ConstructionSite[]): void {
  const key = sites.map(site => site.id).join(",");
  if (key === lastLiveKey) return;
  lastLiveKey = key;
  const live = new Set(sites.map(site => site.id));
  for (const id of memory.keys()) if (!live.has(id)) memory.delete(id);
}

/** Dust over the site for DUST_MS after it was placed or changed stage (the Wave 6 dust puff, rising and fading). */
export function drawSiteDust(context: CanvasRenderingContext2D, site: ConstructionSite, moment: ReturnType<typeof constructionMoment>): void {
  const age = Math.min(moment.previousStage === null ? Infinity : moment.stageAgeMs, moment.placedAgeMs ?? Infinity);
  if (!(age < DUST_MS)) return;
  const image = visibilityArt("dust_puff");
  if (image === null) return;
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const t = age / DUST_MS;
  const size = (footprint.width + footprint.height) * 16 * (0.8 + 0.5 * t);
  context.save();
  context.globalAlpha *= 1 - t;
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 32, height: 32 },
    { x: center.sx - size / 2, y: center.sy - size * 0.85 - 6 * t, width: size, height: size }, false, true);
  context.restore();
}
