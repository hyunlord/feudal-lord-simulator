import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { parseCsv, parseCsvRows } from "../scripts/provenanceLedgerCsv";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import { houseBodyAssignments, houseBodyOptions, rawHouseBody } from "../src/render/houseVariantChoice";
import { runtimeAssetDerivatives } from "../src/render/runtimeAssetDerivatives.generated";
import { WAVE30_PAIR_HOUSE_IMAGES, WAVE30_PAIR_HOUSE_VARIANTS } from "../src/render/wave30PairHouseManifest.generated";

// INSTALL-30 the Wave 30 pair-house variants: install consistency, the per-household choice among a pair's own four
// paintings (Wave 26's rule), its weights and stability, and every painting's own state layers.

const LOTS = ["horizontal", "vertical"] as const;
const building = (id: string, tx: number, ty: number, fields: Partial<Building> = {}): Building =>
  ({ id, kind: "house", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;
const house = (buildingId: string, level: number, fields: Partial<House> = {}): House =>
  ({ buildingId, level, residents: 4, hasWater: true, breadStock: 2, lastServicedTick: 0, unmetRequirementTicks: 0, ...fields }) as House;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("install: 18 paintings and their 72 own layers, received bytes, ledgers, roofs and the approved pair's canvas", () => {
  const [inboxHeader, ...inboxRows] = parseCsv(readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8"));
  const column = (name: string) => inboxHeader!.indexOf(name);
  const inboxByFile = new Map(inboxRows.map(row => [row[column("file")], row]));
  const provenance = new Map(parseCsvRows(readFileSync("docs/provenance/assets.csv", "utf8")).map(row => [row.runtimePath, row]));
  const [recordHeader, ...recordRows] = parseCsv(readFileSync("assets-inbox/wave30/candidates-20260929/records/generation-records.csv", "utf8").replace(/^﻿/, ""));
  const records = new Map(recordRows.map(row => [row[recordHeader!.indexOf("id")]!.replace(/-v1$/, ""), Object.fromEntries(recordHeader!.map((key, index) => [key, row[index]]))]));
  assert.equal(Object.keys(WAVE30_PAIR_HOUSE_IMAGES).length, 90);
  assert.equal(WAVE30_PAIR_HOUSE_VARIANTS.length, 18);
  for (const [key, image] of Object.entries(WAVE30_PAIR_HOUSE_IMAGES)) {
    const runtime = `public/${image.url}`;
    assert.ok(existsSync(runtime), runtime);
    const source = records.get(key);
    assert.ok(source !== undefined, key);
    const digest = sha(runtime);
    assert.equal(digest, source.sha256, `${key} = the batch's bytes`);
    const row = inboxByFile.get(`wave30/candidates-20260929/${source.file}`);
    assert.equal(row?.[column("sha256")], digest);
    assert.equal(row?.[column("status")], "confirmed");
    assert.equal(row?.[column("installed_by")], "INSTALL-30");
    const ledger = provenance.get(runtime);
    assert.equal(ledger?.runtimeSha256, digest);
    assert.equal(ledger?.status, "runtime");
    assert.ok(existsSync(ledger.prompt), ledger.prompt);
    assert.deepEqual([image.width, image.height], [Number(source.width), Number(source.height)]);
  }
  // README: L2 horizontal thatch, thatch, tile; vertical thatch, tile, tile; L3 thatch, tile, stone; L4 no thatch.
  assert.deepEqual(WAVE30_PAIR_HOUSE_VARIANTS.map(variant => `${variant.level}${variant.lot[0]}${variant.variant}:${variant.roof}`), [
    "2hc:thatch", "2hd:thatch", "2he:clay_tile", "2vc:thatch", "2vd:clay_tile", "2ve:clay_tile",
    "3hc:thatch", "3hd:clay_tile", "3he:stone_slate", "3vc:thatch", "3vd:clay_tile", "3ve:stone_slate",
    "4hc:clay_tile", "4hd:stone_slate", "4he:clay_tile", "4vc:stone_slate", "4vd:clay_tile", "4ve:stone_slate",
  ]);
  for (const variant of WAVE30_PAIR_HOUSE_VARIANTS) {
    const body = WAVE30_PAIR_HOUSE_IMAGES[variant.key];
    const approved = houseCompoundAssetManifest.find(meta => meta.level === variant.level && meta.axis === variant.lot)!;
    for (const state of ["weathered", "fresh", "snow", "boarded"] as const) {
      const layer = WAVE30_PAIR_HOUSE_IMAGES[`${variant.key}_${state}` as keyof typeof WAVE30_PAIR_HOUSE_IMAGES];
      assert.deepEqual([layer.width, layer.height], [body.width, body.height], `${variant.key} ${state}: same canvas`);
    }
    // Painted on the approved pair's runtime canvas (its derivative's size), and the crop holds the approved bounds.
    const derivative = runtimeAssetDerivatives.find(entry => entry.url === approved.url)!;
    assert.deepEqual([body.width, body.height], [derivative.width, derivative.height], variant.key);
    const bounds = approved.alphaBounds;
    assert.ok(variant.crop.x <= bounds.x && variant.crop.y <= bounds.y && variant.crop.x + variant.crop.width >= bounds.x + bounds.width
      && variant.crop.y + variant.crop.height >= bounds.y + bounds.height, variant.key);
  }
  assert.match(readFileSync("scripts/provenanceLedgerAssets.ts", "utf8"), /"src\/render\/wave30PairHouseManifest\.generated\.ts"/);
  assert.match(readFileSync("scripts/checks/distBudget.config.json", "utf8"), /"category": "world", "label": "pair-house variants and their state layers \(Wave 30\)", "patterns": \["assets\/wave30\/\*\*"\]/);
});

test("choice: four paintings a pair (level and lot), the approved pair first; singles keep their own five", () => {
  for (const level of [2, 3, 4]) for (const lot of LOTS) {
    const options = houseBodyOptions(level, lot);
    assert.equal(options.length, 4);
    assert.deepEqual([options[0]!.roof, options[0]!.variant], ["clay_tile", null], "the approved pairs are red tile");
    assert.deepEqual(options.slice(1).map(option => option.variant!.key), ["c", "d", "e"].map(variant => `house_pair_l${level}_${lot}_${variant}`));
  }
  assert.equal(houseBodyOptions(2).length, 5);
  assert.ok(houseBodyOptions(2).every(option => option.variant === null || !("lot" in option.variant)));
});

test("selection: stable per household, keyed by the lot's building id, moved by the world seed, pure of other inputs", () => {
  for (let index = 0; index < 50; index += 1) {
    const id = `pair-${index}`;
    assert.equal(rawHouseBody(7, id, 3, "common", "vertical"), rawHouseBody(7, id, 3, "common", "vertical"));
  }
  const bySeed = new Set(Array.from({ length: 40 }, (_, seed) => rawHouseBody(seed, "pair-1", 2, "common", "horizontal").variant?.key ?? "existing"));
  assert.equal(bySeed.size, 4, "the world seed reaches every painting");
  const houses = [house("a", 2), house("b", 3), house("c", 4), house("s", 2)];
  const state = { seed: 11, buildings: [building("a", 2, 2, { houseLot: "horizontal" }), building("b", 8, 2, { houseLot: "vertical" }),
    building("c", 14, 2, { houseLot: "horizontal" }), building("s", 20, 2)], houses } as unknown as GameState;
  const first = houseBodyAssignments(state);
  for (const [id, level, lot] of [["a", 2, "horizontal"], ["b", 3, "vertical"], ["c", 4, "horizontal"]] as const) {
    assert.ok(first.has(id), id);
    assert.equal(first.get(id), rawHouseBody(11, id, level, level === 4 ? "rich" : "common", lot).variant, id);
  }
  assert.deepEqual(houseBodyAssignments({ ...state, tick: 9_999, houses: houses.map(entry => ({ ...entry, breadStock: 9 })) } as GameState), first,
    "nothing but the listed inputs moves it");
  const moved = houseBodyAssignments({ ...state, buildings: state.buildings.map(entry => entry.id === "a" ? { ...entry, tx: 40, ty: 30 } : entry) } as GameState);
  assert.equal(moved.get("a"), first.get("a"), "the same household elsewhere keeps its painting");
  // A pair's painting is always its own level and lot's; a single's never a pair's.
  for (const [id, variant] of first) {
    const entry = state.buildings.find(candidate => candidate.id === id)!;
    if (variant === null) continue;
    assert.equal("lot" in variant ? variant.lot : undefined, entry.houseLot, id);
  }
});

test("weights: Wave 26's roof weights over the pair's paintings; uniform within a roof", () => {
  const ids = Array.from({ length: 12_000 }, (_, index) => `lot-${index}`);
  const share = (level: number, lot: (typeof LOTS)[number], wealth: "common" | "rich", roof: string) =>
    ids.filter(id => rawHouseBody(3, id, level, wealth, lot).roof === roof).length / ids.length;
  const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 0.015, `${label}: ${actual.toFixed(3)} vs ${expected.toFixed(3)}`);
  // L2 horizontal: approved tile + c, d thatch + e tile. Commoner thatch 3 x 2 : tile 1 x 2; rich 1 x 2 : 3 x 2.
  near(share(2, "horizontal", "common", "thatch"), 6 / 8, "L2h commoner thatch");
  near(share(2, "horizontal", "rich", "thatch"), 2 / 8, "L2h rich thatch");
  // L2 vertical: approved tile + c thatch + d, e tile.
  near(share(2, "vertical", "common", "thatch"), 3 / 6, "L2v commoner thatch");
  // L3: approved tile, c thatch, d tile, e stone slate.
  near(share(3, "horizontal", "common", "stone_slate"), 1 / 6, "L3h commoner stone");
  near(share(3, "vertical", "rich", "clay_tile"), 6 / 9, "L3v rich tile");
  // L4 (always rich): horizontal tile x 3, stone x 1; vertical tile x 2, stone x 2.
  near(share(4, "horizontal", "rich", "stone_slate"), 2 / 11, "L4h stone");
  near(share(4, "vertical", "rich", "stone_slate"), 4 / 10, "L4v stone");
  const counts = new Map<string, number>();
  for (const id of ids) { const key = rawHouseBody(3, id, 4, "rich", "horizontal").variant?.key ?? "existing"; counts.set(key, (counts.get(key) ?? 0) + 1); }
  for (const key of ["existing", "house_pair_l4_horizontal_c", "house_pair_l4_horizontal_e"]) near(counts.get(key)! / ids.length, 3 / 11, `L4h ${key}`);
});

test("eligibility: a pair built to L2-L4 picks, also while burning or burnt (it has no fire painting); below L2 it has none", () => {
  const seed = [...Array(400).keys()].find(candidate => ["p", "f", "b"].every(id => rawHouseBody(candidate, id, 2, "common", "horizontal").variant !== null))!;
  const state = {
    seed,
    buildings: [building("p", 0, 0, { houseLot: "horizontal" }), building("f", 6, 0, { houseLot: "horizontal" }), building("b", 12, 0, { houseLot: "horizontal" }),
      building("low", 18, 0, { houseLot: "horizontal" })],
    houses: [house("p", 2), house("f", 2), house("b", 2, { burntTick: 5 }), house("low", 1)],
    events: { burning: [{ buildingId: "f", eventId: "fire@1", ignitedTick: 1, outTick: 90 }] },
  } as unknown as GameState;
  const assignments = houseBodyAssignments(state);
  for (const id of ["p", "f", "b"]) assert.equal(assignments.get(id), rawHouseBody(seed, id, 2, "common", "horizontal").variant, id);
  assert.equal(assignments.has("low"), false);
});

test("neighbour push: a touching pair after one with the same raw pick takes its roof's next painting; a single beside it does not count", () => {
  const seed = 9;
  const ids = Array.from({ length: 400 }, (_, index) => `n${index}`);
  const [first, second] = (() => {
    for (const a of ids) for (const b of ids) if (a < b && rawHouseBody(seed, a, 2, "common", "horizontal") === rawHouseBody(seed, b, 2, "common", "horizontal")
      && rawHouseBody(seed, a, 2, "common", "horizontal").roof === "thatch") return [a, b] as const;
    throw new Error("no pair");
  })();
  const raw = rawHouseBody(seed, first, 2, "common", "horizontal");
  const thatch = houseBodyOptions(2, "horizontal").filter(option => option.roof === "thatch");
  const next = thatch[(thatch.indexOf(raw) + 1) % thatch.length]!.variant;
  const lot = { houseLot: "horizontal" } as const;
  const touching = { seed, buildings: [building(first, 4, 4, lot), building(second, 6, 4, lot)], houses: [house(first, 2), house(second, 2)] } as unknown as GameState;
  const assignments = houseBodyAssignments(touching);
  assert.equal(assignments.get(first), raw.variant);
  assert.equal(assignments.get(second), next);
  assert.notEqual(next, raw.variant);
  const apart = houseBodyAssignments({ ...touching, buildings: [building(first, 4, 4, lot), building(second, 10, 4, lot)] } as GameState);
  assert.equal(apart.get(second), raw.variant);
});
