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

test("LU-D2: the riverside never enters the land code (no layer, no chunk token)", () => {
  assert.equal(landGroundOf(DEFAULT_GAME_STATE), null);
  assert.equal(landGroundOf(land(RIVERSIDE_ARCHETYPE_ID, 1)), null);
  assert.equal(landGroundOf({ ...DEFAULT_GAME_STATE, archetypeId: RIVERSIDE_ARCHETYPE_ID }), null);
  const source = readFileSync(new URL("../src/render/drawTerrainBoundaryV2.ts", import.meta.url), "utf8");
  assert.match(source, /land === null \? "" : landChunkToken\(/);
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

test("the chalk downs' field edges are dry-stone walls; the riverside keeps its hedges (the cache keys on the land)", () => {
  const town = decodeSave(readFileSync(new URL("../fixtures/saves/v26/four-farms.save.json", import.meta.url))).envelope.state;
  const hedged = countrysideOf(town).strips.filter(piece => piece.family !== "baulk");
  assert.ok(hedged.length > 0 && hedged.every(piece => piece.family.startsWith("hedgerow")));
  const downs = countrysideOf({ ...town, archetypeId: "core:chalk_downs" }).strips.filter(piece => piece.family !== "baulk");
  assert.ok(downs.length > 0 && downs.every(piece => piece.family === "dry_stone_wall"));
  assert.ok(countrysideOf(town).strips.filter(piece => piece.family !== "baulk").every(piece => piece.family.startsWith("hedgerow")));
});

/** A context that counts the calls a chunk raster pays (fills, image draws) and keeps patterns inert. */
function countingContext() {
  const counts = { fill: 0, drawImage: 0, setTransform: 0 };
  const context = {
    fillStyle: "" as unknown, globalAlpha: 1, imageSmoothingEnabled: true,
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, transform() {},
    fill() { counts.fill += 1; },
    drawImage() { counts.drawImage += 1; },
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createPattern: () => ({ setTransform() { counts.setTransform += 1; } }),
  };
  return { context: context as unknown as CanvasRenderingContext2D, counts };
}

test("draw calls one land chunk adds: two fills per fill kind, one per strip quad, one blit per decal", () => {
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
          const tiles = state.tiles.filter(tile => Math.floor(tile.tx / GROUND_CHUNK_TILES) === plan.cx && Math.floor(tile.ty / GROUND_CHUNK_TILES) === plan.cy);
          drawLandFills(context, ground, tiles, 1);
          const fills = counts.fill;
          const edgeQuads = drawLandEdges(context, ground, tiles);
          const shoreQuads = drawLandShoreStrips(context, ground, scene.shore, plan.waterLoops, { left: plan.cx * 8 - 0.5, top: plan.cy * 8 - 0.5, right: plan.cx * 8 + 7.5, bottom: plan.cy * 8 + 7.5 });
          const decals = drawLandDecals(context, ground, state.tiles, plan);
          assert.equal(counts.fill, fills + edgeQuads + shoreQuads);
          const total = counts.fill + counts.drawImage;
          if (total > worst.total) worst = { fills, quads: edgeQuads + shoreQuads, decals, total, chunk: `${plan.cx},${plan.cy}` };
          assert.ok(fills <= 2 * 3, `${id} ${plan.cx},${plan.cy}: ${fills} fill passes`);
        }
        report[id] = worst;
      }
      console.log(JSON.stringify({ busiestChunkAddedCalls: report }));
      resolve();
    }, 20);
  });
});
