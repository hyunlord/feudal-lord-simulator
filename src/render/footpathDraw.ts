import { ART_REGISTRY, selectLandArt } from './art/wave42Registry';
import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { chunkFootpaths, type FootpathPiece, type Port } from "./footpathModel";
import { tileToScreen } from "./iso";
import { stageSeason, type StageSeason } from "./landStageModel";
import type { SeasonIndex } from "./seasonArt";
import { drawStageArt, stageArt, stageArtReady, stageKey, STAGE_SCALE } from "./wave42StageArt";
import type { Wave42StageKey } from "./wave42StageManifest.generated";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";

// NAT-5 (Wave 42): the footpaths baked into a ground chunk (drawTerrainBoundaryV2 drawGroundChunk, after the zones and
// fields, under the yards, aprons and road ribbons). Pieces and their rule table: footpathModel.ts. The chunk key
// carries footpathChunkToken, so a footpath made or grown over (once a year), or a road or building beside one,
// re-rasters only the chunks whose pieces changed, and the art loading re-rasters the chunks with paths once.
//  - Strips (512 x 64 unwrapped UV, centre line v = 32): along each line of cells the halves of every piece are merged
//    into runs (one cell = 128 UV px; the texture continues from cell to cell by its world position, repeating every
//    512, so a run never restarts the pattern). A run ends 8 UV px past its last port (under the join, the road or the
//    building there, as Astra's proof joins them) or, at an end, fades out over TAIL_UV px past the cell centre. Each run
//    is composed at source size on a scratch canvas (the 512 repeats at whole pixels, the tail faded column by column)
//    and drawn once by the strip's mapping: NE u -> (0.5, -0.25), v -> (0.5, 0.25); NW u -> (0.5, 0.25), v -> (-0.5,
//    0.25), at 0.5 world px per source px — a positive determinant, never a reflection.
//  - Joins (128 x 128): pivot (64, 80) on the cell centre, drawn over the strips.

const CELL_UV = 128;
const HALF_UV = 64;
const STRIP_UV = 512;
const STRIP_V = 64;
const OVERLAP_UV = 8;
const TAIL_UV = 40;
const DOT_UV = 16;
const PATH_KEYS: readonly Wave42StageKey[] = ART_REGISTRY.entries('land-stage')
  .filter(entry => entry.kind === 'land-stage' && entry.family === 'path').map(entry => entry.id);
let pathArtReady = false;

/**
 * The chunk key part for the footpaths (drawTerrainBoundaryV2 groundReadiness): "" for a chunk without any, else the
 * readiness of the path pictures (both seasons, so a staged raster of the next season is keyed too; asking starts their
 * loads) and the signature of the chunk's pieces.
 */
export function footpathChunkToken(state: GameState, plan: { readonly cx: number; readonly cy: number }): string {
  const { signature } = chunkFootpaths(state, plan.cx, plan.cy);
  if (signature === "") return "";
  if (!pathArtReady) pathArtReady = stageArtReady(PATH_KEYS);
  return `:fp${pathArtReady ? 1 : 0}${signature}`;
}

type Axis = "ne" | "nw";
/** A run along one line of cells: the NE axis at a fixed tx (u grows to -ty), the NW axis at a fixed ty (u grows to +tx). */
export type FootpathRun = { readonly axis: Axis; readonly line: number; readonly from: number; readonly to: number;
  readonly fadeFrom: boolean; readonly fadeTo: boolean };

const AXIS: Readonly<Record<Port, Axis>> = { NE: "ne", SW: "ne", SE: "nw", NW: "nw" };
/** The cell centre's u on its line of the axis. */
const centreU = (axis: Axis, tx: number, ty: number): number => (axis === "ne" ? -ty : tx) * CELL_UV + HALF_UV;

/** The strip runs of a chunk's pieces: each piece's halves, merged along their lines where they touch. */
export function footpathRuns(pieces: readonly FootpathPiece[]): readonly FootpathRun[] {
  const halves: FootpathRun[] = [];
  for (const piece of pieces) {
    const end = piece.rule.shape === "end";
    if (piece.rule.shape === "dot") {
      const centre = centreU("ne", piece.tx, piece.ty);
      halves.push({ axis: "ne", line: piece.tx, from: centre - DOT_UV, to: centre + DOT_UV, fadeFrom: true, fadeTo: true });
    }
    for (const port of piece.rule.halves) {
      const axis = AXIS[port];
      const centre = centreU(axis, piece.tx, piece.ty);
      const out = port === "NE" || port === "SE";
      halves.push({ axis, line: axis === "ne" ? piece.tx : piece.ty, from: out ? centre : centre - HALF_UV, to: out ? centre + HALF_UV : centre,
        fadeFrom: end && out, fadeTo: end && !out });
    }
  }
  halves.sort((a, b) => a.axis.localeCompare(b.axis) || a.line - b.line || a.from - b.from || a.to - b.to);
  const runs: FootpathRun[] = [];
  for (const half of halves) {
    const previous = runs.at(-1);
    if (previous !== undefined && previous.axis === half.axis && previous.line === half.line && half.from <= previous.to) {
      const longer = half.to > previous.to;
      runs[runs.length - 1] = { ...previous, to: Math.max(previous.to, half.to), fadeTo: longer ? half.fadeTo : previous.fadeTo };
    } else runs.push(half);
  }
  return runs;
}

export function drawFootpathsInChunk(context: CanvasRenderingContext2D, state: GameState, plan: { readonly cx: number; readonly cy: number }, season: SeasonIndex): void {
  const { pieces } = chunkFootpaths(state, plan.cx, plan.cy);
  if (pieces.length === 0) return;
  const file = stageSeason(season);
  for (const run of footpathRuns(pieces)) drawRun(context, run, file);
  const joins = pieces.filter(piece => piece.rule.connector !== null).sort((a, b) => a.tx + a.ty - (b.tx + b.ty) || a.tx - b.tx);
  for (const piece of joins) {
    const at = tileToScreen(piece.tx, piece.ty);
    if (piece.rule.connector !== null) drawStageArt(context, stageKey(piece.rule.connector, file), at.sx, at.sy, STAGE_SCALE);
  }
}

/**
 * The strip's mapping for a run whose scratch canvas starts at u = `from`: source (x, v) -> world (a x + c v + e,
 * b x + d v + f), the line's point at u = from + x plus (v - 32) along the strip's across axis, 0.5 world px per px.
 */
export function stripTransform(axis: Axis, line: number, from: number): readonly [number, number, number, number, number, number] {
  const s = STAGE_SCALE;
  const [a, b, c, d] = axis === "ne" ? [0.5 * s, -0.25 * s, 0.5 * s, 0.25 * s] : [0.5 * s, 0.25 * s, -0.5 * s, 0.25 * s];
  const origin = axis === "ne" ? tileToScreen(line, 0.5 - from / CELL_UV) : tileToScreen(from / CELL_UV - 0.5, line);
  return [a, b, c, d, origin.sx - (STRIP_V / 2) * c, origin.sy - (STRIP_V / 2) * d];
}

let scratch: (OffscreenCanvas | HTMLCanvasElement) | null = null;

function drawRun(context: CanvasRenderingContext2D, run: FootpathRun, file: StageSeason): void {
  const image = stageArt(selectLandArt('path-strip', { family: 'path', stage: run.axis, season: file }).id);
  if (image === null) return;
  const from = run.from - (run.fadeFrom ? TAIL_UV : OVERLAP_UV);
  const to = run.to + (run.fadeTo ? TAIL_UV : OVERLAP_UV);
  const length = to - from;
  if (scratch === null || scratch.width < length) scratch = createTintCanvas(Math.max(length, 2 * STRIP_UV), STRIP_V);
  const paint = scratch?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (scratch === null || paint === null || paint === undefined) return;
  paint.clearRect(0, 0, scratch.width, STRIP_V);
  // The 512 repeats at whole source pixels: copy k starts where u = 512 k.
  for (let start = Math.floor(from / STRIP_UV) * STRIP_UV; start < to; start += STRIP_UV) {
    drawCroppedWorldSprite(paint, image, { x: 0, y: 0, width: STRIP_UV, height: STRIP_V }, { x: start - from, y: 0, width: STRIP_UV, height: STRIP_V }, false, false);
  }
  paint.save();
  paint.globalCompositeOperation = "destination-out";
  paint.fillStyle = SEMANTIC_PALETTE.ink;
  for (let step = 0; step < TAIL_UV; step += 1) {
    paint.globalAlpha = (step + 0.5) / TAIL_UV;
    if (run.fadeTo) paint.fillRect(length - TAIL_UV + step, 0, 1, STRIP_V);
    if (run.fadeFrom) paint.fillRect(TAIL_UV - 1 - step, 0, 1, STRIP_V);
  }
  paint.restore();
  paint.clearRect(length, 0, scratch.width - length, STRIP_V);
  const [a, b, c, d, e, f] = stripTransform(run.axis, run.line, from);
  context.save();
  context.transform(a, b, c, d, e, f);
  drawCroppedWorldSprite(context, scratch, { x: 0, y: 0, width: length, height: STRIP_V }, { x: 0, y: 0, width: length, height: STRIP_V }, false, true);
  context.restore();
}
