// NAT-5 stages perf: the ground chunk re-rasters one land stage change costs, through the real frame (drawCurrentCanvasFrame
// with a recording canvas, the real ground chunk cache and keys; Node, so no pictures load and every key's readiness bit
// stays 0). A state is drawn until its chunks are settled, then the changed state until settled again; the chunks whose
// held content key moved are the ones the change re-rastered. Changes: one footpath cell added beside a path, one felled
// tree's picture turned (its record a year older), one fallow cell's stage turned.
//   npx tsx scripts/nat5StageRebake.ts <state.json> [tx ty zoom width height] > rebake.json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { fallowStage, landOf } from "../src/engine/land";
import { BOUNDARY_ASSETS } from "../src/render/boundaryAssetManifest";
import { setBoundaryAssetsForTest } from "../src/render/boundaryAssets";
import { drawCurrentCanvasFrame } from "../src/render/canvasRuntimeFrame";
import { createConstructionCompletionTracker } from "../src/render/constructionCompletionEffects";
import { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } from "../src/render/drawTerrainBoundaryV2";
import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { treeStagePicture } from "../src/render/landStageModel";
import { setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { recordingCanvas } from "./recordingCanvas";

export type Camera = { readonly tx: number; readonly ty: number; readonly zoom: number; readonly width: number; readonly height: number };
const YEAR = 4_000;

function setUp(): void {
  setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
    { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
  setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((w: number, h: number) => recordingCanvas(w, h)) as unknown as Parameters<typeof createGroundChunkCache>[0]));
  setBoundaryV2Enabled(true);
}

function draw(context: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
  drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width: camera.width, height: camera.height }) } as unknown as HTMLCanvasElement, context,
    refs: { cameraRef: { current: { zoom: camera.zoom, panX: camera.width / 2 - (camera.tx - camera.ty) * 32 * camera.zoom, panY: camera.height / 2 - (camera.tx + camera.ty) * 16 * camera.zoom } },
      hoverRef: { current: null }, feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker() },
    state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state, interpolationAlpha: () => 1, highlightedHouseIds: [],
  });
}

function held(context: CanvasRenderingContext2D, state: GameState): Map<string, string> {
  const cache = groundChunkCacheFor(context); const out = new Map<string, string>();
  for (let cy = 0; cy < state.height / 8; cy += 1) for (let cx = 0; cx < state.width / 8; cx += 1) {
    const entry = cache.entry(`ground:${cx},${cy}`);
    if (entry !== null) out.set(`ground:${cx},${cy}`, entry.contentKey);
  }
  return out;
}

/** The ground chunks a change re-rasters (held content keys that moved), the chunks in view, and the object queue's turn. */
export function measureRebake(before: GameState, after: GameState, camera: Camera): { readonly chunksInView: number; readonly rerastered: readonly string[];
  readonly contentRasters: number; readonly objectQueueChanged: boolean } {
  setUp();
  const live = recordingCanvas(camera.width, camera.height).context;
  for (let frame = 0; frame < 6; frame += 1) draw(live, before, camera);
  const keysBefore = held(live, before);
  const range = { minTx: 0, maxTx: before.width - 1, minTy: 0, maxTy: before.height - 1 };
  const queueBefore = objectRenderItemsForFrame({ state: before, visibleTiles: before.tiles, range, includeGroundCover: false });
  const rastersBefore = groundChunkCacheFor(live).stats().contentRasters;
  for (let frame = 0; frame < 6; frame += 1) draw(live, after, camera);
  const keysAfter = held(live, after);
  const queueAfter = objectRenderItemsForFrame({ state: after, visibleTiles: after.tiles, range, includeGroundCover: false });
  const contentRasters = groundChunkCacheFor(live).stats().contentRasters - rastersBefore;
  setGroundChunkCacheFactoryForTest(null);
  return {
    chunksInView: keysBefore.size,
    rerastered: [...keysAfter].filter(([id, key]) => keysBefore.get(id) !== key).map(([id]) => id).sort(),
    contentRasters,
    objectQueueChanged: JSON.stringify(queueBefore.map(item => item.id + ("piece" in item ? JSON.stringify(item.piece) : ""))) !== JSON.stringify(queueAfter.map(item => item.id + ("piece" in item ? JSON.stringify(item.piece) : ""))),
  };
}

/** One open cell beside a footpath, in view, added to the land's footpaths (as a year's walking would). */
export function withOneMoreFootpath(state: GameState, near: { readonly tx: number; readonly ty: number }): GameState {
  const land = landOf(state);
  const paths = new Set(land.footpaths);
  const open = (cell: number) => { const tile = state.tiles[cell]; return tile !== undefined && tile.terrain !== "water" && !tile.hasRoad && tile.buildingId === null && !paths.has(cell); };
  const candidates = land.footpaths.flatMap(cell => [cell - 1, cell + 1, cell - state.width, cell + state.width].filter(open))
    .sort((a, b) => Math.hypot(a % state.width - near.tx, Math.floor(a / state.width) - near.ty) - Math.hypot(b % state.width - near.tx, Math.floor(b / state.width) - near.ty) || a - b);
  const added = candidates[0];
  if (added === undefined) throw new Error("no open cell beside a footpath");
  return { ...state, land: { ...land, footpaths: [...land.footpaths, added].sort((a, b) => a - b) } };
}

/** The felled tree nearest `near` a year older (its record's tick a year back), so its picture turns; the tick stays. */
export function withOneTreeOlder(state: GameState, near: { readonly tx: number; readonly ty: number }): GameState {
  const harvests = state.forestHarvests ?? [];
  const index = harvests.map((harvest, at) => ({ harvest, at }))
    .filter(({ harvest }) => treeStagePicture(harvest, state.tick) !== treeStagePicture({ ...harvest, harvestedAtTick: harvest.harvestedAtTick - YEAR }, state.tick))
    .sort((a, b) => Math.hypot(a.harvest.tx - near.tx, a.harvest.ty - near.ty) - Math.hypot(b.harvest.tx - near.tx, b.harvest.ty - near.ty))[0]?.at;
  if (index === undefined) throw new Error("no felled tree whose picture turns in a year");
  return { ...state, forestHarvests: harvests.map((harvest, at) => (at === index ? { ...harvest, harvestedAtTick: harvest.harvestedAtTick - YEAR } : harvest)) };
}

/** One fallow cell a stage on (left a year earlier) or, at the last stage, a stage back (a year later). */
export function withOneFallowTurned(state: GameState): GameState {
  const land = landOf(state);
  const first = land.fallow[0];
  if (first === undefined) throw new Error("no fallow");
  const shift = fallowStage(first[1], state.tick) === "sapling" ? YEAR : -YEAR;
  return { ...state, land: { ...land, fallow: land.fallow.map(([cell, since], at) => [cell, at === 0 ? since + shift : since] as const) } };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, tx, ty, zoom, width, height] = process.argv.slice(2);
  if (file === undefined) throw new Error("usage: nat5StageRebake.ts <state.json> [tx ty zoom width height]");
  const state = JSON.parse(readFileSync(file, "utf8")) as GameState;
  const camera: Camera = { tx: Number(tx ?? 44), ty: Number(ty ?? 38), zoom: Number(zoom ?? 1), width: Number(width ?? 1600), height: Number(height ?? 1100) };
  const result: Record<string, unknown> = { state: file, tick: state.tick, camera, footpathCells: landOf(state).footpaths.length, fallowCells: landOf(state).fallow.length,
    felledTrees: (state.forestHarvests ?? []).length };
  result.footpath = measureRebake(state, withOneMoreFootpath(state, camera), camera);
  result.tree = measureRebake(state, withOneTreeOlder(state, camera), camera);
  if (landOf(state).fallow.length > 0) result.fallow = measureRebake(state, withOneFallowTurned(state), camera);
  process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
}
