import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { setPresentationSpeed } from "../src/render/presentationSpeed";
import baseline from "./fixtures/season-art-before.json";
import { SEASON_IMAGES } from "../src/render/seasonArtManifest.generated";
import { seasonVariant, seasonVariants, seasonMeta } from "../src/render/seasonArt";
import { seasonChunkToken } from "../src/render/seasonGround";
import { fenceDriftSpots, wave15GroundDecal } from "../src/render/seasonalDecals";
import { SEASON_FX_TICKS, seasonFxAt } from "../src/render/seasonFx";
import { resetSeasonBlendForTest, SEASON_FADE_FAST_MS, SEASON_FADE_MS, seasonBlend } from "../src/render/seasonTransition";
import { parseCsv, parseCsvRows } from "../scripts/provenanceLedgerCsv";
import { recordingCanvas } from "../scripts/recordingCanvas";

// INSTALL-15 seasonal nature (Wave 15): the 65 installed files and their ledger rows, the picture chooser, the season
// part of the chunk keys, the season change (a wave; 5x a shorter wave since NAT-2; loads are not changes), the chunk cache's turn (SMOOTH-2R: a wave),
// the season decals and effects.
const ROOT = new URL("../", import.meta.url);
const state = (tick: number) => ({ tick, scenarioId: "core:campaign_market_town" });

test("Given the historical Wave 15 install Then all 65 received sources retain their exact INSTALL-15 receipt and provenance hash", () => {
  const entries = Object.entries(baseline);
  assert.equal(entries.length, 65);
  const ledger = parseCsvRows(readFileSync(new URL("docs/provenance/assets.csv", ROOT), "utf8"));
  const inbox = parseCsv(readFileSync(new URL("assets-inbox/INBOX_LEDGER.csv", ROOT), "utf8"));
  const header = inbox[0]; assert.ok(header);
  const column = (name: string) => { const index = header.indexOf(name); assert.ok(index >= 0, name); return index; };
  const wave = column("wave"), file = column("file"), hash = column("sha256"), installed = column("installed_by");
  const receipts = inbox.slice(1).filter(row => row[wave] === "wave15" && row[installed] === "INSTALL-15");
  assert.equal(receipts.length, 65, "historical INSTALL-15 receipts");
  for (const [key, meta] of entries) {
    const received = meta.url.replace("assets/wave15/", "wave15/candidates-20260926/assets/");
    const sourcePath = `assets-inbox/${received}`;
    const source = new URL(sourcePath, ROOT); assert.ok(existsSync(source), key);
    const digest = createHash("sha256").update(readFileSync(source)).digest("hex");
    const matchingReceipts = receipts.filter(row => row[file] === received);
    assert.equal(matchingReceipts.length, 1, `${key}: exact received-file receipt`);
    assert.equal(matchingReceipts[0]?.[hash], digest, `${key}: received bytes match INSTALL-15`);
    const rows = ledger.filter(row => row.sourcePath === sourcePath);
    assert.equal(rows.length, 1, `${key}: exact historical provenance source`);
    assert.equal(rows[0]?.sourceSha256, digest, `${key}: source hash`);
  }
});

test("Given the active seasonal manifest Then every runtime file has one active provenance row with exact runtime and source hashes", () => {
  const ledger = parseCsvRows(readFileSync(new URL("docs/provenance/assets.csv", ROOT), "utf8"));
  const paths = Object.values(SEASON_IMAGES).map(meta => `public/${meta.url}`);
  assert.equal(new Set(paths).size, paths.length, "active URLs are unique");
  for (const runtimePath of paths) {
    const rows = ledger.filter(row => row.runtimePath === runtimePath);
    assert.equal(rows.length, 1, `${runtimePath}: exact provenance row`);
    const row = rows[0]; assert.ok(row);
    assert.ok(row.status === "runtime" || row.status === "candidate", `${runtimePath}: active status`);
    const runtime = new URL(runtimePath, ROOT); assert.ok(existsSync(runtime), runtimePath);
    assert.equal(createHash("sha256").update(readFileSync(runtime)).digest("hex"), row.runtimeSha256, `${runtimePath}: runtime hash`);
    const source = new URL(row.sourcePath, ROOT); assert.ok(existsSync(source), row.sourcePath);
    assert.equal(createHash("sha256").update(readFileSync(source)).digest("hex"), row.sourceSha256, `${runtimePath}: source hash`);
  }
});

test("Given a base art and a season When the chooser picks Then the variant follows the brief (pines and stumps only winter, orchards no autumn, summer the base)", () => {
  assert.equal(seasonVariant("tree_oak_large", 2), "tree_oak_large_autumn");
  const spring = seasonVariant("tree_oak_large", 0); assert.ok(spring);
  const springMeta = seasonMeta(spring); assert.ok("bases" in springMeta);
  assert.deepEqual(springMeta.bases, ["tree_oak_large"]); assert.equal(springMeta.season, "spring");
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
  assert.equal(used.size, Object.values(SEASON_IMAGES).filter(meta => "bases" in meta).length);
});

test("Given the ground chunk keys When the season turns Then summer keeps the old keys and every other season has its own token", () => {
  assert.equal(seasonChunkToken(1), "");
  const tokens = [0, 2, 3].map(season => seasonChunkToken(season as 0 | 2 | 3));
  assert.equal(new Set(tokens).size, 3);
  for (const token of tokens) assert.match(token, /^\|s[023]:[01]*$/);
});

test("Given the object pass When the season turns at 1x Then it fades over SEASON_FADE_MS; at 5x over SEASON_FADE_FAST_MS (NAT-2); on a load it is immediate", () => {
  resetSeasonBlendForTest(); setPresentationSpeed(1);
  assert.deepEqual(seasonBlend(state(2_990), 0), { season: 2, from: null, t: 1 });
  const turned = seasonBlend(state(3_000), 100);
  assert.deepEqual([turned.season, turned.from, turned.t], [3, 2, 0]);
  const middle = seasonBlend(state(3_010), 100 + SEASON_FADE_MS / 2);
  assert.equal(middle.from, 2); assert.ok(Math.abs(middle.t - 0.5) < 1e-9);
  assert.deepEqual(seasonBlend(state(3_020), 100 + SEASON_FADE_MS), { season: 3, from: null, t: 1 });
  // 5x (NAT-2 QA-012): the same wave, shorter.
  setPresentationSpeed(5);
  const fast = seasonBlend(state(4_000), 5_000);
  assert.deepEqual([fast.season, fast.from, fast.t], [0, 3, 0]);
  assert.ok(Math.abs(seasonBlend(state(4_010), 5_000 + SEASON_FADE_FAST_MS / 2).t - 0.5) < 1e-9);
  assert.deepEqual(seasonBlend(state(4_020), 5_000 + SEASON_FADE_FAST_MS), { season: 0, from: null, t: 1 });
  setPresentationSpeed(1);
  // A load (a jump of more than a season) is not a change.
  assert.deepEqual(seasonBlend(state(9_500), 6_000), { season: 1, from: null, t: 1 });
  resetSeasonBlendForTest();
});

test("Given a held chunk raster When it re-rasters under a new season token Then it keeps the old season until its moment in the turn and re-rasters in place (SMOOTH-2R)", () => {
  const made: ReturnType<typeof recordingCanvas>[] = [];
  // A fake clock (TEST-1): the turn's time is what the test says, not what a busy machine's timers give.
  let clockMs = 0;
  const cache = createGroundChunkCache(((w: number, h: number) => { const canvas = recordingCanvas(w, h); made.push(canvas); return canvas; }) as unknown as Parameters<typeof createGroundChunkCache>[0],
    () => clockMs);
  const diamond = [{ x: 0, y: -64 }, { x: 128, y: 0 }, { x: 0, y: 64 }, { x: -128, y: 0 }] as const;
  const target = recordingCanvas(512, 512);
  const request = (content: string, token: string, ms: number) => ({ id: "ground:0,0", contentKey: content, scale: 1, diamond, fade: { token, ms } });
  cache.beginFrame(); cache.draw(target.context, request("a|s2", "s2", 1_000_000), () => undefined);
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("a|s3", "s3", 40), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1, "the turn's first frame: one opaque blit");
  assert.equal(cache.stats().fades, 1);
  clockMs += 40;
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("a|s3", "s3", 40), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1, "after the turn's time: one opaque blit, of the new season");
  assert.equal(cache.entry("ground:0,0")?.contentKey, "a|s3");
  assert.equal(made.length, 1, "no staged or blend canvas: the chunk's own canvas");
  // The same token (an art load, a zone edit) cuts over; a zero-length turn (5x) too.
  target.canvas.ops.length = 0;
  cache.beginFrame(); cache.draw(target.context, request("b|s3", "s3", 1_000_000), () => undefined);
  assert.equal(target.canvas.ops.filter(op => op.startsWith("drawImage")).length, 1);
  assert.equal(cache.entry("ground:0,0")?.contentKey, "b|s3");
  cache.beginFrame(); cache.draw(target.context, request("b|s0", "s0", 0), () => undefined);
  assert.equal(cache.entry("ground:0,0")?.contentKey, "b|s0");
  assert.equal(cache.stats().fades, 2);
  assert.equal(made.length, 1);
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
