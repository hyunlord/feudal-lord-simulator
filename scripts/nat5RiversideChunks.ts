// NAT-5 N5-D1: which riverside ground chunks the smoothed rock moves. Draws the riverside (a new game on map 1, run in
// Node to <tick>) at a camera in Node with recording canvases (scripts/recordingCanvas.ts, the boundaryRender.test.ts
// frame) from the source tree at <root>, and prints per ground chunk the raster holds: its content key, a hash of its
// draw ops (same ops, same pixels) and the rock tiles within 2 tiles of it. Run it on the base tree and on this one and
// compare: a chunk moves (key or ops) exactly when it carries the rock's key token. Images are not loaded in Node, so the
// rock texture swap itself is not in the ops.
//   npx tsx scripts/nat5RiversideChunks.ts <root> <tick> <centre tx> <centre ty> <zoom> <width> <height>
import { createHash } from "node:crypto";
const [root, tickArg, cx, cy, zoomArg, width, height] = process.argv.slice(2);
const at = (path: string) => import(`${root}/${path}`);
const { drawCurrentCanvasFrame } = await at("src/render/canvasRuntimeFrame.ts");
const { createConstructionCompletionTracker } = await at("src/render/constructionCompletionEffects.ts");
const { setBoundaryV2Enabled } = await at("src/render/renderBoundaryFlag.ts");
const { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } = await at("src/render/drawTerrainBoundaryV2.ts");
const { createGroundChunkCache } = await at("src/render/groundChunkCache.ts");
const { setBoundaryAssetsForTest } = await at("src/render/boundaryAssets.ts");
const { BOUNDARY_ASSETS } = await at("src/render/boundaryAssetManifest.ts");
const { recordingCanvas } = await at("scripts/recordingCanvas.ts");
const { newGameState } = await at("src/state/newGame.ts");
const { DEFAULT_SCENARIO_ID } = await at("src/content/scenario/coreScenarios.ts");
const { advanceTick } = await at("src/engine/tick.ts");
// why: the modules come from <root> by a dynamic import, so they are untyped here (any); the fake images are boundaryRender.test.ts's.
setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map((asset: { key: string; width: number; height: number }) => [asset.key, { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height }])));
setGroundChunkCacheFactoryForTest(() => createGroundChunkCache((w: number, h: number) => recordingCanvas(w, h)));
setBoundaryV2Enabled(true);
let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:open_field", seed: 1 });
while (state.tick < Number(tickArg)) state = advanceTick(state);
const zoom = Number(zoomArg); const W = Number(width), H = Number(height); const centre = [Number(cx), Number(cy)];
const target = recordingCanvas(W, H);
drawCurrentCanvasFrame({ nowMs: 0, canvas: { getBoundingClientRect: () => ({ width: W, height: H }) }, context: target.context,
  refs: { cameraRef: { current: { zoom, panX: W / 2 - (centre[0]! - centre[1]!) * 32 * zoom, panY: H / 2 - (centre[0]! + centre[1]!) * 16 * zoom } },
    hoverRef: { current: null }, feedbackRef: { current: null },
    dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
    pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker() },
  state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state, interpolationAlpha: () => 1, highlightedHouseIds: [] });
const cache = groundChunkCacheFor(target.context);
const out: Record<string, { key: string; ops: string; rockTiles: number }> = {};
for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
  const entry = cache.entry(`ground:${x},${y}`);
  if (entry === null) continue;
  let rockTiles = 0;
  for (let ty = y * 8 - 2; ty < y * 8 + 10; ty += 1) for (let tx = x * 8 - 2; tx < x * 8 + 10; tx += 1) if (state.tiles[ty * 64 + tx]?.terrain === "rock" && tx >= 0 && tx < 64) rockTiles += 1;
  out[`${x},${y}`] = { key: entry.contentKey, ops: createHash("sha256").update((entry.raster.canvas as { ops: string[] }).ops.join("\n")).digest("hex").slice(0, 12), rockTiles };
}
console.log(JSON.stringify(out));
