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
import { recordingCanvas, type Recording } from "./recordingCanvas";

export const C25_BOARD = { fixture: "seed 2 final", centre: [44, 38] as const, zooms: [0.6, 1, 1.35] as const, dprs: [1, 2] as const,
  viewport: { width: 1280, height: 800 } } as const;
export const C25_BOARD_FILE = new URL("../tests/fixtures/boundary/c25-board.json", import.meta.url);

export function c25BoardState(): GameState {
  return seedGroundState(2);
}

function drawBoard(state: GameState, zoom: number, dpr: number): string {
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
  setBoundaryV2Enabled(true);
  const state = c25BoardState();
  const hashes: Record<string, string> = {};
  for (const zoom of C25_BOARD.zooms) for (const dpr of C25_BOARD.dprs) hashes[`z${zoom.toFixed(2)}-dpr${dpr}`] = drawBoard(state, zoom, dpr);
  return hashes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hashes = c25BoardHashes();
  const body = `${JSON.stringify({ board: C25_BOARD, note: "Node call-stream hashes; regenerate with npx tsx scripts/c25Board.ts --write", hashes }, null, 2)}\n`;
  if (process.argv.includes("--write")) writeFileSync(C25_BOARD_FILE, body);
  process.stdout.write(body);
}
