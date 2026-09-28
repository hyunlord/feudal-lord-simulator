import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { Tile } from "../src/world/world.types";
import type { ShoreLoop, Shoreline } from "../src/world/boundary/shoreline";
import { shoreline } from "../src/world/boundary/shoreline";
import { createLifeClock } from "../src/render/lifeClock";
import { WAVE29_WATER, type Wave29WaterKey } from "../src/render/wave29WaterManifest.generated";
import { setWaterArtForTest, waterFrameCanvas } from "../src/render/waterMotionArt";
import { FISH_INTERVAL_MS, clearWeather, fishRingFrame, iceSeason, liveReedsAt, waterFrame, waterFrameRect, waterMotionPlan } from "../src/render/waterMotionModel";
import { KIND, RIVER_MIN_LENGTH, RIVER_MIN_TILES, analyseWater, chunkWater } from "../src/render/waterMotionPlacement";
import { BAND_TOLERANCE, shoreBandQuads, simplifiedLoop } from "../src/render/waterShoreBand";
import { WATERLINE_ROW } from "../src/render/drawShoreline";
import { drawWaterMotion, type WaterMotionInput } from "../src/render/drawWaterMotion";
import type { GroundChunkPlan } from "../src/render/groundBoundaryScene";
import type { GameState } from "../src/engine/engine.types";
import { recordingCanvas } from "../scripts/recordingCanvas";
import { decodeSave } from "../src/save/saveCodec";

// INSTALL-29 water motion: the manifest against the batch's records, the conditions and detail levels, the frame clock
// (the wall clock, moving while paused), the fish rings' schedule, the shallow mask and the river flow, the UV clamp and
// the draw's call stream.
const BATCH = "assets-inbox/wave29/candidates-20260928";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;
    if (quoted) { if (char === "\"" && text[index + 1] === "\"") { cell += "\""; index += 1; } else if (char === "\"") quoted = false; else cell += char; continue; }
    if (char === "\"") quoted = true; else if (char === ",") { row.push(cell); cell = ""; } else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (char !== "\r") cell += char;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(entry => entry.length === header!.length).map(entry => Object.fromEntries(header!.map((key, at) => [key, entry[at] ?? ""])));
}

/** A width x height map: `water(tx, ty)` decides the water tiles. */
function map(width: number, height: number, water: (tx: number, ty: number) => boolean): Tile[] {
  const tiles: Tile[] = [];
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) tiles.push({ tx, ty, terrain: water(tx, ty) ? "water" : "grass", buildingId: null, hasRoad: false });
  return tiles;
}

test("Given the batch's records/assets.csv When the manifest is read Then every sheet's frames, fps, alpha, size, repeat and anchor match it, and the runtime bytes are the received bytes", () => {
  // Given
  const rows = parseCsv(readFileSync(`${BATCH}/records/assets.csv`, "utf8").replace(/^﻿/, ""));

  // Then
  assert.equal(rows.length, 14);
  assert.deepEqual(Object.keys(WAVE29_WATER).sort(), rows.map(row => row.id).sort());
  assert.equal(Object.values(WAVE29_WATER).reduce((sum, sheet) => sum + sheet.frames, 0), 77);
  for (const row of rows) {
    const sheet = WAVE29_WATER[row.id as Wave29WaterKey];
    assert.deepEqual([sheet.frames, sheet.fps, sheet.alpha, sheet.frameWidth, sheet.frameHeight, sheet.repeatX, sheet.repeatY, sheet.anchorX, sheet.anchorY],
      [Number(row.frame_count), Number(row.fps), Number(row.recommended_alpha), Number(row.frame_width), Number(row.frame_height), row.repeat_x === "true", row.repeat_y === "true",
        Number(row.anchor_x), Number(row.anchor_y)], row.id);
    assert.equal(sheet.offsetY, row.placement_offset_y === "" ? null : Number(row.placement_offset_y), row.id);
    assert.equal(createHash("sha256").update(readFileSync(`public/${sheet.url}`)).digest("hex"), row.sha256, row.id);
  }
  // The foam and the ice rim sit at (0, 27) of the shoreline_a 512 x 96 canvas.
  assert.deepEqual([WAVE29_WATER.shore_foam_sheet.offsetX, WAVE29_WATER.shore_foam_sheet.offsetY, WAVE29_WATER.ice_edge.offsetY], [0, 27, 27]);
});

test("Given the weather, the season and the zoom When the plan is made Then glints need a clear day, the ice rim replaces the foam in winter, and the detail levels drop the small effects", () => {
  // Clear: the engine's normal weather or none; not wet, dry or cold.
  assert.deepEqual([clearWeather("normal"), clearWeather(null), clearWeather("wet"), clearWeather("dry"), clearWeather("cold")], [true, true, false, false, false]);
  assert.equal(waterMotionPlan(1, "normal", 1).glints, true);
  assert.equal(waterMotionPlan(1, "wet", 1).glints, false);
  assert.equal(waterMotionPlan(1, "cold", 3).glints, false);
  // Winter: the ice rim (baked) instead of the foam.
  assert.deepEqual([iceSeason(0), iceSeason(1), iceSeason(2), iceSeason(3)], [false, false, false, true]);
  assert.equal(waterMotionPlan(1, "normal", 1).foam, true);
  assert.equal(waterMotionPlan(1, "normal", 3).foam, false);
  // Full detail: everything; simplified: the area fills only; blocks: nothing.
  assert.deepEqual(waterMotionPlan(1, "normal", 1), { deepRipples: true, shallowRipples: true, flow: true, foam: true, reeds: true, glints: true, fish: true });
  assert.deepEqual(waterMotionPlan(0.6, "normal", 1), { deepRipples: true, shallowRipples: false, flow: true, foam: false, reeds: false, glints: false, fish: false });
  assert.deepEqual(Object.values(waterMotionPlan(0.5, "normal", 1)), [false, false, false, false, false, false, false]);
  assert.deepEqual([liveReedsAt(0.7), liveReedsAt(0.75)], [false, true]);
});

test("Given the wall clock When a sheet's frame is picked Then it steps at the sheet's fps, a static sheet stays at 0, and it keeps moving while the paused game holds the life clock", () => {
  // At 4 fps the ripple (8 frames) steps every 250 ms and loops after 2 s; the flow (6 fps, 6 frames) loops each second.
  assert.deepEqual([0, 249, 250, 1_999, 2_000].map(ms => waterFrame("ripple_sheet", ms)), [0, 0, 1, 7, 0]);
  assert.deepEqual([0, 166, 167, 999, 1_000].map(ms => waterFrame("current_arrows_se_sheet", ms)), [0, 0, 1, 5, 0]);
  assert.equal(waterFrame("ice_edge", 12_345), 0);
  assert.equal(waterFrame("sparkle", 0, 500), 3);
  // Paused: the life clock holds, the water (wall clock) does not.
  const life = createLifeClock();
  life(1_000, true);
  const held = [1_100, 1_350, 1_600].map(ms => life(ms, false));
  assert.deepEqual(held, [0, 0, 0]);
  assert.deepEqual([1_100, 1_350, 1_600].map(ms => waterFrame("ripple_sheet", ms)), [4, 5, 6]);
});

test("Given the render path's sources When the clock is handed to the water Then the renderer passes its wall clock nowMs, never the life clock", async () => {
  const renderer = await readFile("src/render/renderer.ts", "utf8");
  const ground = await readFile("src/render/drawTerrainBoundaryV2.ts", "utf8");
  assert.match(renderer, /drawTerrain\([\s\S]*?nowMs: input\.nowMs \?\? 0[\s\S]*?\}\);/);
  const call = ground.slice(ground.indexOf("drawWaterMotion(context"), ground.indexOf("season });", ground.indexOf("drawWaterMotion(context")));
  assert.match(call, /nowMs: input\.nowMs \?\? 0/);
  assert.doesNotMatch(call, /lifeClock/);
});

test("Given a spot's hash When the fish ring schedule is read Then it is deterministic, plays one whole cycle per period of 8-20 s and is blank between rings", () => {
  for (const hash of [1, 77, 12_345, 987_654_321]) {
    const period = FISH_INTERVAL_MS.min + (hash % (FISH_INTERVAL_MS.max - FISH_INTERVAL_MS.min + 1));
    assert.ok(period >= 8_000 && period <= 20_000);
    const frames: (number | null)[] = [];
    for (let ms = 0; ms < period * 10; ms += 50) frames.push(fishRingFrame(hash, ms));
    assert.deepEqual(frames, Array.from({ length: frames.length }, (_, at) => fishRingFrame(hash, at * 50)), "same inputs, same frames");
    // Each ring runs 0..5 in order (20 samples of 50 ms = 1 s at 6 fps); rings are counted by their first frame.
    const starts = frames.filter((frame, at) => frame !== null && (at === 0 || frames[at - 1] === null)).length;
    assert.ok(starts >= 9 && starts <= 11, `${hash}: ${starts} rings in 10 periods`);
    assert.ok(frames.filter(frame => frame === null).length > frames.length * 0.85, "mostly still water");
    // One ring: 1 s (19-21 samples of 50 ms), frames 0..5 in order.
    const ring = frames.findIndex((frame, at) => frame !== null && at > 0 && frames[at - 1] === null);
    const end = frames.findIndex((frame, at) => at > ring && frame === null);
    const cycle = frames.slice(ring, end) as number[];
    assert.ok(cycle.length >= 19 && cycle.length <= 21, `${cycle.length} samples`);
    assert.deepEqual([...new Set(cycle)], [0, 1, 2, 3, 4, 5]);
    assert.ok(cycle.every((frame, at) => at === 0 || frame >= (cycle[at - 1] ?? 0)));
  }
});

test("Given a lake When its water is classed Then deep water keeps a tile from the land, the shallow mask is the shore's tiles on both sides, and every water tile has one class", () => {
  // Given: a 12 x 10 lake in a 20 x 20 map.
  const tiles = map(20, 20, (tx, ty) => tx >= 4 && tx < 16 && ty >= 5 && ty < 15);

  // When
  const water = analyseWater(tiles, 20, 20);

  // Then
  for (const tile of tiles) {
    const kind = water.kind[tile.ty * 20 + tile.tx];
    const shoreDistance = Math.min(tile.tx - 4, 15 - tile.tx, tile.ty - 5, 14 - tile.ty);
    if (tile.terrain === "water") assert.equal(kind, shoreDistance === 0 ? KIND.shallow : KIND.deep, `${tile.tx},${tile.ty}`);
    else assert.equal(kind, shoreDistance === -1 || (Math.min(tile.tx - 3, 16 - tile.tx) >= 0 && Math.min(tile.ty - 4, 15 - tile.ty) >= 0) ? KIND.shallow : KIND.none, `${tile.tx},${tile.ty}`);
  }
  assert.equal(water.flow.every(direction => direction === null), true, "a lake has no river");
  // The chunks list the classes; glints and fish only on deep tiles.
  const chunk = chunkWater(water, tiles, 7, 1, 1);
  assert.ok(chunk.deep.length > 0 && chunk.shallow.length > 0);
  const deepCentres = new Set(chunk.deep.map(tile => `${(tile.tx - tile.ty) * 32},${(tile.tx + tile.ty) * 16}`));
  assert.ok(deepCentres.size === chunk.deep.length);
});

test("Given a lake draining through a narrow channel When the river is read Then the channel's tiles are river flowing away from the lake, down each iso axis", () => {
  // Given: a lake (x 2..9) and a 2-wide channel east from it along +x (x 10..21), and one along +y (y 12..23).
  const east = map(24, 24, (tx, ty) => (tx >= 2 && tx < 10 && ty >= 2 && ty < 10) || (tx >= 10 && tx < 22 && ty >= 5 && ty < 7));
  const south = map(24, 24, (tx, ty) => (tx >= 2 && tx < 10 && ty >= 2 && ty < 10) || (ty >= 10 && ty < 22 && tx >= 5 && tx < 7));

  // When
  const eastWater = analyseWater(east, 24, 24); const southWater = analyseWater(south, 24, 24);

  // Then: +x is screen south-east, +y screen south-west.
  for (let tx = 12; tx < 21; tx += 1) for (const ty of [5, 6]) {
    assert.equal(eastWater.kind[ty * 24 + tx], KIND.river, `${tx},${ty}`);
    assert.equal(eastWater.flow[ty * 24 + tx], "se", `${tx},${ty}`);
  }
  for (let ty = 12; ty < 21; ty += 1) assert.equal(southWater.flow[ty * 24 + 5], "sw", `5,${ty}`);
  // One stream: every river tile of each channel, the junction and the last tile too, flows the same way.
  assert.deepEqual([...new Set(eastWater.flow.filter(direction => direction !== null))], ["se"]);
  assert.deepEqual([...new Set(southWater.flow.filter(direction => direction !== null))], ["sw"]);
  // The lake is no river, and a short tip under RIVER_MIN_TILES is none either.
  assert.equal(eastWater.kind[5 * 24 + 5], KIND.deep);
  const tip = map(24, 24, (tx, ty) => (tx >= 2 && tx < 10 && ty >= 2 && ty < 10) || (tx >= 10 && tx < 10 + Math.floor((RIVER_MIN_TILES - 1) / 2) && ty >= 5 && ty < 7));
  assert.equal(analyseWater(tip, 24, 24).flow.every(direction => direction === null), true);
});

test("Given a lake with a short narrow bay When the river is read Then the bay is still water: a river runs at least RIVER_MIN_LENGTH from its upstream end", () => {
  // Given: a 3 x 3 bay off the lake (9 tiles, narrow across, 2 steps long), and the palisade-construction save's south bay.
  const bay = map(24, 24, (tx, ty) => (tx >= 2 && tx < 10 && ty >= 2 && ty < 10) || (tx >= 10 && tx < 13 && ty >= 5 && ty < 8));
  const save = decodeSave(readFileSync("fixtures/saves/v26/palisade-construction.save.json")).envelope.state;

  // When
  const bayWater = analyseWater(bay, 24, 24); const saveWater = analyseWater(save.tiles, save.width, save.height);

  // Then: no river tile in either; the bay's tiles are the lake's shallow and deep classes.
  assert.ok(9 >= RIVER_MIN_TILES && RIVER_MIN_LENGTH > 2);
  assert.equal(bayWater.kind.includes(KIND.river), false);
  assert.equal(saveWater.kind.includes(KIND.river), false);
  assert.deepEqual([bayWater.kind[6 * 24 + 11], bayWater.kind[6 * 24 + 12]], [KIND.deep, KIND.shallow]);
});

test("Given every sheet When a frame is cut Then its source rect lies inside that frame of the one-row sheet, so no draw samples a neighbour frame", () => {
  // The rects tile the sheet: frame i is [i w, (i + 1) w) x [0, h), wrapping frame indexes.
  for (const key of Object.keys(WAVE29_WATER) as Wave29WaterKey[]) {
    const sheet = WAVE29_WATER[key];
    for (let frame = -sheet.frames; frame < sheet.frames * 2; frame += 1) {
      const rect = waterFrameRect(key, frame);
      const index = ((frame % sheet.frames) + sheet.frames) % sheet.frames;
      assert.deepEqual(rect, { x: index * sheet.frameWidth, y: 0, width: sheet.frameWidth, height: sheet.frameHeight }, `${key} ${frame}`);
    }
  }
  // The cut copies exactly that rect, unsmoothed, into the frame's own canvas (the draws then use the whole canvas).
  const cuts: string[] = [];
  const image = { label: "sheet" } as unknown as CanvasImageSource;
  setWaterArtForTest(() => image, (width, height) => {
    const recording = recordingCanvas(width, height);
    return { canvas: { label: `frame${cuts.length}`, width, height } as unknown as CanvasImageSource, context: new Proxy(recording.context, {
      get(target, key) { if (key === "drawImage") return (...args: unknown[]) => { cuts.push(args.slice(1).map(Number).join(",")); }; return Reflect.get(target, key); },
    }) };
  });
  try {
    waterFrameCanvas("shore_foam_sheet", 5); waterFrameCanvas("shore_foam_sheet", 5); waterFrameCanvas("reeds_sway_c_sheet", 2);
    assert.deepEqual(cuts, ["2560,0,512,32,0,0,512,32", "192,0,96,96,0,0,96,96"], "one cut per frame, inside the frame");
  } finally { setWaterArtForTest(null); }
});

test("Given a straight shore When the foam band quads are made Then they follow the shore strip's mapping: rows 27-59 across the waterline, texture u along the shore", () => {
  // Given: a 6 x 6 pond; its loop's first segment.
  const tiles = map(12, 12, (tx, ty) => tx >= 3 && tx < 9 && ty >= 3 && ty < 9);
  const loop = shoreline({ width: 12, height: 12, tiles, seed: 3, bridges: [] }).loops[0] as ShoreLoop;
  const sheet = WAVE29_WATER.shore_foam_sheet;

  // When
  const quads = shoreBandQuads(loop, sheet.offsetY, sheet.offsetY + sheet.frameHeight, sheet.frameWidth, false);

  // Then: the simplified line keeps the shore within BAND_TOLERANCE with fewer quads; each quad spans the band's 32
  // rows across (the pattern's v axis is as long as its land-to-water edge) and the waterline (strip row 42, band row
  // 15) runs on the smoothed shore.
  assert.ok(quads.length >= 4 && quads.length < loop.smoothed.length, `${quads.length} quads for ${loop.smoothed.length} points`);
  const shore = loop.smoothed.map(point => [(point.x - point.y) * 32, (point.x + point.y) * 16] as const);
  for (const quad of quads) {
    const { c, d } = quad.matrix;
    const across = Math.hypot(c * sheet.frameHeight, d * sheet.frameHeight);
    const [land, water] = [quad.corners[0]!, quad.corners[3]!];
    assert.ok(Math.abs(across - Math.hypot(land[0] - water[0], land[1] - water[1])) < 1.5, `band height ${across}`);
    const share = (WATERLINE_ROW - sheet.offsetY) / sheet.frameHeight;
    const waterline = [land[0] + (water[0] - land[0]) * share, land[1] + (water[1] - land[1]) * share];
    const near = Math.min(...shore.map(([x, y]) => Math.hypot(x - waterline[0]!, y - waterline[1]!)));
    assert.ok(near < 2, `waterline ${near} px off the shore`);
  }
  assert.ok(simplifiedLoop(loop.smoothed, loop.walled, BAND_TOLERANCE).points.every(point => loop.smoothed.includes(point)));
});

class RecordingPath { static made = 0; readonly label = `path${RecordingPath.made++}`; moveTo(): void {} lineTo(): void {} closePath(): void {} addPath(): void {} }

function drawOnce(input: Partial<WaterMotionInput>, zoom: number): string[] {
  const tiles = map(24, 24, (tx, ty) => tx >= 2 && tx < 20 && ty >= 2 && ty < 20);
  const shore: Shoreline = shoreline({ width: 24, height: 24, tiles, seed: 5, bridges: [] });
  const chunks = [0, 1, 2].flatMap(cy => [0, 1, 2].map(cx => ({ cx, cy, waterLoops: [0], waterParity: false }) as unknown as GroundChunkPlan));
  const { canvas, context } = recordingCanvas(4_000, 4_000);
  context.translate(1_500, 100);
  drawWaterMotion(context, { state: { tiles, seed: 5, width: 24, height: 24 } as unknown as GameState, shore, chunks, range: { minTx: 0, minTy: 0, maxTx: 23, maxTy: 23 },
    zoom, chunkZoom: zoom, nowMs: 1_234, weather: "normal", season: 1, ...input });
  return canvas.ops;
}

test("Given loaded water art When the water moves Then each effect draws at its alpha only under its condition, and the detail levels draw less", () => {
  const images = new Map<string, CanvasImageSource>();
  setWaterArtForTest(key => { if (!images.has(key)) images.set(key, { label: key } as unknown as CanvasImageSource); return images.get(key) ?? null; },
    (width, height) => ({ canvas: { label: `cut${width}x${height}`, width, height } as unknown as CanvasImageSource, context: recordingCanvas(width, height).context }));
  const previous = (globalThis as { Path2D?: unknown }).Path2D;
  (globalThis as { Path2D?: unknown }).Path2D = RecordingPath;
  try {
    // When
    const summer = drawOnce({}, 1); const winter = drawOnce({ season: 3 }, 1); const wet = drawOnce({ weather: "wet" }, 1);
    const simplified = drawOnce({}, 0.6); const blocks = drawOnce({}, 0.5);

    // Then: the ripples fill the deep diamonds and, clipped to the water, the shallow ones; the foam fills a quad a segment at 0.65.
    assert.ok(summer.some(op => op.startsWith("clip(path")), "clipped to the water");
    assert.ok(summer.filter(op => op.startsWith("fill(path")).length >= 2, "deep and shallow ripple fills");
    assert.ok(summer.includes("set globalAlpha(0.65)"), "foam at its recommended alpha");
    assert.ok(summer.includes("set globalAlpha(0.4)"), "glints at 0.4 on a clear day");
    assert.ok(summer.some(op => op.startsWith("drawImage(cut96x96")), "swaying reeds");
    // Fish rings come and go: over 20 s of the wall clock some frames draw a ring (48 x 24 at 0.45), most do not.
    const ringFrames = Array.from({ length: 200 }, (_, at) => drawOnce({ nowMs: at * 100 }, 1).some(op => op.startsWith("drawImage(cut48x24")));
    assert.ok(ringFrames.some(Boolean) && ringFrames.filter(Boolean).length < ringFrames.length, `${ringFrames.filter(Boolean).length} of 200 frames with a ring`);
    assert.equal(winter.includes("set globalAlpha(0.65)"), false, "no foam in winter");
    assert.equal(wet.includes("set globalAlpha(0.4)"), false, "no glints on a wet day");
    assert.equal(simplified.some(op => op.startsWith("drawImage")), false, "no sprites when simplified");
    assert.equal(simplified.some(op => op.startsWith("fill(path")), true, "the deep ripples stay");
    assert.deepEqual(blocks, ["translate(1500,100)"], "nothing at blocks detail");
    // Deterministic: the same frame draws the same calls.
    assert.deepEqual(drawOnce({}, 1).filter(op => !op.includes("path")), summer.filter(op => !op.includes("path")));
  } finally {
    (globalThis as { Path2D?: unknown }).Path2D = previous;
    setWaterArtForTest(null);
  }
});
