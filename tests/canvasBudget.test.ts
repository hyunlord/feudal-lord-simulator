import assert from "node:assert/strict";
import { test } from "node:test";

import { createCanvasBudget, type BudgetOwner } from "../src/render/canvasBudget";
import { createGroundChunkCache } from "../src/render/groundChunkCache";

// SMOOTH-2R: one byte cap over every canvas cache (canvasBudget.ts header).
const MB = 1024 * 1024;
const fakeCanvas = (width: number, height: number) => ({ width, height });
function owner(name: string, evicted: string[]): BudgetOwner { return { name, evict: key => evicted.push(`${name}:${key}`) }; }

test("SMOOTH-2R budget: over the cap the lowest rank goes first, then the least recently used; entries drawn in the last two frames stay", () => {
  const budget = createCanvasBudget(10 * MB);
  const evicted: string[] = [];
  const chunks = owner("chunks", evicted); const walkers = owner("walkers", evicted);
  budget.track(chunks, "old-zoom", 3 * MB, "otherZoom");
  budget.track(chunks, "off", 3 * MB, "offscreen");
  budget.track(walkers, "cell", 2 * MB, "onscreen");
  for (let frame = 0; frame < 3; frame += 1) budget.beginFrame();
  budget.track(chunks, "visible", 4 * MB, "onscreen");
  budget.beginFrame();
  // 12 MB over 10: the other-zoom raster goes; the rest fits.
  assert.deepEqual(evicted, ["chunks:old-zoom"]);
  assert.equal(budget.stats().bytes, 9 * MB);
  budget.track(chunks, "visible-2", 4 * MB, "onscreen");
  budget.beginFrame();
  // 13 MB: the off-screen raster goes (off screen, older than the walker cell).
  assert.deepEqual(evicted, ["chunks:old-zoom", "chunks:off"]);
  // The walker cell not drawn for frames ranks as off screen; what was drawn in the last two frames is never pushed
  // out, even over the cap.
  budget.track(chunks, "visible-3", 8 * MB, "onscreen");
  budget.touch(chunks, "visible"); budget.touch(chunks, "visible-2");
  budget.beginFrame();
  assert.deepEqual(evicted, ["chunks:old-zoom", "chunks:off", "walkers:cell"]);
  assert.equal(budget.stats().bytes, 16 * MB);
});

test("SMOOTH-2R budget: a canvas given back is taken again at the same size, pooled canvases go first and never count against room", () => {
  const budget = createCanvasBudget(10 * MB);
  const accept = (canvas: { width: number; height: number }): canvas is { width: number; height: number } & CanvasImageSource => true;
  const canvas = fakeCanvas(1024, 1024);
  budget.give(canvas as unknown as CanvasImageSource & { width: number; height: number });
  assert.equal(budget.stats().poolBytes, 4 * MB);
  assert.equal(budget.room(10 * MB), true, "pooled bytes can be freed, so they leave room");
  assert.equal(budget.take(512, 512, accept), null);
  assert.equal(budget.take(1024, 1024, accept), canvas);
  assert.equal(budget.stats().bytes, 0);
  // Over the cap the pool is released first (the backing store dropped at once).
  const evicted: string[] = [];
  budget.give(canvas as unknown as CanvasImageSource & { width: number; height: number });
  budget.track(owner("chunks", evicted), "visible", 8 * MB, "onscreen");
  budget.beginFrame();
  assert.deepEqual(evicted, []);
  assert.equal(canvas.width, 0);
  assert.equal(budget.stats().pooled, 0);
});

type Op = string;
function recordingChunkCanvas(width: number, height: number) {
  const ops: Op[] = [];
  const canvas = { width, height, ops };
  const context = new Proxy({}, { get: (_target, name) => (name === "canvas" ? canvas : name === "getTransform" ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) : (...args: unknown[]) => { ops.push(`${String(name)}(${args.length})`); }), set: (_target, name, value) => { ops.push(`set ${String(name)}(${String(value)})`); return true; } });
  return { canvas, context: context as unknown as CanvasRenderingContext2D };
}

test("SMOOTH-2R ground chunks: a re-raster draws into the chunk's own canvas, a new size takes a pooled one, and the season turns chunk by chunk without extra canvases", () => {
  const budget = createCanvasBudget(64 * MB);
  let made = 0; let clockMs = 0;
  const cache = createGroundChunkCache(((w: number, h: number) => { made += 1; return recordingChunkCanvas(w, h); }) as unknown as Parameters<typeof createGroundChunkCache>[0],
    () => clockMs, budget);
  const target = recordingChunkCanvas(512, 512);
  const diamond = [{ x: 0, y: -64 }, { x: 128, y: 0 }, { x: 0, y: 64 }, { x: -128, y: 0 }] as const;
  const request = (id: string, content: string, token: string, ms: number, scale = 1) => ({ id, contentKey: content, scale, diamond, deferKey: "base", fade: { token, ms } });
  const ids = Array.from({ length: 12 }, (_, index) => `ground:${index},0`);
  cache.beginFrame(); for (const id of ids) cache.draw(target.context, request(id, "a|s0", "s0", 1_000), () => undefined);
  assert.equal(made, 12);
  // The turn at 1x: over the turn's time each chunk re-rasters in place at its own moment.
  const turned = new Set<string>();
  for (let step = 0; step <= 10; step += 1) {
    clockMs = step * 100;
    cache.beginFrame();
    for (const id of ids) {
      cache.draw(target.context, request(id, "a|s1", "s1", 1_000), () => undefined);
      if (cache.entry(id)?.contentKey === "a|s1") turned.add(id);
    }
    if (step === 5) assert.ok(turned.size > 0 && turned.size < 12, `a wave: ${turned.size} of 12 turned half way`);
  }
  assert.equal(turned.size, 12, "all turned when the turn's time is over");
  assert.equal(made, 12, "no new canvas: every chunk re-rastered into its own");
  assert.equal(cache.stats().fades, 1);
  // A zoom bucket change (a new size): each old canvas goes to the pool; the next chunk of that size takes it.
  cache.beginFrame(); cache.draw(target.context, request(ids[0]!, "a|s1", "s1", 0, 2), () => undefined);
  assert.equal(made, 13);
  cache.beginFrame(); cache.draw(target.context, request(ids[0]!, "a|s1", "s1", 0, 1), () => undefined);
  assert.equal(made, 13, "back at scale 1: the pooled canvas of that size");
  assert.ok(cache.stats().canvasesReused >= 13);
});
