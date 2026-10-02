/**
 * LAND-UI the lands' ground (Wave 22, archetypeGroundModel.ts / archetypeGroundDraw.ts): every key the MA-5 layer
 * produces resolves to an installed file in every season, the season map (LU-D1), drained ground as meadow (LU-D5), the
 * layer cache and the chunk key, the riverside left out (LU-D2), the chalk downs' dry-stone field edges (countryside),
 * and the draw calls one land chunk adds.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { MAP_ARCHETYPE_IDS, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { chunkHash, fillArtKey, fillVariant, landArtKeys, landGroundOf, loopStrips, stripFamily, wave22Season } from "../src/render/archetypeGroundModel";
import { drawLandDecals, drawLandEdges, drawLandFills, drawLandShoreStrips, landArtReadiness } from "../src/render/archetypeGroundDraw";
import { countrysideOf } from "../src/render/countrysideLayout";
import { chunkRegions, fillRegions } from "../src/render/archetypeGroundRegions";
import { warpPoint } from "../src/render/landRegionWarp";
import { pointInPolygon } from "../src/render/groundSceneParts";
import { groundBoundaryScene } from "../src/render/groundBoundaryScene";
import { WAVE22_GROUND_IMAGES, type Wave22GroundKey } from "../src/render/wave22GroundManifest.generated";
import { GROUND_CHUNK_TILES } from "../src/render/groundSceneParts";
import type { SeasonIndex } from "../src/render/seasonArt";

const land = (archetypeId: string, seed: number): GameState => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed: archetypeId === RIVERSIDE_ARCHETYPE_ID ? 1 : seed });
  assert.ok(state !== null, archetypeId);
  return state;
};
const NEW_LANDS = MAP_ARCHETYPE_IDS.filter(id => id !== RIVERSIDE_ARCHETYPE_ID);
/** The tile-plane point the land's warp takes to `point` (fixed-point iteration: the warp's offset changes slowly). */
const unwarp = (ground: { seed: number; width: number; height: number }, point: { x: number; y: number }) => {
  let x = point;
  for (let step = 0; step < 30; step += 1) { const w = warpPoint({ seed: ground.seed, width: ground.width, height: ground.height, scale: 1 }, x); x = { x: point.x - (w.x - x.x), y: point.y - (w.y - x.y) }; }
  return x;
};
const SEASONS: readonly SeasonIndex[] = [0, 1, 2, 3];
const installed = (key: string): boolean => {
  const meta = (WAVE22_GROUND_IMAGES as Record<string, { readonly url: string } | undefined>)[key];
  return meta !== undefined && existsSync(new URL(`../public/${meta.url}`, import.meta.url));
};

test("every key the layer produces on five lands x seeds 1-3 resolves to an installed Wave 22 file in every season", () => {
  for (const id of MAP_ARCHETYPE_IDS) for (const seed of [1, 2, 3]) {
    const state = land(id, seed);
    const ground = landGroundOf(state);
    if (id === RIVERSIDE_ARCHETYPE_ID) { assert.equal(ground, null, "the riverside has no land layer"); continue; }
    assert.ok(ground !== null, id);
    for (const [index, key] of ground.keys.entries()) {
      if (key === "none" || key === "terrain/grass") continue;
      for (const season of SEASONS) {
        const base = ground.fillBase[index];
        const files = base !== null && base !== undefined ? [fillArtKey(base, season, "a"), fillArtKey(base, season, "b")]
          : stripFamily(key) !== null ? [`${stripFamily(key)}_a`, `${stripFamily(key)}_b`] : [key];
        for (const file of files) assert.ok(installed(file), `${id} seed ${seed} ${key} season ${season}: ${file}`);
      }
    }
    for (const season of SEASONS) for (const file of landArtKeys(ground, season)) assert.ok(installed(file), `${id} ${file}`);
  }
});

test("the installed set is exactly what the layer can name: no v1 fill, no unnamed decal", () => {
  const keys = Object.keys(WAVE22_GROUND_IMAGES);
  assert.equal(keys.length, 79);
  assert.ok(keys.every(key => !/-v[0-9]$/.test(key) && !key.includes("heath_patch_b") && !key.includes("heath_patch_c")));
  assert.equal(keys.filter(key => key.startsWith("terrain/")).length, 30);
  for (const key of keys) {
    const meta = WAVE22_GROUND_IMAGES[key as Wave22GroundKey];
    if (meta.folder === "decals" || meta.folder === "props") assert.deepEqual(meta.pivot, { x: meta.width / 2, y: meta.height - 8 }, key);
  }
  const startup = readFileSync(new URL("../src/render/preloadGameArt.ts", import.meta.url), "utf8");
  assert.ok(!startup.includes("wave22"), "Wave 22 loads on first draw, not in the startup preload");
});

test("LU-D1: spring and summer draw the summer files, autumn and winter their own", () => {
  assert.deepEqual(SEASONS.map(wave22Season), ["summer", "summer", "autumn", "winter"]);
  assert.equal(fillArtKey("chalk_down", 0, "b"), "terrain/chalk_down_summer_b");
  assert.equal(fillArtKey("fen", 3, "a"), "terrain/fen_winter_a");
});

test("a / b is one pick per 2 x 2 tile block (the fill's repeat cell), both used", () => {
  const picks = new Set<string>();
  for (let ty = 0; ty < 64; ty += 2) for (let tx = 0; tx < 64; tx += 2) {
    const variant = fillVariant(1, tx, ty);
    picks.add(variant);
    assert.equal(fillVariant(1, tx + 1, ty), variant); assert.equal(fillVariant(1, tx, ty + 1), variant); assert.equal(fillVariant(1, tx + 1, ty + 1), variant);
  }
  assert.deepEqual([...picks].sort(), ["a", "b"]);
});

test("LU-D5: drained cells read as meadow, and the layer follows the terrain, not only (land, seed)", () => {
  const fen = land("core:fen_drainage", 1);
  const ground = landGroundOf(fen)!;
  const meadow = ground.keys.indexOf("terrain/grass");
  const fenFill = ground.keys.indexOf("terrain/fen");
  const cell = ground.fill.findIndex(value => value === fenFill);
  assert.ok(cell >= 0);
  const drained: GameState = { ...fen, tiles: [...fen.tiles], drainage: { works: [], drained: [cell] } };
  const after = landGroundOf(drained)!;
  assert.notEqual(after, ground);
  assert.equal(after.fill[cell], meadow);
  assert.equal(after.band[cell], 0); assert.equal(after.decal[cell], 0);
  // Drainage turns water to grass: a new terrain is a new layer; a new tiles array with the same terrain reuses it.
  const water = fen.tiles.findIndex(tile => tile.terrain === "water");
  const dried: GameState = { ...fen, tiles: fen.tiles.map((tile, index) => (index === water ? { ...tile, terrain: "grass" } : tile)) };
  const changed = landGroundOf(dried)!;
  assert.notEqual(changed, ground);
  assert.ok(changed.fill[water] !== 0);
  const roadOnly: GameState = { ...dried, tiles: dried.tiles.map(tile => ({ ...tile })) };
  assert.equal(landGroundOf(roadOnly), changed);
});

test("LU-D2 / N5-D1: the riverside never enters the land code (no layer); its chunk token is its rock region's alone", () => {
  assert.equal(landGroundOf(DEFAULT_GAME_STATE), null);
  assert.equal(landGroundOf(land(RIVERSIDE_ARCHETYPE_ID, 1)), null);
  assert.equal(landGroundOf({ ...DEFAULT_GAME_STATE, archetypeId: RIVERSIDE_ARCHETYPE_ID }), null);
  const source = readFileSync(new URL("../src/render/drawTerrainBoundaryV2.ts", import.meta.url), "utf8");
  assert.match(source, /land === null \? riversideRockToken\(input\.state, plan\) : landChunkToken\(/);
  assert.match(source, /land === null \? undefined : landShoreStrips\(/);
  for (const call of ["drawLandFills", "drawLandEdges", "drawLandDecals"]) assert.match(source, new RegExp(`if \\(land !== null\\) ${call}\\(`), call);
});

test("the chunk hash names the land's tiles in the chunk and its ring, and differs between lands on the same seed", () => {
  const coast = land("core:coastal_port", 1); const downs = land("core:chalk_downs", 1);
  const coastScene = groundBoundaryScene(coast); const coastGround = landGroundOf(coast)!;
  const coastHashes = coastScene.chunks.map(plan => chunkHash(coastGround, plan, coastScene.shore));
  const downsScene = groundBoundaryScene(downs); const downsGround = landGroundOf(downs)!;
  const downsHashes = downsScene.chunks.map(plan => chunkHash(downsGround, plan, downsScene.shore));
  assert.ok(coastHashes.some((hash, index) => hash !== downsHashes[index]));
  assert.equal(chunkHash(downsGround, downsScene.chunks[10]!, downsScene.shore), downsHashes[10]);
  // The coast's sea loops carry shore strips; at least one other water loop keeps the old strip or none exists.
  const strips = coastScene.shore.loops.map((_, index) => loopStrips(coastGround, coastScene.shore, index));
  assert.ok(strips.some(families => families !== null && families.every(family => family.startsWith("shore/"))));
});

test("the fill regions cover their own tiles and leave the meadow: smoothed outlines, inside by the count of loops", () => {
  for (const id of NEW_LANDS) {
    const state = land(id, 1); const ground = landGroundOf(state)!;
    for (const region of fillRegions(ground)) {
      const own = (index: number) => ground.fillBase[ground.fill[index]!] === region.base;
      const meadowOrOther = (index: number) => ground.fill[index] !== 0 && !own(index);
      let checked = 0;
      for (let ty = 1; ty < state.height - 1; ty += 1) for (let tx = 1; tx < state.width - 1; tx += 1) {
        const block = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (ty + dy) * state.width + tx + dx));
        const inside = block.every(own); const outside = block.every(meadowOrOther);
        if (!inside && !outside) continue;
        const enclosing = region.loops.filter(loop => pointInPolygon({ x: tx, y: ty }, loop.smoothed)).length;
        assert.equal((enclosing % 2 === 0) === region.outside, inside, `${id} ${region.base} at ${tx},${ty}`);
        checked += 1;
      }
      assert.ok(checked > 50, `${id} ${region.base}: ${checked}`);
    }
    // The strips' sides: the named ground (the strip's bottom) on the left of travel, the meadow on the right.
    for (const region of fillRegions(ground)) for (const loop of region.loops) {
      let left = 0, right = 0, total = 0;
      loop.strips.forEach((strip, index) => {
        if (strip === null) return;
        const a = loop.smoothed[index]!; const b = loop.smoothed[(index + 1) % loop.smoothed.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1; const t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
        // NAT-5: the outline is warped (landRegionWarp.ts); the sample point is taken back to the tile plane first.
        const at = (sign: number) => { const tile = unwarp(ground, { x: (a.x + b.x) / 2 + sign * t.y * 0.4, y: (a.y + b.y) / 2 - sign * t.x * 0.4 });
          return Math.round(tile.y) * state.width + Math.round(tile.x); };
        total += 1;
        if (ground.fillBase[ground.fill[at(1)]!] === region.base) left += 1;
        if (ground.fillBase[ground.fill[at(-1)]!] !== region.base) right += 1;
      });
      if (total > 20) assert.ok(left / total > 0.8 && right / total > 0.8, `${id} ${region.base}: ${left}/${right}/${total}`);
    }
    // Every chunk inside a region without an outline through it fills the chunk box.
    const scene = groundBoundaryScene(state);
    for (const plan of scene.chunks) for (const part of chunkRegions(ground, plan)) assert.ok(part.loops.length > 0 || part.parity);
  }
});

test("the chalk downs' field edges are dry-stone walls; the riverside keeps its hedges (the cache keys on the land)", () => {
  const town = decodeSave(readFileSync(new URL("../fixtures/saves/v26/four-farms.save.json", import.meta.url))).envelope.state;
  const hedged = countrysideOf(town).strips.filter(piece => piece.family !== "baulk");
  assert.ok(hedged.length > 0 && hedged.every(piece => piece.family.startsWith("hedgerow")));
  const downs = countrysideOf({ ...town, archetypeId: "core:chalk_downs" }).strips.filter(piece => piece.family !== "baulk");
  assert.ok(downs.length > 0 && downs.every(piece => piece.family === "dry_stone_wall"));
  assert.ok(countrysideOf(town).strips.filter(piece => piece.family !== "baulk").every(piece => piece.family.startsWith("hedgerow")));
});

test("the land's first readiness check starts every season's art loading (the turn's staging then finds it ready)", () => {
  const requested = new Set<string>();
  // The first test here to touch the art: manifestArt keeps its entries for the file's later tests.
  (globalThis as unknown as { Image: unknown }).Image = class { naturalWidth = 512; naturalHeight = 64; onload: (() => void) | null = null; onerror: unknown = null;
    set src(url: string) { requested.add(url); queueMicrotask(() => this.onload?.()); } };
  const ground = landGroundOf({ ...land("core:chalk_downs", 2), tiles: [...land("core:chalk_downs", 2).tiles] })!;
  landArtReadiness(ground, 1);
  for (const season of SEASONS) for (const key of landArtKeys(ground, season)) {
    assert.ok([...requested].some(url => url.endsWith(WAVE22_GROUND_IMAGES[key].url)), `${key} requested`);
  }
});

/** A context that counts the calls a chunk raster pays (fills, image draws) and keeps patterns inert. */
function countingContext() {
  const counts = { fill: 0, drawImage: 0, setTransform: 0 };
  const context = {
    fillStyle: "" as unknown, globalAlpha: 1, imageSmoothingEnabled: true,
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, transform() {}, clip() {},
    fill() { counts.fill += 1; },
    drawImage() { counts.drawImage += 1; },
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createPattern: () => ({ setTransform() { counts.setTransform += 1; } }),
  };
  return { context: context as unknown as CanvasRenderingContext2D, counts };
}

test("draw calls one land chunk adds: two fills per fill region, four for the rock, one per strip quad, one blit per decal", () => {
  // Node has no Image: a stand-in that is loaded at once, so the land's art is ready.
  (globalThis as unknown as { Image: unknown }).Image = class { naturalWidth = 512; naturalHeight = 64; onload: (() => void) | null = null; onerror: unknown = null;
    set src(_url: string) { queueMicrotask(() => this.onload?.()); } };
  return new Promise<void>(resolve => {
    for (const id of NEW_LANDS) { const ground = landGroundOf(land(id, 1))!; for (const season of SEASONS) landArtReadiness(ground, season); }
    setTimeout(() => {
      const report: Record<string, unknown> = {};
      for (const id of NEW_LANDS) {
        const state = land(id, 1); const ground = landGroundOf(state)!; const scene = groundBoundaryScene(state);
        // The busiest chunk of the land: the most decals, strips and fills.
        let worst = { fills: 0, quads: 0, decals: 0, total: 0, chunk: "" };
        for (const plan of scene.chunks) {
          const { context, counts } = countingContext();
          drawLandFills(context, ground, plan, { left: -1e4, top: -1e4, right: 1e4, bottom: 1e4 }, 1);
          const fills = counts.fill;
          const edgeQuads = drawLandEdges(context, ground, plan, 1);
          const shoreQuads = drawLandShoreStrips(context, ground, scene.shore, plan.waterLoops, { left: plan.cx * 8 - 0.5, top: plan.cy * 8 - 0.5, right: plan.cx * 8 + 7.5, bottom: plan.cy * 8 + 7.5 });
          const decals = drawLandDecals(context, ground, state.tiles, plan);
          assert.equal(counts.fill, fills + edgeQuads + shoreQuads);
          const total = counts.fill + counts.drawImage;
          if (total > worst.total) worst = { fills, quads: edgeQuads + shoreQuads, decals, total, chunk: `${plan.cx},${plan.cy}` };
          // NAT-5: the rock adds its rim and its body, each the colour and the texture (landRockRegions.ts).
          assert.ok(fills <= 2 * 3 + 4, `${id} ${plan.cx},${plan.cy}: ${fills} fill passes`);
        }
        report[id] = worst;
      }
      console.log(JSON.stringify({ busiestChunkAddedCalls: report }));
      resolve();
    }, 20);
  });
});

test("a fen work drying a mere moves the deferKey (groundLocalKey) only of the chunks near it; the rest re-raster through the budget", async () => {
  const { gunzipSync } = await import("node:zlib");
  const { migrateSaveToLatest } = await import("../src/save/migrations/index");
  const { advanceTick } = await import("../src/engine/tick");
  const raw = JSON.parse(gunzipSync(readFileSync(new URL("../fixtures/perf-gate/fen_drainage-works.save.json.gz", import.meta.url))).toString("utf8"));
  let state = (migrateSaveToLatest(raw).value as { state: GameState }).state;
  let before = state;
  for (let ticks = 0; ticks < 2_000; ticks += 1) {
    const next = advanceTick(state);
    if ((next.drainage?.drained.length ?? 0) > (state.drainage?.drained.length ?? 0)) { before = state; state = next; break; }
    state = next;
  }
  const after = state;
  assert.ok((after.drainage?.drained.length ?? 0) > (before.drainage?.drained.length ?? 0), "the work finishes");
  const fresh = new Set((after.drainage?.drained ?? []).filter(cell => !(before.drainage?.drained ?? []).includes(cell)));
  const a = groundBoundaryScene(before).chunks; const b = groundBoundaryScene(after).chunks;
  const changed = a.filter((plan, index) => plan.groundLocalKey !== b[index]!.groundLocalKey);
  const reach = (plan: { cx: number; cy: number }) => [...fresh].some(cell => {
    const tx = cell % after.width, ty = Math.floor(cell / after.width);
    return tx >= plan.cx * GROUND_CHUNK_TILES - 5 && tx < (plan.cx + 1) * GROUND_CHUNK_TILES + 5 && ty >= plan.cy * GROUND_CHUNK_TILES - 5 && ty < (plan.cy + 1) * GROUND_CHUNK_TILES + 5;
  });
  assert.ok(changed.length > 0 && changed.every(reach), `local keys changed: ${changed.map(plan => `${plan.cx},${plan.cy}`).join(" ")}`);
  assert.ok(a.filter((plan, index) => plan.groundBaseKey !== b[index]!.groundBaseKey).length > changed.length, "the whole-loop key still moves further out");
});


test("LU-D11: the edge bands' feather is 0 outside the paint, a smooth hump inside it that peaks below opaque", async () => {
  const { EDGE_BAND_PEAK, EDGE_FEATHER_ROWS, EDGE_PAINT_BOTTOM, EDGE_PAINT_TOP, edgeFeatherAlpha } = await import("../src/render/landEdgeBand");
  const rows = Array.from({ length: 64 }, (_, row) => edgeFeatherAlpha(row));
  for (let row = 0; row < EDGE_PAINT_TOP; row += 1) assert.equal(rows[row], 0, `row ${row}`);
  for (let row = EDGE_PAINT_BOTTOM + 1; row < 64; row += 1) assert.equal(rows[row], 0, `row ${row}`);
  assert.ok(EDGE_BAND_PEAK > 0.5 && EDGE_BAND_PEAK < 1);
  assert.ok(Math.max(...rows) <= EDGE_BAND_PEAK + 1e-9 && Math.max(...rows) > EDGE_BAND_PEAK * 0.98, "no row is opaque; the middle is near the peak");
  const middle = (EDGE_PAINT_TOP + EDGE_PAINT_BOTTOM) / 2;
  for (let row = EDGE_PAINT_TOP; row < Math.floor(middle); row += 1) assert.ok(rows[row]! > 0 && rows[row + 1]! > rows[row]!, `rise ${row}`);
  for (let row = Math.ceil(middle) + 1; row <= EDGE_PAINT_BOTTOM; row += 1) assert.ok(rows[row]! > 0 && rows[row]! < rows[row - 1]!, `fall ${row}`);
  // Symmetric about the paint's middle.
  for (let k = 0; k < EDGE_FEATHER_ROWS; k += 1) assert.ok(Math.abs(rows[EDGE_PAINT_TOP + k]! - rows[EDGE_PAINT_BOTTOM - k]!) < 1e-9, `k ${k}`);
});

test("LU-D11: edge bands are laid 2.5 times as wide across the edge (128 px per tile along it); shore and reed strips keep their width", async () => {
  const { EDGE_BAND_WIDEN } = await import("../src/render/landEdgeBand");
  assert.equal(EDGE_BAND_WIDEN, 2.5);
  // The pattern's v axis in tile units from its screen transform (c, d) = iso(vAxis).
  const across = (c: number, d: number) => { const x = (c / 32 + d / 16) / 2; const y = (d / 16 - c / 32) / 2; return Math.hypot(x, y); };
  const along = (a: number, b: number) => across(a, b);
  const record = () => {
    const transforms: { a: number; b: number; c: number; d: number }[] = [];
    const context = { fillStyle: "" as unknown, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, save() {}, restore() {}, clip() {},
      createPattern: () => ({ setTransform(matrix: { a: number; b: number; c: number; d: number }) { transforms.push(matrix); } }) };
    return { context: context as unknown as CanvasRenderingContext2D, transforms };
  };
  for (const id of ["core:chalk_downs", "core:fen_drainage"]) {
    const state = land(id, 1); const ground = landGroundOf(state)!; const scene = groundBoundaryScene(state);
    const edges = record(); const shores = record();
    for (const plan of scene.chunks) {
      drawLandEdges(edges.context, ground, plan, 1);
      drawLandShoreStrips(shores.context, ground, scene.shore, plan.waterLoops, { left: plan.cx * 8 - 0.5, top: plan.cy * 8 - 0.5, right: plan.cx * 8 + 7.5, bottom: plan.cy * 8 + 7.5 });
    }
    assert.ok(edges.transforms.length > 0, `${id} edge quads`);
    for (const m of edges.transforms) {
      assert.ok(Math.abs(across(m.c, m.d) - EDGE_BAND_WIDEN / 128) < 1e-9, `${id} edge across ${across(m.c, m.d)}`);
      assert.ok(Math.abs(along(m.a, m.b) - 1 / 128) < 1e-9, `${id} edge along ${along(m.a, m.b)}`);
    }
    for (const m of shores.transforms) assert.ok(Math.abs(across(m.c, m.d) - 1 / 128) < 1e-9, `${id} shore across ${across(m.c, m.d)}`);
    if (id === "core:fen_drainage") assert.ok(shores.transforms.length > 0, "the fen's reed strips are drawn");
  }
});

test("LU-D11 / NAT-4: the forest edge is Wave 41's: summer woodland_edge_a | b (spring and autumn too), winter its frosted strip, on the woodland floor's meadow edges", async () => {
  const { DEEP_WOODLAND_EDGE, FOREST_EDGE_FAMILY, FOREST_EDGE_FILL, forestEdgeArtKeys, forestEdgeReadiness, stripFamilyInstalled, wave22StripInstalled } = await import("../src/render/landEdgeBand");
  const { EDGE_OF } = await import("../src/render/archetypeGroundRegions");
  const { WAVE41_GROUND } = await import("../src/render/wave41LandManifest.generated");
  assert.equal(stripFamily(`${FOREST_EDGE_FAMILY}_a`), FOREST_EDGE_FAMILY, "the band map can name it");
  assert.equal(stripFamilyInstalled(FOREST_EDGE_FAMILY), true);
  assert.equal(wave22StripInstalled(FOREST_EDGE_FAMILY), false, "never asked for as Wave 22 halves");
  assert.equal(EDGE_OF[FOREST_EDGE_FILL], FOREST_EDGE_FAMILY);
  const summer = ["boundary/woodland_edge_a", "boundary/woodland_edge_b"];
  assert.deepEqual(SEASONS.map(forestEdgeArtKeys), [summer, summer, summer, ["boundary/woodland_grass_edge_winter"]]);
  assert.equal(DEEP_WOODLAND_EDGE, "boundary/woodland_grass_edge_summer");
  assert.ok(SEASONS.every(season => !forestEdgeArtKeys(season).includes(DEEP_WOODLAND_EDGE)), "the deep-woodland variant is installed, not drawn");
  assert.deepEqual(Object.keys(WAVE41_GROUND).sort(), [...summer, DEEP_WOODLAND_EDGE, "boundary/woodland_grass_edge_winter"].sort());
  for (const key of Object.keys(WAVE41_GROUND) as (keyof typeof WAVE41_GROUND)[]) {
    const meta = WAVE41_GROUND[key];
    assert.deepEqual([meta.width, meta.height, meta.repeat], [512, 64, "x"], key);
    assert.ok(existsSync(new URL(`../public/${meta.url}`, import.meta.url)), key);
  }
  for (const family of ["boundary/chalk_edge", "boundary/heath_edge", "boundary/fen_edge", "boundary/coastal_edge"]) assert.equal(stripFamilyInstalled(family), true, family);
  const forest = landGroundOf(land("core:forest_edge", 1))!;
  const woodland = fillRegions(forest).filter(region => region.base === FOREST_EDGE_FILL);
  assert.ok(woodland.length > 0);
  assert.ok(woodland.some(region => region.loops.some(loop => loop.strips.includes(FOREST_EDGE_FAMILY))), "the woodland floor's edges carry the strip");
  assert.ok(woodland.every(region => region.loops.every(loop => loop.strips.every(strip => strip === null || strip === FOREST_EDGE_FAMILY))));
  // Its file is part of the land's readiness (and never a Wave 22 key); a land without the woodland floor adds nothing.
  for (const season of SEASONS) assert.ok(landArtKeys(forest, season).every(key => !key.startsWith(FOREST_EDGE_FAMILY) && !key.includes("woodland_grass_edge")));
  assert.match(forestEdgeReadiness(forest.fillBase, 1), /^:f[01]$/);
  const downs = landGroundOf(land("core:chalk_downs", 1))!;
  assert.equal(downs.fillBase.includes(FOREST_EDGE_FILL), false);
  assert.equal(forestEdgeReadiness(downs.fillBase, 1), "");
  // The forest land now lays edge quads (before Wave 41: none).
  const scene = groundBoundaryScene(land("core:forest_edge", 1));
  const quads = scene.chunks.reduce((sum, plan) => sum + drawLandEdges(countingContext().context, forest, plan, 1), 0);
  assert.ok(quads > 0, `${quads} forest edge quads`);
});

test("NAT-4: each run of the forest edge starts on a or b of the summer repeat by a stable hash of its first point; the feather follows each strip's paint", async () => {
  const { EDGE_BAND_PEAK, FOREST_EDGE_FAMILY, WOODLAND_EDGE_PAINT, edgeFeatherAlpha, forestRunPhases } = await import("../src/render/landEdgeBand");
  const square = Array.from({ length: 12 }, (_, at) => ({ x: at, y: at % 2 }));
  const F = FOREST_EDGE_FAMILY;
  const families = [F, F, F, null, F, F, null, null, F, F, F, F] as const;
  const phases = forestRunPhases(square, families)!;
  assert.equal(phases.length, 12);
  // One phase per run: segments 0-2 and 8-11 are one run across the loop's start, 4-5 another.
  assert.ok([1, 2, 8, 9, 10, 11].every(index => phases[index] === phases[0]), JSON.stringify(phases));
  assert.equal(phases[5], phases[4]);
  assert.deepEqual(forestRunPhases(square, families), phases, "stable");
  assert.equal(forestRunPhases(square, families.map(() => "boundary/chalk_edge" as const)), null, "no forest edge, no phases");
  // Over the forest land's loops both phases occur (the band does not start every run on one image).
  const seen = new Set<number>(); let runs = 0;
  for (const seed of [1, 2, 3]) {
    const forest = landGroundOf(land("core:forest_edge", seed))!;
    for (const region of fillRegions(forest)) for (const loop of region.loops) {
      const loopPhases = forestRunPhases(loop.smoothed, loop.strips) ?? [];
      loop.strips.forEach((strip, index) => { if (strip === F) { seen.add(loopPhases[index]!); if (loop.strips.at(index - 1) !== F) runs += 1; } });
    }
  }
  assert.ok(runs > 1, `${runs} runs`);
  assert.deepEqual([...seen].sort(), [0, 1], `${runs} runs`);
  // woodland_edge_a / _b paint rows 2-61: their hump spans those rows (0 outside, the peak in the middle).
  assert.equal(edgeFeatherAlpha(1, WOODLAND_EDGE_PAINT), 0);
  assert.equal(edgeFeatherAlpha(62, WOODLAND_EDGE_PAINT), 0);
  assert.ok(edgeFeatherAlpha(5, WOODLAND_EDGE_PAINT) > 0, "the A/B paint near its edge is kept (the Wave 22 hump would drop it)");
  assert.equal(edgeFeatherAlpha(5), 0);
  assert.ok(Math.abs(edgeFeatherAlpha(31, WOODLAND_EDGE_PAINT) - EDGE_BAND_PEAK) < 0.01);
});
