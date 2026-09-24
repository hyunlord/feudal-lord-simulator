import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Session } from "node:inspector/promises";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";

// RENDER_BOUNDARY_V2 render gates. Coverage has to start before the render modules load (V8 precise coverage only
// sees scripts compiled after it starts), so they are imported dynamically below.
const coverage = new Session();
coverage.connect();
await coverage.post("Profiler.enable");
await coverage.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
const { drawCurrentCanvasFrame } = await import("../src/render/canvasRuntimeFrame");
const { createConstructionCompletionTracker } = await import("../src/render/constructionCompletionEffects");
const { resolveBoundaryV2Flag, setBoundaryV2Enabled } = await import("../src/render/renderBoundaryFlag");
const { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } = await import("../src/render/drawTerrainBoundaryV2");
const { createGroundChunkCache } = await import("../src/render/groundChunkCache");
const { setGroundSceneReverseInput } = await import("../src/render/groundBoundaryScene");
const { setBoundaryAssetsForTest } = await import("../src/render/boundaryAssets");
const { BOUNDARY_ASSETS } = await import("../src/render/boundaryAssetManifest");
const { placeBuilding, placeRoadLine, removeRoad } = await import("../src/engine/gameActions");
const { completeEligibleConstruction } = await import("../src/engine/constructionLifecycle");
const { fixedSceneState, seedGroundState } = await import("./boundaryFixtureStates");

const V2_MODULES = [
  "/src/render/drawTerrainBoundaryV2.ts", "/src/render/groundBoundaryScene.ts", "/src/render/groundChunkCache.ts",
  "/src/render/drawRoadRibbons.ts", "/src/render/drawGroundBoundaries.ts", "/src/render/boundaryAssets.ts",
  "/src/world/boundary/",
] as const;

type Recording = { readonly canvas: { width: number; height: number; ops: string[] }; readonly context: CanvasRenderingContext2D };

/** A CanvasRenderingContext2D stand-in that tracks the transform and records every call with rounded arguments. */
function recordingCanvas(width: number, height: number): Recording {
  const canvas = { width, height, ops: [] as string[] };
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: (typeof transform)[] = [];
  let patterns = 0;
  const format = (value: unknown): string => typeof value === "number" ? String(Math.round(value * 1000) / 1000)
    : typeof value === "object" && value !== null && "label" in value ? String((value as { label: unknown }).label)
    : typeof value === "object" && value !== null && "ops" in value ? "canvas" : String(value);
  const record = (name: string, args: readonly unknown[]): void => { canvas.ops.push(`${name}(${args.map(format).join(",")})`); };
  const multiply = (m: typeof transform) => {
    const t = transform;
    transform = { a: t.a * m.a + t.c * m.b, b: t.b * m.a + t.d * m.b, c: t.a * m.c + t.c * m.d, d: t.b * m.c + t.d * m.d,
      e: t.a * m.e + t.c * m.f + t.e, f: t.b * m.e + t.d * m.f + t.f };
  };
  const fields: Record<string, unknown> = { canvas, globalAlpha: 1, globalCompositeOperation: "source-over", imageSmoothingEnabled: true };
  const methods: Record<string, (...args: never[]) => unknown> = {
    save: () => { stack.push(transform); record("save", []); },
    restore: () => { transform = stack.pop() ?? transform; record("restore", []); },
    setTransform: (...args: unknown[]) => {
      const value = typeof args[0] === "object" ? args[0] as typeof transform
        : { a: args[0] as number, b: args[1] as number, c: args[2] as number, d: args[3] as number, e: args[4] as number, f: args[5] as number };
      transform = { ...value }; record("setTransform", Object.values(transform));
    },
    translate: (x: number, y: number) => { multiply({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }); record("translate", [x, y]); },
    scale: (x: number, y: number) => { multiply({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); record("scale", [x, y]); },
    getTransform: () => ({ ...transform }),
    measureText: () => ({ width: 0 }),
    clearRect: (...args: unknown[]) => {
      if (transform.a === 1 && transform.d === 1 && transform.e === 0 && transform.f === 0) canvas.ops.length = 0;
      record("clearRect", args);
    },
    createPattern: (image: unknown) => {
      const pattern = { label: `pattern${patterns++}:${format(image)}`, setTransform: (m: unknown) => record("pattern.setTransform", Object.values(m as object)) };
      return pattern;
    },
  };
  const context = new Proxy(fields, {
    get(target, key: string) {
      if (key in methods) return methods[key];
      if (key in target) return target[key];
      return (...args: unknown[]) => { record(key, args); return null; };
    },
    set(target, key: string, value) { target[key] = value; record(`set ${key}`, [value]); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { canvas, context };
}

const opsHash = (ops: readonly string[]): string => createHash("sha256").update(ops.join("\n")).digest("hex");

function fakeImages(): void {
  setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
    { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
}

function drawFrame(context: CanvasRenderingContext2D, state: GameState, centre: readonly [number, number], zoom = 1): void {
  drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement,
    context,
    refs: {
      cameraRef: { current: { zoom, panX: 640 - (centre[0] - centre[1]) * 32 * zoom, panY: 400 - (centre[0] + centre[1]) * 16 * zoom } },
      hoverRef: { current: null }, feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker(),
    },
    state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state,
    interpolationAlpha: () => 1, highlightedHouseIds: [],
  });
}

/** Rasters held by the cache of `context`, as id -> op hash. */
function chunkRasters(context: CanvasRenderingContext2D, ids: readonly string[]): Map<string, string> {
  const cache = groundChunkCacheFor(context);
  return new Map(ids.flatMap(id => {
    const entry = cache.entry(id);
    return entry === null ? [] : [[id, `${entry.contentKey}|${opsHash((entry.raster.canvas as unknown as Recording["canvas"]).ops)}`]];
  }));
}

function allChunkIds(state: GameState): string[] {
  const ids: string[] = [];
  for (let cy = 0; cy < Math.ceil(state.height / 8); cy += 1) for (let cx = 0; cx < Math.ceil(state.width / 8); cx += 1) ids.push(`ground:${cx},${cy}`, `roads:${cx},${cy}`);
  return ids;
}

/** Freshly rastered chunks for this frame (new cache) must equal what the long-lived cache now holds. */
function staleChunks(live: CanvasRenderingContext2D, state: GameState, centre: readonly [number, number]): string[] {
  const fresh = recordingCanvas(1280, 800).context;
  drawFrame(fresh, state, centre);
  const expected = chunkRasters(fresh, allChunkIds(state));
  const held = chunkRasters(live, [...expected.keys()]);
  assert.ok(expected.size > 0);
  return [...expected].filter(([id, value]) => held.get(id) !== value).map(([id]) => id);
}

async function v2FunctionsRunDuring(draw: () => void): Promise<readonly string[]> {
  await coverage.post("Profiler.takePreciseCoverage");
  draw();
  const { result } = await coverage.post("Profiler.takePreciseCoverage");
  assert.ok(result.some(entry => entry.url.includes("/src/render/canvasRuntimeFrame.ts")), "coverage saw the frame");
  // V8 leaves out scripts none of whose functions ran since the last take, so a missing entry means zero calls.
  return result.filter(entry => V2_MODULES.some(module => entry.url.includes(module))).flatMap(entry => entry.functions
    .filter(fn => (fn.ranges[0]?.startOffset ?? 0) > 0 && (fn.ranges[0]?.count ?? 0) > 0)
    .map(fn => `${entry.url.slice(entry.url.indexOf("/src/"))}:${fn.functionName || "(anonymous)"}`));
}

const CENTRE = [42, 56] as const;
setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((width: number, height: number) => recordingCanvas(width, height)) as unknown as Parameters<typeof createGroundChunkCache>[0]));
fakeImages();

test("Given the flag is off When a whole frame is drawn Then no function of the curved-ground modules executes", async () => {
  // Given
  setBoundaryV2Enabled(false);
  const state = fixedSceneState();

  // When
  const off = await v2FunctionsRunDuring(() => drawFrame(recordingCanvas(1280, 800).context, state, CENTRE));
  setBoundaryV2Enabled(true);
  const on = await v2FunctionsRunDuring(() => drawFrame(recordingCanvas(1280, 800).context, state, CENTRE));
  setBoundaryV2Enabled(false);

  // Then
  assert.deepEqual(off, []);
  assert.ok(on.some(name => name.includes("drawTerrainBoundaryV2")) && on.some(name => name.includes("drawRoadRibbons")), "control: coverage sees V2 when on");
});

test("Given the same state When it is drawn twice, once from tiles enumerated in reverse Then every chunk and the frame are identical", () => {
  // Given
  setBoundaryV2Enabled(true);
  for (const [state, centre] of [[fixedSceneState(), CENTRE], [seedGroundState(2), [32, 32]]] as const) {

    // When
    const forward = recordingCanvas(1280, 800);
    drawFrame(forward.context, state, centre);
    setGroundSceneReverseInput(true);
    const reversed = recordingCanvas(1280, 800);
    drawFrame(reversed.context, state, centre);
    setGroundSceneReverseInput(false);

    // Then
    const ids = allChunkIds(state);
    assert.deepEqual([...chunkRasters(reversed.context, ids)], [...chunkRasters(forward.context, ids)]);
    const frameOps = (ops: readonly string[]) => opsHash(ops.filter(op => !op.includes("performance")));
    assert.equal(frameOps(reversed.canvas.ops), frameOps(forward.canvas.ops));
  }
  setBoundaryV2Enabled(false);
});

test("Given a cached frame When a road is built, a road is removed and a farm completes Then the touched chunks re-raster in that frame and nothing is stale", () => {
  // Given
  setBoundaryV2Enabled(true);
  const live = recordingCanvas(1280, 800).context;
  let state = fixedSceneState();
  drawFrame(live, state, CENTRE);
  const cache = groundChunkCacheFor(live);

  // When / Then: a camera pan alone re-rasters nothing.
  drawFrame(live, state, [CENTRE[0] + 0.4, CENTRE[1] - 0.3]);
  assert.equal(cache.stats().lastFrameRasters, 0, "pan is not an invalidation");

  const steps: [string, (current: GameState) => GameState][] = [
    ["build road", current => placeRoadLine(current, { tx: 43, ty: 57 }, { tx: 44, ty: 57 })],
    ["remove road", current => removeRoad(current, { tx: 39, ty: 61 })],
    ["place farm", current => placeBuilding(current, "wheat_farm", { tx: 42, ty: 51 })],
    ["complete farm", current => completeEligibleConstruction({
      ...current, wallTick: current.wallTick + 120,
      constructionSites: current.constructionSites.map(site => ({ ...site, delivered: { ...site.required }, builderTicks: site.requiredBuilderTicks })),
    })],
  ];
  for (const [label, change] of steps) {
    const next = change(state);
    assert.notEqual(next, state, `${label} changed the state`);
    // Control: before the live cache draws the new state, the stale check does see its old rasters as stale.
    assert.ok(staleChunks(live, next, CENTRE).length > 0, `${label}: the change reaches some cached chunk`);
    state = next;
    drawFrame(live, state, CENTRE);
    assert.ok(cache.stats().lastFrameRasters > 0, `${label}: some chunk re-rastered in the same frame`);
    assert.deepEqual(staleChunks(live, state, CENTRE), [], `${label}: no stale chunk`);
  }
  assert.ok(state.buildings.some(building => building.kind === "wheat_farm" && building.tx === 42 && building.ty === 51), "farm completed");
  setBoundaryV2Enabled(false);
});

test("Given query, stored choice and default When the flag is resolved Then the URL wins, then the stored choice, and the default is off", () => {
  const storage = (value: string | null) => ({ getItem: () => value });
  assert.equal(resolveBoundaryV2Flag({}), false);
  assert.equal(resolveBoundaryV2Flag({ storage: storage("1") }), true);
  assert.equal(resolveBoundaryV2Flag({ search: "?render-boundary-v2=0", storage: storage("1") }), false);
  assert.equal(resolveBoundaryV2Flag({ search: "?phase10-proof=1&render-boundary-v2=1", storage: storage("0") }), true);
  assert.equal(resolveBoundaryV2Flag({ storage: { getItem: () => { throw new Error("blocked"); } } }), false);
});
