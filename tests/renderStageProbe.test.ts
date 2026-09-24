import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import type { RenderStage } from "../src/render/renderStageProbe";

// Precise call-count coverage only sees scripts compiled after it starts, so the render modules are imported
// after the session is running. Gate ②: with no proof recorder, no function of renderStageProbe.ts executes.
const coverage = new Session();
coverage.connect();
await coverage.post("Profiler.enable");
await coverage.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
const { drawCurrentCanvasFrame } = await import("../src/render/canvasRuntimeFrame");
const { createConstructionCompletionTracker } = await import("../src/render/constructionCompletionEffects");
const { COUNTED_CANVAS_METHODS, RENDER_STAGES, RENDER_STAGE_GROUPS, installRenderStageProbe, renderStageProbe } =
  await import("../src/render/renderStageProbe");
const { installPhase10ProofRuntime } = await import("../src/testing/phase10ProofRuntime");
// These tests pin the previous ground renderer (RENDER_BOUNDARY_V2 off, still shipped behind the settings toggle);
// the curved ground has its own tests in boundaryRender.test.ts.
(await import("../src/render/renderBoundaryFlag")).setBoundaryV2Enabled(false);

const LOTS24 = JSON.parse(readFileSync(new URL("../fixtures/determinism/seed1/final-state.json", import.meta.url), "utf8")) as GameState;

/** Accepts every canvas call (a stand-in for CanvasRenderingContext2D in Node). */
function recordingContext(): CanvasRenderingContext2D {
  const fields: Record<string, unknown> = { canvas: { width: 1280, height: 800 }, globalAlpha: 1 };
  return new Proxy(fields, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "measureText") return () => ({ width: 0 });
      if (key === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => null;
    },
    set(target, key: string, value) { target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

function drawLots24Frame(context: CanvasRenderingContext2D): void {
  drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement,
    context,
    refs: {
      cameraRef: { current: { zoom: 1, panX: 640 - 8 * 32, panY: 400 - 82 * 16 } },
      hoverRef: { current: null },
      feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: 1 },
      completionTracker: createConstructionCompletionTracker(),
    },
    state: LOTS24,
    selectedTool: null,
    overlayMode: "none",
    selection: null,
    previousRenderState: LOTS24,
    interpolationAlpha: () => 1,
    highlightedHouseIds: [],
  });
}

/** Names (×calls) of renderStageProbe.ts functions V8 executed during `draw` (precise call-count coverage). */
async function probeFunctionsRunDuring(draw: () => void): Promise<readonly string[]> {
  await coverage.post("Profiler.takePreciseCoverage");
  draw();
  const { result } = await coverage.post("Profiler.takePreciseCoverage");
  assert.ok(result.some(entry => entry.url.includes("/src/render/canvasRuntimeFrame.ts")), "coverage saw the frame");
  // V8 leaves out scripts none of whose functions ran since the last take, so a missing entry means zero calls.
  const script = result.find(entry => entry.url.includes("/src/render/renderStageProbe.ts"));
  if (script === undefined) return [];
  return script.functions
    .filter(fn => (fn.ranges[0]?.startOffset ?? 0) > 0 && (fn.ranges[0]?.count ?? 0) > 0)
    .map(fn => `${fn.functionName || "(anonymous)"}×${fn.ranges[0]?.count ?? 0}`);
}

test("Given no proof recorder When a whole 24-lot frame is drawn Then no stage-probe function executes", async () => {
  // Given
  assert.equal(renderStageProbe.current, null);
  const context = recordingContext();

  // When
  const executed = await probeFunctionsRunDuring(() => drawLots24Frame(context));

  // Then
  assert.deepEqual(executed, []);
  for (const method of COUNTED_CANVAS_METHODS) assert.equal(Object.prototype.hasOwnProperty.call(context, method), false);
});

test("Given a recorder When the same frame is drawn Then the probe runs (control) and disposal takes it off the path", async () => {
  // Given
  const context = recordingContext();
  const probe = installRenderStageProbe(context);

  // When
  const probed = await probeFunctionsRunDuring(() => drawLots24Frame(context));
  probe.dispose();
  const afterDispose = await probeFunctionsRunDuring(() => drawLots24Frame(context));

  // Then
  // Recorder methods are arrow functions V8 reports without names; the named wrapper and helper must appear.
  const names = probed.map(entry => entry.split("×")[0]);
  for (const name of ["countedCanvasCall", "stageForRenderItem"]) {
    assert.ok(names.includes(name), `${name} ran: ${probed.join(", ")}`);
  }
  assert.deepEqual(afterDispose, []);
  assert.equal(renderStageProbe.current, null);
  for (const method of COUNTED_CANVAS_METHODS) {
    assert.equal(Object.prototype.hasOwnProperty.call(context, method), false, `${method} restored`);
  }
});

test("Given a stepping clock When stages switch Then stage times add up exactly to the frame time", () => {
  // Given
  let clock = 0;
  const probe = installRenderStageProbe(recordingContext(), () => (clock += 0.37));

  // When
  const recorder = renderStageProbe.current;
  recorder?.frameStart();
  recorder?.enter("terrain.fill");
  recorder?.enter("roads.ground");
  recorder?.enter("terrain.fill");
  recorder?.enter("walls");
  recorder?.frameEnd();
  const frame = probe.snapshot().frames[0];
  probe.dispose();

  // Then
  assert.ok(frame !== undefined);
  const sum = frame.stageMs.reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - frame.totalMs) < 1e-9, `${sum} vs ${frame.totalMs}`);
  assert.ok(Math.abs((frame.stageMs[RENDER_STAGES.indexOf("terrain.fill")] ?? 0) - 0.74) < 1e-9);
});

test("Given a real 24-lot frame When probed Then every drawn layer gets its own stage and canvas calls are attributed", () => {
  // Given
  const context = recordingContext();
  const probe = installRenderStageProbe(context);

  // When
  drawLots24Frame(context);
  const snapshot = probe.snapshot();
  probe.dispose();

  // Then
  const frame = snapshot.frames[0];
  assert.ok(frame !== undefined);
  const timedCalls = (stage: RenderStage) =>
    (frame.calls[RENDER_STAGES.indexOf(stage)] ?? []).reduce((total, value) => total + value, 0);
  // Node has no images, so sprite-only layers (farm soil, trees) draw nothing here; vector layers must.
  for (const stage of ["terrain.fill", "roads.ground", "roads.overlay", "walls", "walkers"] as const) {
    assert.ok(timedCalls(stage) > 0, `${stage} has canvas calls`);
  }
  assert.ok(frame.visibleTiles > 0);
  assert.ok((frame.objects.building ?? 0) > 0 && (frame.objects.palisade_segment ?? 0) > 0);
  assert.deepEqual(Object.keys(RENDER_STAGE_GROUPS).sort(), [...RENDER_STAGES].sort());
});

test("Given a page without ?phase10-proof=1 When the proof runtime installs Then no recorder exists and the canvas is untouched", () => {
  // Given
  const context = recordingContext();
  const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;

  // When
  const dispose = installPhase10ProofRuntime({
    canvas,
    cameraRef: { current: { zoom: 1, panX: 0, panY: 0 } },
    stateRef: { current: LOTS24 },
    location: { hostname: "127.0.0.1", search: "" },
  });

  // Then
  assert.equal(renderStageProbe.current, null);
  for (const method of COUNTED_CANVAS_METHODS) assert.equal(Object.prototype.hasOwnProperty.call(context, method), false);
  dispose();
});

test.after(() => coverage.disconnect());
