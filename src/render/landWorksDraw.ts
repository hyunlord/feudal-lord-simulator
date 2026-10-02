import type { Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";
import { isFordRoad } from "../world/bridges";
import { tileToScreen } from "./iso";
import { chunkWorks } from "./landWorksIndex";
import type { DrainEdge, WorkPlan } from "./landWorksModel";
import type { SeasonIndex } from "./seasonArt";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";
import { doneEdgeKey, drawWorksArt, fordKey, stageKey, WORKS_SCALE, worksArt, worksSeason, type WorksSeason } from "./wave34Art";
import type { Wave34WorksKey } from "./wave34WorksManifest.generated";

// LAND-UI (Wave 34): the land works baked into a ground chunk, right after the shoreline and the winter ice rim
// (drawTerrainBoundaryV2 drawGroundChunk): fords over the water, the works' stage art, the drained ground's edge, then
// the works props. The chunk key carries landWorksChunkToken (landWorksIndex.ts), so a stage change, a dig starting or
// stopping, a finished patch or the art loading re-rasters the chunks they reach.
//  - Ford sheet: pivot (256, 128) on the crossing's centre; its water section spans exactly `width` cells along the
//    axis (fords-QA anchor points), the ramps lie on the banks beyond. A single-cell ford takes the Wave 41 w1 sheet
//    (NAT-4; LU-D4 drew the w2 sheet centred until it came).
//  - Stages 1 and 2 are 128 x 64 tiles on the (64, 32) / (-64, 32) lattice. They are composited at source size on one
//    canvas per work, then drawn once scaled (records/QA: tiles scaled one by one show alpha seams).
//  - Stage 3: one region sheet on the works' origin (FIX-13; a pre-v44 work: the box centre), clipped to the union of
//    the work's cell diamonds (LU-D5).
//  - The finished drain strip (512 x 64, centre line y = 32) is laid on each edge by the shear that tilts only the
//    ground axis (as the Wave 28 strips, countrysideArt.ts); one edge takes 64 source px, eight edges one repeat.

/** The chunk key part (the hook's helper): the works signature and art readiness of the chunk. */
export { landWorksChunkToken, landWorksWaterCells } from "./landWorksIndex";

const TILE_PX = 128;
const HALF_PX = 64;

export function drawLandWorksInChunk(context: CanvasRenderingContext2D, state: GameState, plan: { readonly cx: number; readonly cy: number }, season: SeasonIndex): void {
  const works = chunkWorks(state, plan.cx, plan.cy);
  if (works.signature === "") return;
  const file = worksSeason(season);
  const { width } = state;
  for (const group of works.fords) {
    const at = tileToScreen(group.centre.tx, group.centre.ty);
    drawWorksArt(context, fordKey(group.width, group.axis, file), at.sx, at.sy, WORKS_SCALE);
  }
  for (const work of works.works) {
    if (work.stage === 3) drawRegion(context, work, width, file);
    else drawStageTiles(context, work, width, file);
  }
  if (works.edges.length > 0) drawDoneEdges(context, works.edges, file);
  const props: { readonly key: Wave34WorksKey; readonly tx: number; readonly ty: number }[] = [];
  for (const work of works.works) {
    if (work.digging && work.bank !== null) {
      const tx = work.bank % width, ty = Math.floor(work.bank / width);
      props.push({ key: "drain_earth_cart", tx, ty }, { key: "drain_soil_heap", tx: tx + 0.35, ty: ty - 0.3 });
    }
    if (work.stage === 2 && work.ditches.length > 0) {
      const end = Math.max(...work.ditches.filter(cell => Math.floor(cell / width) === Math.floor(work.ditches[0]! / width)));
      props.push({ key: "drain_sluice", tx: end % width + 0.5, ty: Math.floor(end / width) });
    }
  }
  for (const bridge of works.bridges) props.push({ key: "drain_plank_bridge", tx: bridge.tx, ty: bridge.ty - 0.5 });
  props.sort((a, b) => a.tx + a.ty - (b.tx + b.ty) || a.tx - b.tx);
  for (const prop of props) {
    const at = tileToScreen(prop.tx, prop.ty);
    drawWorksArt(context, prop.key, at.sx, at.sy, WORKS_SCALE);
  }
}

function traceCells(context: CanvasRenderingContext2D, cells: readonly number[], width: number): void {
  context.beginPath();
  for (const cell of cells) {
    const tx = cell % width, ty = Math.floor(cell / width);
    const top = tileToScreen(tx - 0.5, ty - 0.5), right = tileToScreen(tx + 0.5, ty - 0.5);
    const bottom = tileToScreen(tx + 0.5, ty + 0.5), left = tileToScreen(tx - 0.5, ty + 0.5);
    context.moveTo(top.sx, top.sy); context.lineTo(right.sx, right.sy); context.lineTo(bottom.sx, bottom.sy); context.lineTo(left.sx, left.sy);
    context.closePath();
  }
}

function drawRegion(context: CanvasRenderingContext2D, work: WorkPlan, width: number, file: WorksSeason): void {
  const centre = tileToScreen(work.centre.tx, work.centre.ty);
  context.save();
  traceCells(context, work.cells, width);
  context.clip();
  drawWorksArt(context, stageKey(3, work.region, file), centre.sx, centre.sy, WORKS_SCALE);
  context.restore();
}

// Composites of stages 1 and 2. Cache (AGENTS rule 10): (a) key = work id, stage, season file and the work's cells;
// (b) nothing else enters (the tiles are drawn only once both loaded; until then nothing is cached and the chunk key's
// readiness bit is 0); (c) the chunk re-rasters at every zoom bucket, season and neighbour change, and a 5 x 5 work
// is 34 tile blits. Bound: the last four composites (two works open at most, x a season turn), at most 0.8 MB each.
const composites = new Map<string, CanvasImageSource & { width: number; height: number }>();
const COMPOSITES_KEPT = 4;

function drawStageTiles(context: CanvasRenderingContext2D, work: WorkPlan, width: number, file: WorksSeason): void {
  const key = `${work.id}|${work.stage}|${file}|${work.cells.join(",")}`;
  let canvas = composites.get(key) ?? null;
  if (canvas === null) {
    canvas = composeStage(work, width, file);
    if (canvas === null) return;
    composites.set(key, canvas);
    while (composites.size > COMPOSITES_KEPT) composites.delete(composites.keys().next().value!);
  }
  const rows = work.box.maxTy - work.box.minTy + 1;
  const origin = tileToScreen(work.box.minTx, work.box.minTy);
  drawCroppedWorldSprite(context, canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height },
    { x: origin.sx - rows * HALF_PX * WORKS_SCALE, y: origin.sy - 32 * WORKS_SCALE, width: canvas.width * WORKS_SCALE, height: canvas.height * WORKS_SCALE }, false, true);
}

/** The stage's tiles on one canvas at source size: cell (dx, dy) of the box centred at ((dx - dy + rows) * 64, (dx + dy) * 32 + 32). */
function composeStage(work: WorkPlan, width: number, file: WorksSeason): (CanvasImageSource & { width: number; height: number }) | null {
  const image = worksArt(stageKey(work.stage, work.region, file));
  if (image === null) return null;
  const columns = work.box.maxTx - work.box.minTx + 1, rows = work.box.maxTy - work.box.minTy + 1;
  const canvas = createTintCanvas((columns + rows) * HALF_PX, (columns + rows) * 32);
  const paint = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (canvas === null || paint === null || paint === undefined) return null;
  // Stage 1: the perimeter's stake lines (the tile as painted runs along ty; mirrored, along tx). Stage 2: the ditch
  // rows along tx, so the tile is mirrored (the v3 proof's flip, to meet the stage-3 sheet's ditches).
  const tiles = work.stage === 1 ? work.stakes : work.ditches.map(cell => ({ cell, along: "tx" as const }));
  for (const { cell, along } of tiles) {
    const dx = cell % width - work.box.minTx, dy = Math.floor(cell / width) - work.box.minTy;
    const cx = (dx - dy + rows) * HALF_PX, cy = (dx + dy) * 32 + 32;
    paint.save();
    paint.translate(cx, cy);
    if (along === "tx") paint.scale(-1, 1);
    drawCroppedWorldSprite(paint, image, { x: 0, y: 0, width: TILE_PX, height: 64 }, { x: -HALF_PX, y: -32, width: TILE_PX, height: 64 }, false, false);
    paint.restore();
  }
  return canvas;
}

function drawDoneEdges(context: CanvasRenderingContext2D, edges: readonly DrainEdge[], file: WorksSeason): void {
  const image = worksArt(doneEdgeKey(file));
  if (image === null) return;
  const s = WORKS_SCALE;
  for (const edge of edges) {
    const alongTx = edge.side === "n" || edge.side === "s";
    // The edge's screen-left end and slope: along tx it runs down-right (+0.5), along ty up-right (-0.5).
    const left = alongTx ? tileToScreen(edge.tx - 0.5, edge.ty + (edge.side === "n" ? -0.5 : 0.5))
      : tileToScreen(edge.tx + (edge.side === "e" ? 0.5 : -0.5), edge.ty + 0.5);
    const slope = alongTx ? 0.5 : -0.5;
    const step = alongTx ? edge.tx : -edge.ty;
    const from = (((step % 8) + 8) % 8) * HALF_PX;
    context.save();
    context.transform(s, slope * s, 0, s, left.sx, left.sy - 32 * s);
    drawCroppedWorldSprite(context, image, { x: from, y: 0, width: HALF_PX, height: 64 }, { x: 0, y: 0, width: HALF_PX, height: 64 }, false, true);
    context.restore();
  }
}

/** FD-2: a wading walker's splash, live in the object pass under the walker (a and b alternate every 240 ms). */
export function drawFordSplash(context: CanvasRenderingContext2D, state: GameState, walker: Walker, nowMs: number): void {
  const { tx, ty } = walker.position;
  if (state.river === undefined || state.river.fords.length === 0 || !isFordRoad(state, { tx: Math.round(tx), ty: Math.round(ty) })) return;
  const at = tileToScreen(tx, ty);
  const phase = Math.floor(nowMs / 240) + walker.id.length;
  drawWorksArt(context, phase % 2 === 0 ? "ford_splash_a" : "ford_splash_b", at.sx, at.sy + 2, WORKS_SCALE);
}
