import type { GameState } from "../engine/engine.types";
import { hashNumbers } from "../world/boundary/boundaryGeometry";
import { groundBoundaryScene } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import { presentationPreference } from "./presentationPreferences";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { drawSeasonArt, seasonImage, seasonMeta, seasonOf } from "./seasonArt";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-15 season effects (Wave 15 fx sheets; the "season effects" setting turns both off):
//  - falling leaves over a few forest-edge places (every LEAF_EVERY-th fringe decal by its edge hash) during the first
//    quarter of autumn;
//  - snowfall over the whole view (screen space, one frame of the sheet as a repeating pattern, drifting down) during
//    the first quarter of winter: the first snow, the moment the roofs and the land turn white.
// Presentation only, pure in (the state's tick, the clock).
export const SEASON_FX_TICKS = 250;
const SEASON_TICKS = 1_000;
const LEAF_EVERY = 4;
const LEAF_SCALE = 0.75;
const LEAF_FRAME_MS = 160;
const SNOW_FALL_PX_PER_S = 36;
const SNOW_FRAME_MS = 400;
const SNOW_ALPHA = 1; // the sheet is already faint (alpha at most 125 of 255)

export function seasonFxAt(state: Pick<GameState, "tick" | "scenarioId">): "leaves" | "snow" | null {
  if (state.tick % SEASON_TICKS >= SEASON_FX_TICKS) return null;
  const season = seasonOf(state);
  return season === 2 ? "leaves" : season === 3 ? "snow" : null;
}

export function drawSeasonFx(context: CanvasRenderingContext2D, state: GameState, viewport: { readonly width: number; readonly height: number },
  zoom: number, nowMs: number): void {
  const fx = seasonFxAt(state);
  if (fx === null || !presentationPreference("seasonFx")) return;
  if (fx === "leaves") {
    if (!boundaryV2Enabled()) return; // the fringe decals are the curved ground's (RENDER_BOUNDARY_V2)
    const forest = groundBoundaryScene(state).forest;
    for (const decals of forest.decals) for (const decal of decals) {
      const hash = hashNumbers([state.seed, decal.edgeKey, 15_301]);
      if (hash % LEAF_EVERY !== 0) continue;
      const at = tileToScreen(decal.anchor.x, decal.anchor.y);
      drawSeasonArt(context, "falling_leaves_sheet", at.sx, at.sy - 20, LEAF_SCALE, Math.floor(nowMs / LEAF_FRAME_MS) + hash);
    }
    return;
  }
  const transform = typeof context.getTransform === "function" ? context.getTransform() : null;
  drawSnowfall(context, viewport, transform === null ? 1 : transform.a / zoom, nowMs);
}

// Cache (AGENTS rule 10): one pattern per snowfall frame, keyed by the target context (a new canvas makes new ones) and
// built from the sheet once it has loaded; reason: slicing the frame and createPattern at 60 fps would allocate four
// canvases a frame; measured: four 128 x 128 canvases, 256 KB.
let snowPatterns: { readonly context: CanvasRenderingContext2D; readonly patterns: readonly (CanvasPattern | null)[] } | null = null;

function drawSnowfall(context: CanvasRenderingContext2D, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  if (typeof context.createPattern !== "function" || typeof DOMMatrix === "undefined" || typeof document === "undefined") return;
  const sheet = seasonImage("snowfall_sheet");
  if (sheet === null) return;
  const meta = seasonMeta("snowfall_sheet");
  if (snowPatterns === null || snowPatterns.context !== context) {
    const patterns = Array.from({ length: meta.frames.count }, (_, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = meta.frames.width; canvas.height = meta.frames.height;
      const paint = canvas.getContext("2d");
      if (paint === null) return null;
      drawCroppedWorldSprite(paint, sheet, { x: index * meta.frames.width, y: 0, width: meta.frames.width, height: meta.frames.height },
        { x: 0, y: 0, width: meta.frames.width, height: meta.frames.height }, false, true);
      return context.createPattern(canvas, "repeat");
    });
    snowPatterns = { context, patterns };
  }
  const pattern = snowPatterns.patterns[Math.floor(nowMs / SNOW_FRAME_MS) % meta.frames.count] ?? null;
  if (pattern === null) return;
  const fall = nowMs / 1000 * SNOW_FALL_PX_PER_S;
  pattern.setTransform(new DOMMatrix().translate((fall * 0.3) % meta.frames.width, fall % meta.frames.height));
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.globalAlpha = SNOW_ALPHA;
  context.fillStyle = pattern;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.restore();
}
