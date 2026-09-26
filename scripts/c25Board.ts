// C25 regression board (research F25, D1a-2 section 6): one seed 2 view where buildings, square fields, earth and
// stone roads, the lake and the town wall meet. Every later ground/frontage/zone change is checked on the same board.
//  - Node (tests/c25Board.test.ts): the frame's canvas call stream at zoom 0.6 / 1.0 / 1.35 x DPR 1 / 2, hashed,
//    compared with tests/fixtures/boundary/c25-board.json. A render change that is meant to change the board updates
//    the file with `npx tsx scripts/c25Board.ts --write` in the same commit (and says so in its report).
//  - Browser (scripts/boundaryEvidence.mjs c25): canvas PNG SHA-256 of the same six views, software raster.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { BOUNDARY_ASSETS } from "../src/render/boundaryAssetManifest";
import { setBoundaryAssetsForTest } from "../src/render/boundaryAssets";
import { drawCurrentCanvasFrame } from "../src/render/canvasRuntimeFrame";
import { createConstructionCompletionTracker } from "../src/render/constructionCompletionEffects";
import { setGroundChunkCacheFactoryForTest } from "../src/render/drawTerrainBoundaryV2";
import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";
import { seedGroundState } from "./boundaryFixtureStates";
import { gameReducer } from "../src/state/gameStore";
import type { ZoneKind } from "../src/zones/zone.types";
import { setZoneAssetsForTest } from "../src/render/zoneAssets";
import { ZONE_ASSETS } from "../src/render/zoneAssetManifest";
import { recordingCanvas, type Recording } from "./recordingCanvas";
import { SEASON_IMAGES } from "../src/render/seasonArtManifest.generated";
import { setSeasonArtForTest } from "../src/render/seasonArt";
import { resetSeasonBlendForTest } from "../src/render/seasonTransition";

export const C25_BOARD = { fixture: "seed 2 final", centre: [44, 38] as const, zooms: [0.6, 1, 1.35] as const, dprs: [1, 2] as const,
  viewport: { width: 1280, height: 800 } } as const;
export const C25_BOARD_FILE = new URL("../tests/fixtures/boundary/c25-board.json", import.meta.url);

export function c25BoardState(): GameState {
  return seedGroundState(2);
}

/**
 * The same board with painted zones (C1b): plots along the curved road outside the wall, arable, pasture and orchard
 * to its west. Applied through the game reducer exactly as the brush sends them.
 */
export const C25_ZONE_STROKES: readonly { readonly kind: ZoneKind; readonly points: readonly (readonly [number, number])[] }[] = [
  { kind: "burgage", points: ([[36, 39], [37, 40], [38, 41], [39, 42], [39, 43], [40, 44], [41, 45], [42, 46]] as const).map(([x, y]) => [x - 1.3, y + 1.3] as const) },
  { kind: "arable", points: [[32, 37], [33, 38]] },
  { kind: "pasture", points: [[30, 44], [31, 46]] },
  { kind: "orchard", points: [[31, 40], [32, 41]] },
];

export function c25ZonedState(): GameState {
  return C25_ZONE_STROKES.reduce((state, stroke) => gameReducer(state, { type: "zone_paint", kind: stroke.kind,
    stroke: { tool: "brush", radius: 2, points: stroke.points.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })) } }), c25BoardState());
}

/**
 * INSTALL-15: the zoned board in each season (zoom 1, DPR 1), 600 ticks into the season (past the leaf and snow
 * effects, which follow the clock). Summer is the zoned board's own season art.
 */
export const C25_SEASONS = [["spring", 0], ["summer", 1], ["autumn", 2], ["winter", 3]] as const;
export function c25SeasonState(season: number): GameState {
  const state = c25ZonedState();
  return { ...state, tick: Math.floor(state.tick / 4_000) * 4_000 + season * 1_000 + 600 };
}

function drawBoard(state: GameState, zoom: number, dpr: number): string {
  resetSeasonBlendForTest();
  const { width, height } = C25_BOARD.viewport;
  const [tx, ty] = C25_BOARD.centre;
  const recording = recordingCanvas(width * dpr, height * dpr);
  const rasters: Recording[] = [];
  setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((w: number, h: number) => { const made = recordingCanvas(w, h); rasters.push(made); return made; }) as unknown as Parameters<typeof createGroundChunkCache>[0]));
  drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width, height }) } as unknown as HTMLCanvasElement,
    context: recording.context,
    refs: {
      cameraRef: { current: { zoom, panX: width / 2 - (tx - ty) * 32 * zoom, panY: height / 2 - (tx + ty) * 16 * zoom } },
      hoverRef: { current: null }, feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: dpr }, completionTracker: createConstructionCompletionTracker(),
    },
    state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state,
    interpolationAlpha: () => 1, highlightedHouseIds: [],
  });
  setGroundChunkCacheFactoryForTest(null);
  const hash = createHash("sha256");
  for (const raster of rasters) hash.update(raster.canvas.ops.join("\n")).update("\n--chunk--\n");
  hash.update(recording.canvas.ops.join("\n"));
  return hash.digest("hex");
}

/** Hash of every chunk raster and the frame's own calls, per view; images are stand-ins (no pixels in Node). */
export function c25BoardHashes(): Record<string, string> {
  setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
    { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
  setZoneAssetsForTest(Object.fromEntries(ZONE_ASSETS.map(asset => [asset.key,
    { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
  setBoundaryV2Enabled(true);
  const hashes: Record<string, string> = {};
  for (const [prefix, state] of [["", c25BoardState()], ["zoned-", c25ZonedState()]] as const) {
    for (const zoom of C25_BOARD.zooms) for (const dpr of C25_BOARD.dprs) hashes[`${prefix}z${zoom.toFixed(2)}-dpr${dpr}`] = drawBoard(state, zoom, dpr);
  }
  setSeasonArtForTest(key => ({ label: key, width: SEASON_IMAGES[key].width, height: SEASON_IMAGES[key].height,
    naturalWidth: SEASON_IMAGES[key].width, naturalHeight: SEASON_IMAGES[key].height }) as unknown as HTMLImageElement);
  for (const [name, season] of C25_SEASONS) hashes[`season-${name}-z1.00-dpr1`] = drawBoard(c25SeasonState(season), 1, 1);
  setSeasonArtForTest(null);
  return hashes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hashes = c25BoardHashes();
  const body = `${JSON.stringify({ board: C25_BOARD, note: "Node call-stream hashes; regenerate with npx tsx scripts/c25Board.ts --write", hashes }, null, 2)}\n`;
  if (process.argv.includes("--write")) writeFileSync(C25_BOARD_FILE, body);
  process.stdout.write(body);
}
