import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { parseCsv, parseCsvRows } from "../scripts/provenanceLedgerCsv";
import type { Building } from "../src/content/buildingConfig";
import { HOUSE_VARIANT_CONFIG } from "../src/content/houseVariantConfig";
import { BREW_ALE_CRAFT_ID } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import type { Person } from "../src/engine/persons.types";
import type { House } from "../src/population/population.types";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import {
  houseBodyAssignments, houseBodyEntries, houseBodyOptions, houseCompletions, householdWealth, houseStateLayer, rawHouseBody,
} from "../src/render/houseVariantChoice";
import { beginHouseVariantFrame } from "../src/render/wave26HouseArt";
import { WAVE26_HOUSE_IMAGES, WAVE26_HOUSE_VARIANTS } from "../src/render/wave26HouseManifest.generated";
import { recordCodeBudget } from "./helpers/codeBudget";

// INSTALL-26 the Wave 26 house variants: install consistency, the per-household choice and its weights, the state layers.

const SEASON = 1_000;
const YEAR = 4_000;
const building = (id: string, tx: number, ty: number, fields: Partial<Building> = {}): Building =>
  ({ id, kind: "house", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;
const house = (buildingId: string, level: number, fields: Partial<House> = {}): House =>
  ({ buildingId, level, residents: 4, hasWater: true, breadStock: 2, lastServicedTick: 0, unmetRequirementTicks: 0, ...fields }) as House;
const head = (householdId: string, classBand: Person["classBand"]): Person => ({ id: `p-${householdId}`, householdId, role: "head", classBand } as Person);
const record = (tick: number, template: string, buildingId: string): HistoryRecord =>
  ({ id: `h-${tick}-${template}`, tick, kind: "person", template, subject: { type: "household", id: buildingId }, severity: 0, place: { tx: 0, ty: 0, buildingId } });
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("install: 20 paintings and their 80 own layers, received bytes, ledgers and roofs as the batch records them", () => {
  const inbox = parseCsv(readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8"));
  const [inboxHeader, ...inboxRows] = inbox;
  const column = (name: string) => inboxHeader!.indexOf(name);
  const inboxByFile = new Map(inboxRows.map(row => [row[column("file")], row]));
  const provenance = new Map(parseCsvRows(readFileSync("docs/provenance/assets.csv", "utf8")).map(row => [row.runtimePath, row]));
  const [registrationHeader, ...registrationRows] = parseCsv(readFileSync("docs/provenance/state-layer-registration.csv", "utf8"));
  const registration = new Map(registrationRows.map(row => [row[0]!, Object.fromEntries(registrationHeader!.map((name, index) => [name, row[index]]))]));
  const [recordHeader, ...recordRows] = parseCsv(readFileSync("assets-inbox/wave26/candidates-20260928/records/generation-records.csv", "utf8").replace(/^﻿/, ""));
  const records = new Map(recordRows.map(row => [row[recordHeader!.indexOf("id")]!.replace(/-v1$/, ""), Object.fromEntries(recordHeader!.map((key, index) => [key, row[index]]))]));
  assert.equal(Object.keys(WAVE26_HOUSE_IMAGES).length, 100);
  assert.equal(WAVE26_HOUSE_VARIANTS.length, 20);
  for (const [key, image] of Object.entries(WAVE26_HOUSE_IMAGES)) {
    const runtime = `public/${image.url}`;
    assert.ok(existsSync(runtime), runtime);
    const source = records.get(key);
    assert.ok(source !== undefined, key);
    const digest = sha(runtime);
    // BLD-06: a registered layer is the batch's picture moved onto its painting (scripts/registerStateLayers.py).
    const moved = registration.get(runtime)?.decision === "registered" ? registration.get(runtime) : undefined;
    assert.equal(moved?.sourceSha256 ?? digest, source.sha256, `${key} = the batch's bytes`);
    assert.equal(digest, moved?.runtimeSha256 ?? digest, `${key} registered`);
    const row = inboxByFile.get(`wave26/candidates-20260928/${source.file}`);
    assert.equal(row?.[column("sha256")], source.sha256);
    assert.equal(row?.[column("status")], "confirmed");
    assert.equal(row?.[column("installed_by")], "INSTALL-26");
    const ledger = provenance.get(runtime);
    assert.equal(ledger?.runtimeSha256, digest);
    assert.equal(ledger?.status, "runtime");
    assert.ok(existsSync(ledger.prompt), ledger.prompt);
    assert.deepEqual([image.width, image.height], [Number(source.width), Number(source.height)]);
  }
  const roofs = WAVE26_HOUSE_VARIANTS.map(variant => `${variant.level}${variant.variant}:${variant.roof}`);
  assert.deepEqual(roofs.filter(roof => !roof.endsWith("thatch")), ["2f:clay_tile", "3e:clay_tile", "3f:clay_tile", "4c:clay_tile", "4d:clay_tile", "4e:stone_slate", "4f:stone_slate"]);
  for (const variant of WAVE26_HOUSE_VARIANTS) {
    assert.equal(variant.roof, records.get(variant.key)!.roof);
    const body = WAVE26_HOUSE_IMAGES[variant.key];
    const approved = historicalHouseAssetManifest.find(meta => meta.level === variant.level)!;
    for (const state of ["weathered", "fresh", "snow", "boarded"] as const) {
      const layer = WAVE26_HOUSE_IMAGES[`${variant.key}_${state}` as keyof typeof WAVE26_HOUSE_IMAGES];
      assert.deepEqual([layer.width, layer.height], [body.width, body.height], `${variant.key} ${state}: same canvas`);
    }
    // The crop holds the approved bounds (same registration) and the painting's canvas keeps the approved proportions.
    const bounds = approved.alphaBounds;
    assert.ok(variant.crop.x <= bounds.x && variant.crop.y <= bounds.y && variant.crop.x + variant.crop.width >= bounds.x + bounds.width
      && variant.crop.y + variant.crop.height >= bounds.y + bounds.height, variant.key);
    assert.equal(body.width / body.height, approved.width / approved.height);
  }
  const manifests = readFileSync("scripts/provenanceLedgerAssets.ts", "utf8");
  assert.match(manifests, /"src\/render\/wave26HouseManifest\.generated\.ts"/);
  assert.match(readFileSync("scripts/checks/distBudget.config.json", "utf8"), /"category": "world", "label": "house variants and their state layers \(Wave 26\)", "patterns": \["assets\/wave26\/\*\*"\]/);
});

test("choice: five paintings a level, the approved one first; a pure function of seed, household id, level and wealth", () => {
  for (let level = 0; level <= 4; level += 1) {
    const options = houseBodyOptions(level);
    assert.equal(options.length, 5);
    assert.equal(options[0]!.variant, null);
    assert.deepEqual(options.slice(1).map(option => option.variant!.variant), ["c", "d", "e", "f"]);
  }
  for (let index = 0; index < 50; index += 1) {
    const id = `construction-site-${index}`;
    assert.equal(rawHouseBody(7, id, 2, "common"), rawHouseBody(7, id, 2, "common"));
  }
  const bySeed = new Set(Array.from({ length: 40 }, (_, seed) => rawHouseBody(seed, "house-1", 1, "common").variant?.key ?? "existing"));
  assert.ok(bySeed.size >= 4, "the world seed moves the pick");
  const houses = [house("a", 2), house("b", 3), house("c", 0)];
  const state = { seed: 11, buildings: [building("a", 2, 2), building("b", 8, 2), building("c", 14, 2)], houses } as unknown as GameState;
  const first = houseBodyAssignments(state);
  assert.deepEqual(houseBodyAssignments({ ...state, tick: 9_999, houses: houses.map(entry => ({ ...entry, breadStock: 9 })) } as GameState), first,
    "nothing but the listed inputs moves it");
  // The key is the household (building id), not the plot: the same household elsewhere keeps its painting.
  const moved = houseBodyAssignments({ ...state, buildings: [building("a", 40, 30), building("b", 8, 2), building("c", 14, 2)] } as GameState);
  assert.equal(moved.get("a"), first.get("a"));
});

test("weights: commoners L0-L2 mostly thatch, rich households tile and stone slate, uniform within a roof", () => {
  const ids = Array.from({ length: 12_000 }, (_, index) => `house-${index}`);
  const share = (level: number, wealth: "common" | "rich", roof: string) =>
    ids.filter(id => rawHouseBody(3, id, level, wealth).roof === roof).length / ids.length;
  const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 0.015, `${label}: ${actual.toFixed(3)} vs ${expected.toFixed(3)}`);
  near(share(2, "common", "thatch"), 9 / 11, "L2 commoner thatch");
  near(share(2, "rich", "thatch"), 3 / 9, "L2 rich thatch");
  near(share(3, "common", "thatch"), 6 / 9, "L3 commoner thatch");
  near(share(3, "rich", "thatch"), 2 / 11, "L3 rich thatch");
  near(share(4, "rich", "stone_slate"), 4 / 13, "L4 stone slate");
  for (const level of [0, 1]) near(share(level, "rich", "thatch"), 1, `L${level} all thatch`);
  // Within a roof every painting is as likely: L0 has five thatch paintings.
  const counts = new Map<string, number>();
  for (const id of ids) { const key = rawHouseBody(3, id, 0, "common").variant?.key ?? "existing"; counts.set(key, (counts.get(key) ?? 0) + 1); }
  assert.equal(counts.size, 5);
  for (const [key, count] of counts) near(count / ids.length, 0.2, `L0 ${key}`);
  // A household whose wealth changes repaints only when its roof changes.
  for (const id of ids.slice(0, 2_000)) {
    const poor = rawHouseBody(3, id, 2, "common"); const rich = rawHouseBody(3, id, 2, "rich");
    if (poor.roof === rich.roof) assert.equal(poor, rich, id);
  }
  // The config's own sentence (L2: 82 % thatch for a commoner, 33 % rich) is what the counts give.
  assert.equal(HOUSE_VARIANT_CONFIG.roofWeight.common.thatch * 3 / (HOUSE_VARIANT_CONFIG.roofWeight.common.thatch * 3 + HOUSE_VARIANT_CONFIG.roofWeight.common.clay_tile * 2), 9 / 11);
});

test("wealth: merchant, gentry and master-artisan heads and L4 houses are rich; labour and servants common", () => {
  for (const band of ["merchant", "gentry", "artisan"]) assert.equal(householdWealth(1, band), "rich", band);
  for (const band of ["labour", "poor_servant", "clerical", undefined]) assert.equal(householdWealth(2, band), "common", String(band));
  assert.equal(householdWealth(4, "labour"), "rich");
  // Through the state: the head's band is read by household id (= the house's building id).
  const ids = Array.from({ length: 600 }, (_, index) => `h${index}`);
  const base = { seed: 5, buildings: ids.map((id, index) => building(id, (index % 30) * 3, Math.floor(index / 30) * 3)), houses: ids.map(id => house(id, 2)) };
  const thatch = (state: object) => [...houseBodyAssignments(state as GameState).values()].filter(variant => variant?.roof === "thatch").length / ids.length;
  const poor = thatch({ ...base, persons: { people: ids.map(id => head(id, "labour")), past: [], nextOrdinal: 0 } });
  const rich = thatch({ ...base, persons: { people: ids.map(id => head(id, "merchant")), past: [], nextOrdinal: 0 } });
  assert.ok(poor > 0.7 && rich < 0.4, `thatch share: labour ${poor.toFixed(2)}, merchant ${rich.toFixed(2)}`);
});

test("eligibility: burning and burnt houses and an alehouse under its stake keep the approved painting; a pair lot picks among its own", () => {
  // Seed chosen so that every one of these households would otherwise draw a Wave 26 painting.
  const seed = [...Array(200).keys()].find(candidate => ["p", "f", "b", "a"].every(id => rawHouseBody(candidate, id, 2, "common").variant !== null))!;
  const brewing = [{ craftId: BREW_ALE_CRAFT_ID, workers: 1, input: { malt: 1 }, output: { ale: 2 }, stock: { ale: 3 } }];
  const state = {
    seed,
    buildings: [building("p", 0, 0, { houseLot: "horizontal" }), building("f", 6, 0), building("b", 12, 0), building("a", 18, 0), building("n", 24, 0)],
    houses: [house("p", 2), house("f", 2), house("b", 2, { burntTick: 5 }), house("a", 2, { crafts: brewing }), house("n", 2)],
    events: { burning: [{ buildingId: "f", eventId: "fire@1", ignitedTick: 1, outTick: 90 }] },
  } as unknown as GameState;
  const assignments = houseBodyAssignments(state);
  for (const id of ["f", "b", "a"]) assert.equal(assignments.has(id), false, id);
  assert.equal(assignments.has("n"), true);
  // INSTALL-30: the pair lot is in, among the pair's paintings (the approved pair or Wave 30's), never a single's.
  assert.equal(assignments.get("p"), rawHouseBody(seed, "p", 2, "common", "horizontal").variant);
  // Put out, rebuilt, sold out: the household's own pick comes back.
  const after = houseBodyAssignments({ ...state, events: { burning: [] }, houses: [house("f", 2), house("b", 2), house("a", 2, { crafts: [{ ...brewing[0]!, stock: { ale: 0 } }] })] } as unknown as GameState);
  for (const id of ["f", "b", "a"]) assert.equal(after.get(id), rawHouseBody(seed, id, 2, "common").variant, id);
});

test("neighbour push: a touching house after one with the same raw pick takes its roof's next painting", () => {
  const seed = 9;
  const ids = Array.from({ length: 400 }, (_, index) => `n${index}`);
  const pair = (() => {
    for (const a of ids) for (const b of ids) if (a < b && rawHouseBody(seed, a, 0, "common") === rawHouseBody(seed, b, 0, "common")) return [a, b] as const;
    throw new Error("no pair");
  })();
  const [first, second] = pair;
  const raw = rawHouseBody(seed, first, 0, "common");
  const options = houseBodyOptions(0);
  const next = options[(options.indexOf(raw) + 1) % options.length]!.variant;
  const touchingState = { seed, buildings: [building(first, 4, 4), building(second, 5, 4)], houses: [house(first, 0), house(second, 0)] } as unknown as GameState;
  const assignments = houseBodyAssignments(touchingState);
  assert.equal(assignments.get(first), raw.variant);
  assert.equal(assignments.get(second), next);
  const apart = houseBodyAssignments({ ...touchingState, buildings: [building(first, 4, 4), building(second, 9, 4)] } as GameState);
  assert.equal(apart.get(second), raw.variant);
});

test("state layers: fresh two seasons after completion or while awaiting its household; weathered old, hungry, short of rent or run down", () => {
  const completions = houseCompletions({ records: [
    record(1_000, "person.move_in", "a"), record(3_000, "person.move_in", "a"), record(2_000, "person.move_in", "b"),
    record(9_000, "person.rebuilt", "b"), record(500, "person.emptied", "c"),
  ] });
  assert.deepEqual(completions.get("a"), { tick: 1_000, lived: false }, "the first move-in dates the house");
  assert.deepEqual(completions.get("b"), { tick: 9_000, lived: false }, "a rebuild dates it again");
  assert.deepEqual(completions.get("c"), { lived: true });
  const fed = house("a", 1);
  assert.equal(houseStateLayer(1_000 + 2 * SEASON - 1, fed, completions.get("a")), "fresh");
  assert.equal(houseStateLayer(1_000 + 2 * SEASON, fed, completions.get("a")), null);
  assert.equal(houseStateLayer(9_500, house("b", 1), completions.get("b")), "fresh");
  // Built, no household yet, never lived in: fresh. Emptied later, or abandoned: not.
  assert.equal(houseStateLayer(50_000, house("new", 0, { residents: 0 }), undefined), "fresh");
  assert.equal(houseStateLayer(3_000, house("c", 0, { residents: 0 }), completions.get("c")), null);
  assert.equal(houseStateLayer(3_000, house("x", 0, { residents: 0, abandonedTick: 2_000 }), undefined), null);
  // Old: ten years after completion; a founding house (no record) counts from tick 0.
  assert.equal(houseStateLayer(1_000 + 10 * YEAR - 1, fed, completions.get("a")), null);
  assert.equal(houseStateLayer(1_000 + 10 * YEAR, fed, completions.get("a")), "weathered");
  assert.equal(houseStateLayer(10 * YEAR, house("founder", 1), undefined), "weathered");
  const tick = 20_000;
  assert.equal(houseStateLayer(tick, house("founder", 1), undefined), null);
  assert.equal(houseStateLayer(tick, house("founder", 1, { foodShortSinceTick: 19_000 }), undefined), "weathered", "hungry");
  assert.equal(houseStateLayer(tick, house("founder", 1, { leavingSinceTick: 19_500 }), undefined), "weathered", "pays half its rent");
  assert.equal(houseStateLayer(tick, house("founder", 1, { breadStock: 0, emptyFoodTicks: 999 }), undefined), "weathered", "starving: pays none");
  assert.equal(houseStateLayer(tick, house("founder", 1, { builtLevel: 2 }), undefined), "weathered", "strained: a level lost");
  assert.equal(houseStateLayer(tick, house("founder", 1, { unmetRequirementTicks: 1_200 }), undefined), "weathered", "neglected");
  // Fresh wins: a house two seasons old has not weathered, even hungry.
  assert.equal(houseStateLayer(1_500, house("a", 1, { foodShortSinceTick: 1_200 }), completions.get("a")), "fresh");
});

test("frame cache: entries and assignments for a 400-house, 2,000-person town (its times go to the DGX trend)", () => {
  const ids = Array.from({ length: 400 }, (_, index) => `t${index}`);
  const state = {
    seed: 21, buildings: ids.map((id, index) => building(id, (index % 20) * 2, Math.floor(index / 20) * 2)),
    houses: ids.map((id, index) => house(id, index % 5)),
    persons: { people: Array.from({ length: 2_000 }, (_, index) => ({ ...head(ids[index % 400]!, index % 7 === 0 ? "merchant" : "labour"), role: index < 400 ? "head" : "child", id: `p${index}` })), past: [], nextOrdinal: 0 },
  } as unknown as GameState;
  let start = performance.now();
  const entries = houseBodyEntries(state);
  const entriesMs = performance.now() - start;
  start = performance.now();
  houseBodyAssignments(state, entries);
  const pushMs = performance.now() - start;
  start = performance.now();
  for (let frame = 0; frame < 100; frame += 1) beginHouseVariantFrame(state);
  const heldMs = (performance.now() - start) / 100;
  start = performance.now();
  beginHouseVariantFrame({ ...state, houses: [...state.houses] });
  const newTickMs = performance.now() - start;
  console.log(`# INSTALL-26 frame cache: entries ${entriesMs.toFixed(2)} ms, push ${pushMs.toFixed(2)} ms, held frame ${heldMs.toFixed(4)} ms, new houses array ${newTickMs.toFixed(2)} ms`);
  assert.equal(entries.length, 400);
  // The INSTALL-26 budgets are wall-clock times (one failed a clean clone on a loaded DGX, FIX-11), so the DGX trend
  // keeps them (docs/verification/wall-clock-tests.md). Whether a held frame is really reused cannot be seen without the clock until
  // the frame cache tells (render session, listed there).
  recordCodeBudget("install26-entries", "INSTALL-26 집 400채 항목 ms", entriesMs, 50);
  recordCodeBudget("install26-assign", "INSTALL-26 집 그림 배정 ms", pushMs, 100);
  recordCodeBudget("install26-held", "INSTALL-26 같은 입력 프레임 ms", heldMs, 0.5);
  recordCodeBudget("install26-new-houses", "INSTALL-26 새 집 배열 프레임 ms", newTickMs, 50);
});
