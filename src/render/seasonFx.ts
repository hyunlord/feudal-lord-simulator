import type { GameState } from "../engine/engine.types";
import { hashNumbers } from "../world/boundary/boundaryGeometry";
import { groundBoundaryScene } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import { presentationPreference } from "./presentationPreferences";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { drawSeasonArt, seasonImage, seasonMeta, seasonOf } from "./seasonArt";
import { drawCroppedWorldSprite } from "./worldSprite";
import { SEMANTIC_PALETTE } from "../content/palette";
import { withAlpha } from "./style";

// INSTALL-15 season effects (Wave 15 fx sheets; the "season effects" setting turns both off):
//  - falling leaves over a few forest-edge places (every LEAF_EVERY-th fringe decal by its edge hash) during the first
//    quarter of autumn;
//  - snowfall over the whole view (screen space, one frame of the sheet's flakes repeated over the view, drifting down) during
//    the first quarter of winter: the first snow, the moment the roofs and the land turn white.
// Presentation only, pure in (the state's tick, the clock).
export const SEASON_FX_TICKS = 250;
const SEASON_TICKS = 1_000;
const LEAF_EVERY = 4;
const LEAF_SCALE = 0.75;
const LEAF_FRAME_MS = 160;
const SNOW_FALL_PX_PER_S = 36;
const SNOW_FRAME_MS = 400;
const SNOW_ALPHA = 1;
/** The sheet's flakes are pale white at alpha up to 125 of 255: drawn at their mean. */
const SNOW_FLAKE_ALPHA = 0.42;

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

// Cache (AGENTS rule 10): the flakes of each snowfall frame as one path of its visible pixels (alpha over 24 of 255),
// read once from the loaded sheet; key: the sheet image (one sheet). Reason: a full-view pattern blend per frame cost
// the DGX software raster ~11 ms a frame through the first snow (pop176 turn cell, p95 17.6 ms against trunk 7.2 ms);
// the sheet is sparse (~100 flake pixels per 128 x 128 frame), so filling only those pixels over the view's cells costs
// a few dozen small fills. Measured: docs/verification/install15/perf.md.
let snowFlakes: { readonly sheet: HTMLImageElement; readonly frames: readonly (Path2D | null)[] } | null = null;
const SNOW_ALPHA_FLOOR = 24;

function flakePaths(sheet: HTMLImageElement): readonly (Path2D | null)[] {
  const meta = seasonMeta("snowfall_sheet");
  const canvas = document.createElement("canvas");
  canvas.width = meta.width; canvas.height = meta.height;
  const paint = canvas.getContext("2d", { willReadFrequently: true });
  if (paint === null || typeof Path2D === "undefined") return [];
  drawCroppedWorldSprite(paint, sheet, { x: 0, y: 0, width: meta.width, height: meta.height }, { x: 0, y: 0, width: meta.width, height: meta.height }, false, true);
  const data = paint.getImageData(0, 0, meta.width, meta.height).data;
  return Array.from({ length: meta.frames.count }, (_, frame) => {
    const path = new Path2D();
    for (let y = 0; y < meta.frames.height; y += 1) for (let x = 0; x < meta.frames.width; x += 1) {
      if ((data[(y * meta.width + frame * meta.frames.width + x) * 4 + 3] ?? 0) > SNOW_ALPHA_FLOOR) path.rect(x, y, 1, 1);
    }
    return path;
  });
}

function drawSnowfall(context: CanvasRenderingContext2D, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  if (typeof document === "undefined" || typeof context.fill !== "function") return;
  const sheet = seasonImage("snowfall_sheet");
  if (sheet === null) return;
  if (snowFlakes === null || snowFlakes.sheet !== sheet) snowFlakes = { sheet, frames: flakePaths(sheet) };
  const meta = seasonMeta("snowfall_sheet");
  const path = snowFlakes.frames[Math.floor(nowMs / SNOW_FRAME_MS) % meta.frames.count] ?? null;
  if (path === null) return;
  const cell = meta.frames.width;
  const fall = nowMs / 1000 * SNOW_FALL_PX_PER_S;
  const offsetX = ((fall * 0.3) % cell) - cell; const offsetY = (fall % cell) - cell;
  context.save();
  context.globalAlpha = SNOW_ALPHA;
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.snow, SNOW_FLAKE_ALPHA);
  for (let y = offsetY; y < viewport.height; y += cell) for (let x = offsetX; x < viewport.width; x += cell) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, x * pixelRatio, y * pixelRatio);
    context.fill(path);
  }
  context.restore();
}
