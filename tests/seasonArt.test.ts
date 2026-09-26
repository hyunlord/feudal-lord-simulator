import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { setPresentationSpeed } from "../src/render/presentationSpeed";
import { SEASON_IMAGES } from "../src/render/seasonArtManifest.generated";
import { seasonVariant, seasonVariants } from "../src/render/seasonArt";
import { seasonChunkToken } from "../src/render/seasonGround";
import { fenceDriftSpots, wave15GroundDecal } from "../src/render/seasonalDecals";
import { SEASON_FX_TICKS, seasonFxAt } from "../src/render/seasonFx";
import { resetSeasonBlendForTest, SEASON_FADE_MS, seasonBlend } from "../src/render/seasonTransition";
import { recordingCanvas } from "../scripts/recordingCanvas";

// INSTALL-15 seasonal nature (Wave 15): the 65 installed files and their ledger rows, the picture chooser, the season
// part of the chunk keys, the season change (crossfade, 5x immediate, loads are not changes), the chunk cache fade,
// the season decals and effects.
const ROOT = new URL("../", import.meta.url);
const state = (tick: number) => ({ tick, scenarioId: "core:campaign_market_town" });

test("Given the Wave 15 install When the manifest and the ledger are read Then 65 runtime files each have one ledger row with the received bytes", () => {
  const keys = Object.keys(SEASON_IMAGES);
  assert.equal(keys.length, 65);
  const ledger = readFileSync(new URL("docs/provenance/assets.csv", ROOT), "utf8");
  const rows = ledger.split("\n").filter(line => line.includes("public/assets/wave15/"));
  assert.equal(rows.length, 65, "one ledger row per Wave 15 file");
  for (const key of keys) {
    const file = new URL(`public/${SEASON_IMAGES[key as keyof typeof SEASON_IMAGES].url}`, ROOT);
    assert.ok(existsSync(file), key);
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    assert.ok(ledger.includes(digest), `${key}: runtime sha in the ledger`);
  }
  const inbox = readFileSync(new URL("assets-inbox/INBOX_LEDGER.csv", ROOT), "utf8").split(/\r?\n/).filter(line => line.startsWith("wave15,") && line.includes("/assets/"));
  assert.equal(inbox.filter(line => line.endsWith(",INSTALL-15")).length, 65, "installed_by = INSTALL-15");
});

test("Given a base art and a season When the chooser picks Then the variant follows the brief (pines and stumps only winter, orchards no autumn, summer the base)", () => {
  assert.equal(seasonVariant("tree_oak_large", 2), "tree_oak_large_autumn");
  assert.equal(seasonVariant("tree_oak_large", 0), "tree_oak_large_spring");
  assert.deepEqual([seasonVariant("tree_oak_large", 3, 0), seasonVariant("tree_oak_large", 3, 1)], ["tree_oak_large_winter", "tree_oak_large_winter_snow"]);
  assert.equal(seasonVariant("tree_pine_tall", 2), null);
  assert.equal(seasonVariant("tree_pine_tall", 3), "tree_pine_tall_winter_snow");
  assert.equal(seasonVariant("stump_old", 0), null);
  assert.equal(seasonVariant("stump_old", 3), "stump_old_winter");
  assert.equal(seasonVariant("orchard_plum_j", 2), null, "orchards keep their fruiting art in autumn");
  assert.equal(seasonVariant("orchard_tree", 0), "orchard_tree_spring");
  assert.equal(seasonVariant("pasture_fill_c", 3), "pasture_winter");
  assert.equal(seasonVariant("soil_b", 3), "soil_winter");
  assert.equal(seasonVariant("grass", 2), "grass_autumn_fill");
  assert.equal(seasonVariant("forest_fringe_b", 0), null);
  for (const base of ["tree_oak_large", "tree_birch", "orchard_apple_c", "grass", "pasture_fill"]) assert.equal(seasonVariant(base, 1), null, `${base} in summer`);
  // Every variant is used by some season (57 variants; the 6 decals and 2 fx sheets are drawn by key).
  const used = new Set([0, 2, 3].flatMap(season => seasonVariants(season as 0 | 2 | 3)));
  assert.equal(used.size, 65 - 8);
});

test("Given the ground chunk keys When the season turns Then summer keeps the old keys and every other season has its own token", () => {
  assert.equal(seasonChunkToken(1), "");
  const tokens = [0, 2, 3].map(season => seasonChunkToken(season as 0 | 2 | 3));
  assert.equal(new Set(tokens).size, 3);
  for (const token of tokens) assert.match(token, /^\|s[023]:[01]*$/);
});

test("Given the object pass When the season turns at 1x Then it fades over SEASON_FADE_MS; at 5x and on a load it is immediate", () => {
  resetSeasonBlendForTest(); setPresentationSpeed(1);
  assert.deepEqual(seasonBlend(state(2_990), 0), { season: 2, from: null, t: 1 });
  const turned = seasonBlend(state(3_000), 100);
  assert.deepEqual([turned.season, turned.from, turned.t], [3, 2, 0]);
  const middle = seasonBlend(state(3_010), 100 + SEASON_FADE_MS / 2);
  assert.equal(middle.from, 2); assert.ok(Math.abs(middle.t - 0.5) < 1e-9);
  assert.deepEqual(seasonBlend(state(3_020), 100 + SEASON_FADE_MS), { season: 3, from: null, t: 1 });
  // 5x: the turn is immediate.
  setPresentationSpeed(5);
  assert.deepEqual(seasonBlend(state(4_000), 5_000), { season: 0, from: null, t: 1 });
  setPresentationSpeed(1);
  // A load (a jump of more than a season) is not a change.
  assert.deepEqual(seasonBlend(state(9_500), 6_000), { season: 1, from: null, t: 1 });
  resetSeasonBlendForTest();
});

test("Given a held chunk raster When it re-rasters under a new season token Then it shows a stepped blend of old and new until the fade ends", async () => {
  const made: ReturnType<typeof recordingCanvas>[] = [];
  const cache = createGroundChunkCache(((w: number, h: number) => { const canvas = recordingCanvas(w, h); made.push(canvas); return canvas; }) as unknown as Parameters<typeof createGroundChunkCache>[0]);
  const diamond = [{ x: 0, y: -64 }, { x: 128, y: 0 }, { x: 0, y: 64 }, { x: -128, y: 0 }] as const;
  const target = recordingCanvas(512, 512);
  const request = (content: string, token: string, ms: number) => ({ id: "ground:0,0", contentKey: content, scale: 1, diamond, fade: { token, ms } });
  cache.beginFrame(); cache.draw(target.context, request("a|s2", "s2", 1_000_000), () => undefined);
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("a|s3", "s3", 40), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1, "the turn's first frame: one opaque blit (the old raster)");
  assert.equal(cache.stats().fades, 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("a|s3", "s3", 40), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1, "mid-fade: one opaque blit (the blend)");
  const blend = made.at(-1)!.canvas.ops;
  assert.equal(blend.filter(op => op.startsWith("drawImage")).length, 2, "the blend: the old raster, then the new one over it");
  assert.ok(blend.some(op => /^set globalAlpha\(0\.(3|4|5|6)\d*\)$/.test(op)), `mid-fade step alpha: ${blend.filter(op => op.includes("globalAlpha")).join(" ")}`);
  // The same token (an art load, a zone edit) cuts over; a zero-length fade (5x) too.
  await new Promise(resolve => setTimeout(resolve, 30));
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("b|s3", "s3", 1_000_000), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1);
  cache.beginFrame(); cache.draw(target.context, request("b|s0", "s0", 0), () => undefined);
  assert.equal(cache.stats().fades, 1);
  // A short fade ends: one blit again.
  cache.beginFrame(); cache.draw(target.context, request("b|s1", "s1", 1), () => undefined);
  await new Promise(resolve => setTimeout(resolve, 5));
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("b|s1", "s1", 1), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1);
});

test("Given the season decals When scattered Then spring has flowers, winter has ice on a quarter of that scatter, and only finished palisade edges and hurdles drift", () => {
  const tiles = Array.from({ length: 4_000 }, (_, index) => ({ tx: index % 80, ty: Math.floor(index / 80), terrain: "grass" as const, buildingId: null, hasRoad: false }));
  const spring = tiles.map(tile => wave15GroundDecal(2, tile, 0)).filter(key => key !== null);
  const winter = tiles.map(tile => wave15GroundDecal(2, tile, 3)).filter(key => key !== null);
  assert.ok(spring.length > 200 && spring.every(key => key === "spring_flowers_a" || key === "spring_flowers_b"));
  assert.ok(winter.length > 30 && winter.length < spring.length / 2 && winter.every(key => key === "puddle_ice"), `${winter.length} ice of ${spring.length} flowers`);
  assert.deepEqual(tiles.map(tile => wave15GroundDecal(2, tile, 2)).filter(key => key !== null), []);
  assert.deepEqual(tiles.map(tile => wave15GroundDecal(2, tile, 0)).filter(key => key !== null), spring, "deterministic");
  const segment = (completed: boolean) => ({ id: "s", order: 0, edgePath: Array.from({ length: 21 }, (_, x) => ({ x, y: 0 })), tileCount: 20, completed, constructionSiteId: null });
  const palisade = (completed: boolean) => ({ id: "p", polygon: [], gate: { x: 0, y: 0 }, segments: [segment(completed)] });
  const drifts = fenceDriftSpots({ seed: 2, palisade: palisade(true) }, []);
  assert.ok(drifts.length >= 5 && drifts.length <= 15, `${drifts.length} drifts along 20 edges`);
  assert.deepEqual(fenceDriftSpots({ seed: 2, palisade: palisade(false) }, []), []);
});

test("Given the season effects When the calendar turns Then leaves fall in the first quarter of autumn and snow in the first quarter of winter", () => {
  assert.equal(seasonFxAt(state(2_000)), "leaves");
  assert.equal(seasonFxAt(state(2_000 + SEASON_FX_TICKS - 1)), "leaves");
  assert.equal(seasonFxAt(state(2_000 + SEASON_FX_TICKS)), null);
  assert.equal(seasonFxAt(state(3_010)), "snow");
  assert.equal(seasonFxAt(state(0)), null);
  assert.equal(seasonFxAt(state(1_100)), null);
});
