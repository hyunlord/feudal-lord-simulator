import type { WeatherKind } from "../content/eventConfig";
import type { GameState } from "../engine/engine.types";
import type { Shoreline, ShoreLoop } from "../world/boundary/shoreline";
import type { Tile } from "../world/world.types";
import { drawMirrorableSprite } from "./drawShoreline";
import type { GroundChunkPlan } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import type { TileRange } from "./renderVisibility";
import type { SeasonIndex } from "./seasonArt";
import { waterArtReady, waterFrameCanvas, waterFramePattern } from "./waterMotionArt";
import { FLOW_DIRECTIONS, FLOW_SHEETS, REED_SHEETS, fishRingFrame, iceSeason, liveReedsAt, waterFrame, waterMotionPlan, type FlowDirection } from "./waterMotionModel";
import { analyseWater, chunkWater, type WaterMap, type WaterSpot } from "./waterMotionPlacement";
import { shoreBandQuads, type BandQuad } from "./waterShoreBand";
import { engineWeather } from "./weatherLayers";
import { mix } from "./weatherPlacement";
import { weatherProofOverride } from "./weatherProof";
import { WAVE29_WATER, type Wave29WaterKey } from "./wave29WaterManifest.generated";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-29 water motion drawing (conditions, clock and detail levels: waterMotionModel.ts; where: waterMotionPlacement.ts,
// waterShoreBand.ts).
// drawWaterMotion runs live in the RENDER_BOUNDARY_V2 ground pass right after the ground chunks (whose rasters hold the
// still water, the strips and, in winter, the ice rim) and before the town landscape, the bridge decks and the objects,
// which stand over the water. Order: deep ripples; clipped to the water, the shallow ripples and the river flow; the
// shore foam; fish rings; glints; the swaying reeds. The ripple and flow sheets are laid world-aligned at half scale
// (WATER_ART_SCALE: 2 source px a world px, as the deep water fills), so a 256 x 128 ripple frame repeats every 2 x 2
// tiles and a 128 x 64 flow frame is one tile; the strips follow the shore strip's mapping; the reeds keep the static
// reeds' rect. Each sheet draws at its recommended alpha only (the ripples' alpha is baked in the PNG).
// The legacy terrain path (RENDER_BOUNDARY_V2 off) has no shore loops and draws no motion.
export const WATER_ART_SCALE = 0.5;
const REED_WIDTH = 24;
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export interface WaterMotionInput {
  readonly state: GameState;
  readonly shore: Shoreline;
  /** The visible ground chunks. */
  readonly chunks: readonly GroundChunkPlan[];
  readonly range: TileRange;
  readonly zoom: number;
  /** The ground chunks' zoom bucket: the swaying reeds are live exactly when the chunks leave their static reeds out. */
  readonly chunkZoom: number;
  readonly nowMs: number;
  /** The weather the water shows; absent: the presented one (the engine's, or the INSTALL-23 proof hook's). */
  readonly weather?: WeatherKind | null;
  readonly season: SeasonIndex;
}

/** The engine's weather now, or the proof hook's (weatherProof.ts), as the weather layers present it. */
export function presentedWaterWeather(state: GameState): WeatherKind | null {
  const proof = weatherProofOverride();
  return proof !== null && "weather" in proof && proof.weather !== undefined ? proof.weather : engineWeather(state).weather;
}

type ChunkPaths = { readonly deep: Path2D | null; readonly shallow: Path2D | null; readonly flow: Readonly<Record<FlowDirection, Path2D | null>>;
  readonly glints: readonly WaterSpot[]; readonly fish: readonly WaterSpot[] };
type MapEntry = { readonly tiles: readonly Tile[]; readonly seed: number; readonly terrain: string; readonly map: WaterMap;
  readonly chunks: Map<string, ChunkPaths>; view: { readonly key: string; readonly paths: ChunkPaths } | null };

// Cache (AGENTS rule 10): the map's water analysis and, per 8 x 8-tile chunk, its tile classes as Path2D diamonds and its
// glint / fish spots, plus the visible chunks' paths joined; key: the terrain (every tile's terrain in order, checked when
// the tiles array changes: a building, road or bridge makes a new array but leaves the water as it was), the map size
// and the seed; the joined paths also by the visible chunk span. Reason: the analysis walks every tile and the river
// sets (with all 64 chunks' lists 0.50 ms, median of 30 after 10 warm-up runs, Node, the palisade-construction save;
// 0.70 ms on a seed-93 map with a channel; the terrain check 0.05 ms), and a chunk's diamonds are the same every
// frame; nothing else reads into them (the weather, the season and the clock pick what is drawn and which frame, not
// where). Measured (the terrain.water stage, mean of 200 frames, headless Chrome
// --disable-gpu on the Mac, the pop176 lake at zoom 1.1, two runs): 0.20 ms cached, 0.23-0.25 ms with the chunk and
// view paths rebuilt every frame; 0.04 ms with no water motion. Again with the river length rule (the palisade-
// construction lake at zoom 1.1, paused, 240 frames, two runs): 0.14 ms cached, 0.005 ms with no water motion.
let mapEntry: MapEntry | null = null;
export function waterMapFor(state: Pick<GameState, "tiles" | "seed" | "width" | "height">): MapEntry {
  if (mapEntry !== null && mapEntry.tiles === state.tiles && mapEntry.seed === state.seed) return mapEntry;
  const terrain = `${state.width}x${state.height}:${state.tiles.map(tile => tile.terrain === "water" ? "w" : "l").join("")}`;
  if (mapEntry !== null && mapEntry.terrain === terrain && mapEntry.seed === state.seed) { mapEntry = { ...mapEntry, tiles: state.tiles }; return mapEntry; }
  mapEntry = { tiles: state.tiles, seed: state.seed, terrain, map: analyseWater(state.tiles, state.width, state.height), chunks: new Map(), view: null };
  return mapEntry;
}

function diamonds(tiles: readonly Tile[]): Path2D | null {
  if (tiles.length === 0) return null;
  const path = new Path2D();
  for (const tile of tiles) {
    const { sx, sy } = tileToScreen(tile.tx, tile.ty);
    path.moveTo(sx, sy - 16); path.lineTo(sx + 32, sy); path.lineTo(sx, sy + 16); path.lineTo(sx - 32, sy); path.closePath();
  }
  return path;
}

function chunkPaths(entry: MapEntry, state: Pick<GameState, "tiles" | "seed">, plan: GroundChunkPlan): ChunkPaths {
  const key = `${plan.cx},${plan.cy}`;
  let paths = entry.chunks.get(key);
  if (paths === undefined) {
    const water = chunkWater(entry.map, state.tiles, state.seed, plan.cx, plan.cy);
    paths = { deep: diamonds(water.deep), shallow: diamonds(water.shallow), glints: water.glints, fish: water.fish,
      flow: { ne: diamonds(water.flow.ne), nw: diamonds(water.flow.nw), se: diamonds(water.flow.se), sw: diamonds(water.flow.sw) } };
    entry.chunks.set(key, paths);
  }
  return paths;
}

function joined(parts: readonly (Path2D | null)[]): Path2D | null {
  const present = parts.filter((part): part is Path2D => part !== null);
  if (present.length === 0) return null;
  const path = new Path2D();
  for (const part of present) path.addPath(part);
  return path;
}

function viewPaths(entry: MapEntry, state: Pick<GameState, "tiles" | "seed">, chunks: readonly GroundChunkPlan[]): ChunkPaths {
  const key = chunks.map(plan => `${plan.cx},${plan.cy}`).join(";");
  if (entry.view?.key === key) return entry.view.paths;
  const each = chunks.map(plan => chunkPaths(entry, state, plan));
  const flow = Object.fromEntries(FLOW_DIRECTIONS.map(direction => [direction, joined(each.map(paths => paths.flow[direction]))])) as Record<FlowDirection, Path2D | null>;
  const paths = { deep: joined(each.map(paths => paths.deep)), shallow: joined(each.map(paths => paths.shallow)), flow,
    glints: each.flatMap(paths => paths.glints), fish: each.flatMap(paths => paths.fish) };
  entry.view = { key, paths };
  return paths;
}

// Cache (AGENTS rule 10): the whole map's water as one even-odd path of the shore loops (the clip of the shallow
// ripples and the flow); key: the Shoreline object (groundBoundaryScene rebuilds it when the terrain, a bridge or a
// water-side wall changes). Reason: the loops are the same every frame.
const waterPaths = new WeakMap<Shoreline, Path2D>();
function waterPath(shore: Shoreline): Path2D {
  let path = waterPaths.get(shore);
  if (path === undefined) {
    path = new Path2D();
    for (const loop of shore.loops) {
      loop.smoothed.forEach((point, at) => { const s = tileToScreen(point.x, point.y); if (at === 0) path?.moveTo(s.sx, s.sy); else path?.lineTo(s.sx, s.sy); });
      path.closePath();
    }
    waterPaths.set(shore, path);
  }
  return path;
}

// Cache (AGENTS rule 10): each loop's band quads (foam, ice); key: the loop object (a new shoreline makes new loops)
// and the wall strips switch (walled stretches are left out with it on). Reason: the quads and their texture
// matrices are the same every frame. Measured as above: 0.29-0.31 ms rebuilding them every frame, 0.20 ms cached.
const bandQuads = new WeakMap<ShoreLoop, Map<string, readonly BandQuad[]>>();
function loopBand(loop: ShoreLoop, key: "shore_foam_sheet" | "ice_edge"): readonly BandQuad[] {
  const walls = wallStripsEnabled();
  const id = `${key}:${walls ? 1 : 0}`;
  let byKey = bandQuads.get(loop);
  if (byKey === undefined) { byKey = new Map(); bandQuads.set(loop, byKey); }
  let quads = byKey.get(id);
  if (quads === undefined) {
    const sheet = WAVE29_WATER[key];
    quads = shoreBandQuads(loop, sheet.offsetY, sheet.offsetY + sheet.frameHeight, sheet.frameWidth, walls);
    byKey.set(id, quads);
  }
  return quads;
}

const meets = (quad: BandQuad, view: Rect): boolean =>
  quad.bounds.right >= view.x && quad.bounds.left <= view.x + view.width && quad.bounds.bottom >= view.y && quad.bounds.top <= view.y + view.height;

function drawBand(context: CanvasRenderingContext2D, loops: readonly ShoreLoop[], key: "shore_foam_sheet" | "ice_edge", frame: number, view: Rect): void {
  const pattern = waterFramePattern(context, key, frame);
  if (pattern === null) return;
  context.save();
  context.globalAlpha *= WAVE29_WATER[key].alpha;
  context.fillStyle = pattern;
  for (const loop of loops) {
    for (const quad of loopBand(loop, key)) {
      if (!meets(quad, view)) continue;
      pattern.setTransform(quad.matrix);
      context.beginPath();
      quad.corners.forEach(([x, y], at) => { if (at === 0) context.moveTo(x, y); else context.lineTo(x, y); });
      context.closePath();
      context.fill();
    }
  }
  context.restore();
}

/** INSTALL-29: the winter ice rim, painted into a ground chunk with its strips (`chunk`: the chunk's world px box). */
export function drawIceRim(context: CanvasRenderingContext2D, shore: Shoreline, loops: readonly number[], chunk: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }): void {
  if (loops.length === 0) return;
  const present = loops.map(index => shore.loops[index]).filter((loop): loop is ShoreLoop => loop !== undefined);
  drawBand(context, present, "ice_edge", 0, { x: chunk.left, y: chunk.top, width: chunk.right - chunk.left, height: chunk.bottom - chunk.top });
}

export const liveReeds = (chunkZoom: number): boolean => liveReedsAt(chunkZoom) && waterArtReady(REED_SHEETS);
export const iceRimDrawn = (season: SeasonIndex): boolean => iceSeason(season) && waterArtReady(["ice_edge"]);
/** INSTALL-29: the ground chunks' water token — the ice rim's art (winter chunks paint it) and whether they leave the
 * static reeds out for the live ones. In the key of every chunk that draws water. Not the season itself (the key has
 * it): the INSTALL-15 staging makes winter's rasters in autumn with autumn's readiness and must meet winter's keys. */
export function waterChunkToken(chunkZoom: number): string {
  return `:i${waterArtReady(["ice_edge"]) ? 1 : 0}:r${liveReeds(chunkZoom) ? 1 : 0}`;
}

function fillWorldAligned(context: CanvasRenderingContext2D, path: Path2D | null, key: Wave29WaterKey, nowMs: number): void {
  if (path === null) return;
  const pattern = waterFramePattern(context, key, waterFrame(key, nowMs));
  if (pattern === null) return;
  pattern.setTransform({ a: WATER_ART_SCALE, b: 0, c: 0, d: WATER_ART_SCALE, e: 0, f: 0 });
  context.globalAlpha = WAVE29_WATER[key].alpha;
  context.fillStyle = pattern;
  context.fill(path);
}

function drawSpots(context: CanvasRenderingContext2D, key: "sparkle" | "fish_ring", spots: readonly WaterSpot[], frameOf: (spot: WaterSpot) => number | null, view: Rect): void {
  const sheet = WAVE29_WATER[key];
  const width = sheet.frameWidth * WATER_ART_SCALE; const height = sheet.frameHeight * WATER_ART_SCALE;
  context.globalAlpha = sheet.alpha;
  for (const spot of spots) {
    if (spot.x + width < view.x || spot.x - width > view.x + view.width || spot.y + height < view.y || spot.y - height > view.y + view.height) continue;
    const frame = frameOf(spot);
    const image = frame === null ? null : waterFrameCanvas(key, frame);
    if (image === null) continue;
    drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: sheet.frameWidth, height: sheet.frameHeight },
      { x: spot.x - sheet.anchorX * WATER_ART_SCALE, y: spot.y - sheet.anchorY * WATER_ART_SCALE, width, height }, false, true);
  }
}

function drawReeds(context: CanvasRenderingContext2D, loops: readonly ShoreLoop[], nowMs: number, view: Rect): void {
  context.globalAlpha = 1;
  for (const loop of loops) {
    for (const decal of loop.decals) {
      if (decal.kind !== "weed") continue;
      const at = tileToScreen(decal.anchor.x, decal.anchor.y);
      if (at.sx + REED_WIDTH < view.x || at.sx - REED_WIDTH > view.x + view.width || at.sy < view.y || at.sy - REED_WIDTH > view.y + view.height) continue;
      const key = REED_SHEETS[decal.variant % REED_SHEETS.length] as Wave29WaterKey;
      const sheet = WAVE29_WATER[key];
      // Each clump on its own phase (the anchor's hash), so the reeds of a bank do not sway in step.
      const image = waterFrameCanvas(key, waterFrame(key, nowMs, mix(Math.round(decal.anchor.x * 64), Math.round(decal.anchor.y * 64), 29_401) % 1000));
      if (image === null) continue;
      // The static reeds' rect (drawShoreline.ts drawDecalSprites): bottom centre on the anchor, sunk 12 % of the height.
      const height = REED_WIDTH * sheet.frameHeight / sheet.frameWidth;
      drawMirrorableSprite(context, image, { x: 0, y: 0, width: sheet.frameWidth, height: sheet.frameHeight },
        { x: at.sx - REED_WIDTH / 2, y: at.sy - height + height * 0.12, width: REED_WIDTH, height }, decal.flip);
    }
  }
}

/** The world px rect in view (the context's transform and canvas), or the tile range's box without a canvas. */
function viewRect(context: CanvasRenderingContext2D, range: TileRange): Rect {
  const canvas = (context as Partial<CanvasRenderingContext2D>).canvas;
  if (typeof context.getTransform === "function" && canvas !== undefined) {
    const t = context.getTransform();
    if (t.a > 0 && t.d > 0) return { x: -t.e / t.a, y: -t.f / t.d, width: canvas.width / t.a, height: canvas.height / t.d };
  }
  const corners = [tileToScreen(range.minTx, range.minTy), tileToScreen(range.maxTx, range.minTy), tileToScreen(range.maxTx, range.maxTy), tileToScreen(range.minTx, range.maxTy)];
  const xs = corners.map(corner => corner.sx); const ys = corners.map(corner => corner.sy);
  return { x: Math.min(...xs) - 32, y: Math.min(...ys) - 16, width: Math.max(...xs) - Math.min(...xs) + 64, height: Math.max(...ys) - Math.min(...ys) + 32 };
}

export function drawWaterMotion(context: CanvasRenderingContext2D, input: WaterMotionInput): void {
  const plan = waterMotionPlan(input.zoom, input.weather !== undefined ? input.weather : presentedWaterWeather(input.state), input.season);
  if (!plan.deepRipples || input.chunks.every(chunk => chunk.waterLoops.length === 0 && !chunk.waterParity)) return;
  if (typeof Path2D === "undefined" || typeof context.createPattern !== "function") return;
  const entry = waterMapFor(input.state);
  const wet = input.chunks.filter(chunk => chunk.waterLoops.length > 0 || chunk.waterParity);
  const paths = viewPaths(entry, input.state, wet);
  const view = viewRect(context, input.range);
  const loops = [...new Set(wet.flatMap(chunk => chunk.waterLoops))].map(index => input.shore.loops[index]).filter((loop): loop is ShoreLoop => loop !== undefined);
  context.save();
  fillWorldAligned(context, paths.deep, "ripple_sheet", input.nowMs);
  if (input.shore.loops.length > 0 && (plan.shallowRipples || plan.flow)) {
    context.save();
    context.clip(waterPath(input.shore), "evenodd");
    if (plan.shallowRipples) fillWorldAligned(context, paths.shallow, "ripple_shallow_sheet", input.nowMs);
    if (plan.flow) for (const direction of FLOW_DIRECTIONS) fillWorldAligned(context, paths.flow[direction], FLOW_SHEETS[direction], input.nowMs);
    context.restore();
  }
  if (plan.foam) drawBand(context, loops, "shore_foam_sheet", waterFrame("shore_foam_sheet", input.nowMs), view);
  if (plan.fish) drawSpots(context, "fish_ring", paths.fish, spot => { const frame = fishRingFrame(spot.hash, input.nowMs); return frame === 0 ? null : frame; }, view);
  if (plan.glints) drawSpots(context, "sparkle", paths.glints, spot => waterFrame("sparkle", input.nowMs, spot.hash % 1000), view);
  // The chunks' zoom bucket decides (they leave their static reeds out exactly then), so a clump is never drawn twice or not at all.
  if (liveReeds(input.chunkZoom)) drawReeds(context, loops, input.nowMs, view);
  context.restore();
}

