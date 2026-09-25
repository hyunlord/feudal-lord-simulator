import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";

// RENDER_WALL_STRIPS (D3b follow-up): the wall face strips are their own flag, default off, on top of the curved
// ground. Coverage has to start before the render modules load, so they are imported dynamically below.
const coverage = new Session();
coverage.connect();
await coverage.post("Profiler.enable");
await coverage.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
const { drawCurrentCanvasFrame } = await import("../src/render/canvasRuntimeFrame");
const { createConstructionCompletionTracker } = await import("../src/render/constructionCompletionEffects");
const { setBoundaryV2Enabled } = await import("../src/render/renderBoundaryFlag");
const { resolveWallStripsFlag, setWallStripsEnabled, wallStripsEnabled } = await import("../src/render/renderWallStripsFlag");
const { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } = await import("../src/render/drawTerrainBoundaryV2");
const { createGroundChunkCache } = await import("../src/render/groundChunkCache");
const { setBoundaryAssetsForTest } = await import("../src/render/boundaryAssets");
const { BOUNDARY_ASSETS } = await import("../src/render/boundaryAssetManifest");
const { setShoreAssetsForTest } = await import("../src/render/terrainVariantAssets");
const { TERRAIN_VARIANTS } = await import("../src/render/terrainVariantManifest");
const { seedGroundState } = await import("../scripts/boundaryFixtureStates");
const { recordingCanvas } = await import("../scripts/recordingCanvas");
type Recording = import("../scripts/recordingCanvas").Recording;

setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
  { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
setShoreAssetsForTest(Object.fromEntries(TERRAIN_VARIANTS.shoreline.map(key => [key,
  { label: key, width: 512, height: 128, naturalWidth: 512, naturalHeight: 128 } as unknown as HTMLImageElement])));
setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((width: number, height: number) => recordingCanvas(width, height)) as unknown as Parameters<typeof createGroundChunkCache>[0]));

function drawFrame(context: CanvasRenderingContext2D, state: GameState, centre: readonly [number, number]): void {
  drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement,
    context,
    refs: {
      cameraRef: { current: { zoom: 1, panX: 640 - (centre[0] - centre[1]) * 32, panY: 400 - (centre[0] + centre[1]) * 16 } },
      hoverRef: { current: null }, feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker(),
    },
    state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state,
    interpolationAlpha: () => 1, highlightedHouseIds: [],
  });
}

async function wallFaceFunctionsRunDuring(draw: () => void): Promise<readonly string[]> {
  await coverage.post("Profiler.takePreciseCoverage");
  draw();
  const { result } = await coverage.post("Profiler.takePreciseCoverage");
  assert.ok(result.some(entry => entry.url.includes("/src/render/canvasRuntimeFrame.ts")), "coverage saw the frame");
  return result.filter(entry => entry.url.includes("/src/render/drawWallFaces.ts")).flatMap(entry => entry.functions
    .filter(fn => (fn.ranges[0]?.startOffset ?? 0) > 0 && (fn.ranges[0]?.count ?? 0) > 0).map(fn => fn.functionName || "(anonymous)"));
}

/** Ops in the ground chunk rasters of `context` (the shore strip is drawn there). */
function groundOps(context: CanvasRenderingContext2D, state: GameState): number {
  const cache = groundChunkCacheFor(context);
  let ops = 0;
  for (let cy = 0; cy < Math.ceil(state.height / 8); cy += 1) for (let cx = 0; cx < Math.ceil(state.width / 8); cx += 1) {
    const entry = cache.entry(`ground:${cx},${cy}`);
    if (entry !== null) ops += (entry.raster.canvas as unknown as Recording["canvas"]).ops.length;
  }
  return ops;
}

// Seed 2 south: the stone wall standing on the lake (the D3b shoreline capture).
const LAKE_WALL = [46, 45] as const;

test("Given query, stored choice and default When the wall strips flag is resolved Then the URL wins, then the stored choice, and the default is on (v2 strips, WL8)", () => {
  const storage = (value: string | null) => ({ getItem: () => value });
  assert.equal(resolveWallStripsFlag({}), true);
  assert.equal(wallStripsEnabled(), true);
  assert.equal(resolveWallStripsFlag({ storage: storage("1") }), true);
  assert.equal(resolveWallStripsFlag({ storage: storage("0") }), false);
  assert.equal(resolveWallStripsFlag({ search: "?render-wall-strips=0", storage: storage("1") }), false);
  assert.equal(resolveWallStripsFlag({ search: "?render-boundary-v2=1&render-wall-strips=1", storage: storage("0") }), true);
  assert.equal(resolveWallStripsFlag({ storage: { getItem: () => { throw new Error("blocked"); } } }), true);
});

test("Given curved ground on and wall strips off When the lake wall is drawn Then no wall face code runs and the shore strip is drawn under the wall", async () => {
  // Given
  setBoundaryV2Enabled(true);
  const state = seedGroundState(2);
  const offContext = recordingCanvas(1280, 800).context;
  const onContext = recordingCanvas(1280, 800).context;

  // When
  setWallStripsEnabled(false);
  const off = await wallFaceFunctionsRunDuring(() => drawFrame(offContext, state, LAKE_WALL));
  setWallStripsEnabled(true);
  const on = await wallFaceFunctionsRunDuring(() => drawFrame(onContext, state, LAKE_WALL));
  setWallStripsEnabled(false);
  setBoundaryV2Enabled(false);

  // Then
  // wallFaceSlices only indexes the baseline chains by edge; it is built with the baselines the shoreline shares.
  assert.deepEqual(off.filter(name => name !== "wallFaceSlices"), []);
  assert.ok(on.includes("drawWallFaceSlice") && on.includes("drawWallModules"), `control: coverage sees the strips when on (${on.join(", ")})`);
  assert.ok(groundOps(offContext, state) > groundOps(onContext, state), "the shore strip under the wall is drawn only with the strips off");
});
