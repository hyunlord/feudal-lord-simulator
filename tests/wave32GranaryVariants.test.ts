import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { readPng } from "../scripts/processBuildingSprite";
import { parseCsv, parseCsvRows } from "../scripts/provenanceLedgerCsv";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { buildingSpriteKeyOf } from "../src/content/buildingCatalog";
import type { GameState } from "../src/engine/engine.types";
import { BUILDING_SPRITE_ALPHA } from "../src/render/buildingSpriteFit.generated";
import {
  GRANARY_FULL_FROM, GRANARY_HALF_FROM, granaryFill, granaryLayerKeys, granaryLayers, granaryStockRatio, granaryVariantAssignments, rawGranaryVariant,
} from "../src/render/granaryVariantChoice";
import { resetSeasonBlendForTest } from "../src/render/seasonTransition";
import { WAVE32_GRANARY_IMAGES, WAVE32_GRANARY_PROPS, WAVE32_GRANARY_VARIANTS } from "../src/render/wave32GranaryManifest.generated";
import { spriteMeta } from "../src/render/worldAssets";

// INSTALL-32 the Wave 32 granaries: install consistency (granary b's snow and boarded from the rework), the per-granary
// choice and its push, the stock-ratio states and the layers' precedence.

const granary = (id: string, tx: number, ty: number, fields: Partial<Building> = {}): Building =>
  ({ id, kind: "granary", tx, ty, workers: 2, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const STATES = ["full", "half", "empty", "snow", "boarded", "weathered"] as const;
const YEAR = 4_000;
const SUMMER = 12 * YEAR + 1_500;
const WINTER = 12 * YEAR + 3_500;

test("install: three paintings on the barn's canvas, their six layers, five props; bytes, ledgers, the rework's b snow and boarded", () => {
  const [inboxHeader, ...inboxRows] = parseCsv(readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8"));
  const column = (name: string) => inboxHeader!.indexOf(name);
  const inboxByFile = new Map(inboxRows.map(row => [row[column("file")], row]));
  const provenance = new Map(parseCsvRows(readFileSync("docs/provenance/assets.csv", "utf8")).map(row => [row.runtimePath, row]));
  assert.equal(Object.keys(WAVE32_GRANARY_IMAGES).length, 26);
  assert.deepEqual(WAVE32_GRANARY_VARIANTS.map(variant => `${variant.variant}:${variant.roof}`), ["a:thatch", "b:muted clay tile", "c:warm grey stone slabs"]);
  const reworked = new Set(["granary_b_snow", "granary_b_boarded"]);
  for (const [key, image] of Object.entries(WAVE32_GRANARY_IMAGES)) {
    const runtime = `public/${image.url}`;
    assert.ok(existsSync(runtime), runtime);
    const batch = reworked.has(key) ? "rework-20260929" : "candidates-20260929";
    const source = `assets-inbox/wave32/${batch}/assets/${key}-v1.png`;
    const digest = sha(runtime);
    assert.equal(digest, sha(source), `${key} = the received bytes`);
    const row = inboxByFile.get(`wave32/${batch}/assets/${key}-v1.png`);
    assert.equal(row?.[column("sha256")], digest);
    assert.equal(row?.[column("status")], "confirmed");
    assert.equal(row?.[column("installed_by")], "INSTALL-32");
    const ledger = provenance.get(runtime);
    assert.equal(ledger?.runtimeSha256, digest);
    assert.equal(ledger?.status, "runtime");
    assert.ok(existsSync(ledger.prompt), ledger.prompt);
    const { dimensions } = readPng(runtime);
    assert.deepEqual([dimensions.width, dimensions.height], [image.width, image.height], key);
  }
  // The candidates' b snow and boarded stay superseded and uninstalled.
  for (const state of ["snow", "boarded"]) {
    const row = inboxByFile.get(`wave32/candidates-20260929/assets/granary_b_${state}-v1.png`);
    assert.equal(row?.[column("status")], "superseded");
    assert.equal(row?.[column("installed_by")], "");
  }
  // barn.png's canvas and pivot: the paintings take its frame, fit and depth unchanged.
  const barn = spriteMeta("barn")!;
  for (const variant of WAVE32_GRANARY_VARIANTS) {
    for (const key of [variant.key, ...STATES.map(state => `${variant.key}_${state}` as const)]) {
      const image = WAVE32_GRANARY_IMAGES[key];
      assert.deepEqual([image.width, image.height, image.pivot.x, image.pivot.y], [barn.width, barn.height, barn.anchor.x, barn.anchor.y], key);
    }
  }
  assert.deepEqual(BUILDING_SPRITE_ALPHA.barn.alpha, { x: 31, y: 3, width: 99, height: 126 });
  assert.equal(WAVE32_GRANARY_PROPS.length, 5);
  assert.match(readFileSync("scripts/provenanceLedgerAssets.ts", "utf8"), /"src\/render\/wave32GranaryManifest\.generated\.ts"/);
  assert.match(readFileSync("scripts/checks/distBudget.config.json", "utf8"), /"patterns": \["assets\/wave32\/\*\*"\]/);
});

test("the granary is the only kind drawing barn.png", () => {
  const kinds = Object.keys(BUILDING_CONFIG_BY_KIND) as BuildingKind[];
  assert.deepEqual(kinds.filter(kind => buildingSpriteKeyOf(kind) === "barn"), ["granary"]);
});

test("choice: a pure function of seed and building id, near-uniform over a-c, the plot does not move it; touching granaries pushed", () => {
  assert.equal(rawGranaryVariant(7, "construction-site-000023"), rawGranaryVariant(7, "construction-site-000023"));
  const counts = new Map<string, number>();
  for (let index = 0; index < 9_000; index += 1) {
    const key = rawGranaryVariant(3, `construction-site-${index}`).key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 3);
  for (const [key, count] of counts) assert.ok(Math.abs(count / 9_000 - 1 / 3) < 0.02, `${key} ${count}`);
  const bySeed = new Set(Array.from({ length: 30 }, (_, seed) => rawGranaryVariant(seed, "granary-1").key));
  assert.equal(bySeed.size, 3, "the world seed moves the pick");
  const state = { seed: 5, buildings: [granary("g-1", 10, 10), granary("g-2", 30, 10)] } as unknown as GameState;
  const first = granaryVariantAssignments(state);
  const moved = granaryVariantAssignments({ ...state, buildings: [granary("g-1", 40, 40), granary("g-2", 30, 10)] } as GameState);
  assert.equal(moved.get("g-1"), first.get("g-1"), "keyed by the granary, not its plot");
  // Two touching granaries with the same raw pick: the later one in (ty, tx) order takes the next painting.
  const ids = Array.from({ length: 200 }, (_, index) => `g-${index}`);
  const twin = ids.find(id => id !== "g-0" && rawGranaryVariant(5, id) === rawGranaryVariant(5, "g-0"))!;
  const pair = granaryVariantAssignments({ seed: 5, buildings: [granary("g-0", 10, 10), granary(twin, 12, 10)] } as unknown as GameState);
  const raw = rawGranaryVariant(5, "g-0");
  assert.equal(pair.get("g-0"), raw);
  assert.equal(pair.get(twin), WAVE32_GRANARY_VARIANTS[(WAVE32_GRANARY_VARIANTS.indexOf(raw) + 1) % 3]);
  // Apart (a tile between), no push.
  const apart = granaryVariantAssignments({ seed: 5, buildings: [granary("g-0", 10, 10), granary(twin, 13, 10)] } as unknown as GameState);
  assert.equal(apart.get(twin), raw);
  // Only granaries are assigned.
  const mixed = granaryVariantAssignments({ seed: 5, buildings: [granary("g-0", 10, 10), { ...granary("s-1", 20, 20), kind: "storehouse" }] } as unknown as GameState);
  assert.deepEqual([...mixed.keys()], ["g-0"]);
});

test("stock: the ratio is all a granary holds over its capacity; full from two thirds, half from a fifth, else empty", () => {
  assert.equal(GRANARY_FULL_FROM, 2 / 3);
  assert.equal(GRANARY_HALF_FROM, 1 / 5);
  assert.equal(granaryStockRatio(granary("g", 0, 0, { inventory: { wheat: 80, bread: 20, barley: 20 } })), 0.6);
  assert.equal(granaryStockRatio(granary("g", 0, 0, { inventory: {}, reserved: { wheat: 100 } })), 0, "incoming stock is not in it yet");
  const fill = (amount: number) => granaryFill(granaryStockRatio(granary("g", 0, 0, { inventory: { bread: amount } })));
  assert.deepEqual([0, 1, 39, 40, 133, 134, 200].map(fill), ["empty", "empty", "empty", "half", "half", "full", "full"]);
});

test("layers: weathered under the fill, boards instead of the fill, snow over everything", () => {
  resetSeasonBlendForTest();
  const summer = { tick: SUMMER } as GameState;
  const [a] = WAVE32_GRANARY_VARIANTS;
  const keys = (state: GameState, building: Building) => granaryLayerKeys(a, granaryLayers(state, building)).map(key => key.replace(`${a.key}_`, ""));
  assert.deepEqual(keys(summer, granary("g", 4, 4, { inventory: { wheat: 150 } })), ["full"]);
  assert.deepEqual(keys(summer, granary("g", 4, 4, { inventory: { wheat: 60 } })), ["half"]);
  assert.deepEqual(keys(summer, granary("g", 4, 4)), ["empty"]);
  // Unkept (fewer hands than it needs) and running: weathered first, the fill over it.
  assert.deepEqual(keys(summer, granary("g", 4, 4, { workers: 1, inventory: { wheat: 150 } })), ["weathered", "full"]);
  // Shut by the lord: the boards, no fill (the stock stays in it), and not weathered (a paused granary has no hands by design).
  assert.deepEqual(keys(summer, granary("g", 4, 4, { operationPaused: true, workers: 0, inventory: { wheat: 150 } })), ["boarded"]);
  assert.deepEqual(keys(summer, granary("g", 4, 4, { upkeepUnpaid: true, workers: 0 })), ["boarded"]);
  resetSeasonBlendForTest();
  const winter = { tick: WINTER } as GameState;
  assert.deepEqual(keys(winter, granary("g", 4, 4, { inventory: { wheat: 150 } })), ["full", "snow"], "snow on the roof, the open door kept");
  assert.deepEqual(keys(winter, granary("g", 4, 4, { workers: 0, inventory: { wheat: 60 } })), ["weathered", "half", "snow"]);
  assert.deepEqual(keys(winter, granary("g", 4, 4, { operationPaused: true, workers: 0 })), ["boarded", "snow"]);
  resetSeasonBlendForTest();
});
