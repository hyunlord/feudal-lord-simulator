import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { drawCurrentCanvasFrame } from "../src/render/canvasRuntimeFrame";
import { resizeCanvas } from "../src/render/canvasRuntime";
import { createConstructionCompletionTracker } from "../src/render/constructionCompletionEffects";
import { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } from "../src/render/drawTerrainBoundaryV2";
import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";
import { setBoundaryAssetsForTest } from "../src/render/boundaryAssets";
import { BOUNDARY_ASSETS } from "../src/render/boundaryAssetManifest";
import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { setPlatformServicesForTest } from "../src/platform/platform";
import type { RenderScale } from "../src/platform/PlatformServices";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { recordingCanvas } from "../scripts/recordingCanvas";

// B9 render scale: backing store = CSS size x DPR x scale, and the ground chunk key names the scale.

setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
  { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((width: number, height: number) => recordingCanvas(width, height)) as unknown as Parameters<typeof createGroundChunkCache>[0]));

function withScale<T>(scale: RenderScale, dpr: number, run: () => T): T {
  const platform = createMemoryPlatformServices({ devicePixelRatio: dpr });
  platform.window.setRenderScale(scale);
  setPlatformServicesForTest(platform);
  try { return run(); } finally { setPlatformServicesForTest(null); }
}

test("Given a render scale When the canvas is resized Then its backing store and transform use DPR x scale and CSS size is unchanged", () => {
  for (const [scale, dpr, width, ratio] of [[1, 1, 1280, 1], [1, 2, 2560, 2], [0.75, 2, 1920, 1.5], [1.25, 2, 3200, 2.5], [0.75, 1, 960, 0.75]] as const) {
    const { canvas, context } = recordingCanvas(0, 0);
    const element = Object.assign(canvas, { getBoundingClientRect: () => ({ width: 1280, height: 800 }) }) as unknown as HTMLCanvasElement;
    const returned = withScale(scale, dpr, () => resizeCanvas(element, context));
    assert.equal(returned, ratio, `scale ${scale} dpr ${dpr}`);
    assert.equal(element.width, width);
    assert.equal(element.height, Math.round(800 * ratio));
    assert.equal(context.getTransform().a, ratio);
  }
});

function chunkKeys(state: GameState, scale: RenderScale): string[] {
  return withScale(scale, 1, () => {
    const { context } = recordingCanvas(1280, 800);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    drawCurrentCanvasFrame({
      canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement,
      context,
      refs: {
        cameraRef: { current: { zoom: 1, panX: 640 - (42 - 56) * 32, panY: 400 - (42 + 56) * 16 } },
        hoverRef: { current: null }, feedbackRef: { current: null },
        dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
        pixelRatioRef: { current: scale }, completionTracker: createConstructionCompletionTracker(),
      },
      state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state,
      interpolationAlpha: () => 1, highlightedHouseIds: [],
    });
    const cache = groundChunkCacheFor(context);
    const keys: string[] = [];
    for (let cy = 0; cy < Math.ceil(state.height / 8); cy += 1) for (let cx = 0; cx < Math.ceil(state.width / 8); cx += 1) {
      for (const id of [`ground:${cx},${cy}`, `roads:${cx},${cy}`]) { const entry = cache.entry(id); if (entry !== null) keys.push(entry.contentKey); }
    }
    return keys;
  });
}

test("Given the curved ground When chunks are rastered at render scale 1 and 1.25 Then scale 1 keeps the D1a keys and 1.25 names itself", () => {
  setBoundaryV2Enabled(true);
  try {
    const state = seedGroundState(2);
    const plain = chunkKeys(state, 1);
    const scaled = chunkKeys(state, 1.25);
    assert.ok(plain.length > 0);
    assert.ok(plain.every(key => !key.includes("|rs")), "scale 1 adds nothing to the key");
    assert.deepEqual(scaled, plain.map(key => `${key}|rs1.25`));
  } finally {
    setBoundaryV2Enabled(false);
  }
});
