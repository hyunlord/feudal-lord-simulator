import assert from "node:assert/strict";
import test from "node:test";
import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { clothWorkerSheet } from "../src/render/clothWorkerSheet";
import { walkerSheet } from "../src/render/walkerLook";
import { walkerSheetManifest } from "../src/render/walkerSheetManifest.generated";
import { WAVE3_CLOTH_IMAGES } from "../src/render/wave3ClothManifest.generated";
import { walkerAppearance } from "../src/render/walkerComposer";
import { readFileSync } from "node:fs";
import { decodeSave } from "../src/save/saveCodec";

// UI-9: Wave 3 cloth worker sheets — manifest frames, walker-sheet registration, and mapping.

const building = (kind: Building["kind"], fields: Partial<Building> = {}): Building =>
  ({ id: `${kind}-1`, kind, tx: 8, ty: 10, workers: 1, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;

const carter = (homeBuildingId: string): Walker =>
  ({ id: `carter:${homeBuildingId}`, kind: "carter", homeBuildingId, position: { tx: 3, ty: 3 }, path: [],
    pathIndex: 0, previousTile: null, cargo: { resource: "fleece", amount: 4 }, spawnedTick: 0 }) as unknown as Walker;

function palisadeTown(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
}

test("UI-9: wave3ClothManifest carries frames for wk_shepherd, wk_fuller and wk_wool_merchant matching the CSV", () => {
  // wk_shepherd and wk_fuller: 294 x 147, template civilian_man
  for (const key of ["wk_shepherd", "wk_fuller"] as const) {
    const entry = WAVE3_CLOTH_IMAGES[key];
    assert.ok("frames" in entry, `${key} should have a frames record`);
    const frames = (entry as typeof entry & { frames: Record<string, unknown> }).frames;
    assert.equal(frames["columns"], 4, `${key} columns`);
    assert.equal(frames["rows"], 2, `${key} rows`);
    assert.equal(frames["cellWidth"], 294 / 4, `${key} cellWidth`);
    assert.equal(frames["cellHeight"], 147 / 2, `${key} cellHeight`);
    assert.deepEqual(frames["directions"], ["NE", "SE", "SW", "NW"], `${key} directions`);
    assert.equal(frames["template"], "civilian_man", `${key} template`);
  }
  // wk_wool_merchant: 285 x 142, template merchant
  const wm = WAVE3_CLOTH_IMAGES["wk_wool_merchant"];
  assert.ok("frames" in wm, "wk_wool_merchant should have a frames record");
  const wmFrames = (wm as typeof wm & { frames: Record<string, unknown> }).frames;
  assert.equal(wmFrames["columns"], 4);
  assert.equal(wmFrames["rows"], 2);
  assert.equal(wmFrames["cellWidth"], 285 / 4, "wk_wool_merchant cellWidth");
  assert.equal(wmFrames["cellHeight"], 142 / 2, "wk_wool_merchant cellHeight");
  assert.deepEqual(wmFrames["directions"], ["NE", "SE", "SW", "NW"]);
  assert.equal(wmFrames["template"], "merchant");
});

test("UI-9: walkerSheetManifest registers the three cloth workers with band 'cloth' and correct templates", () => {
  const clothSheets = walkerSheetManifest.filter(s => s.classBand === "cloth");
  const ids = clothSheets.map(s => s.id).sort();
  assert.deepEqual(ids, ["wk_fuller", "wk_shepherd", "wk_wool_merchant"]);

  const shepherd = walkerSheet("wk_shepherd");
  assert.equal(shepherd.classBand, "cloth");
  assert.equal(shepherd.template, "civilian_man");
  assert.equal(shepherd.sex, "male");
  // shepherd and fuller take the male cloak (poke < CLOAK_POKE_LIMIT); wool merchant takes the merchant cloak.
  assert.equal(shepherd.cloak, "male");

  const fuller = walkerSheet("wk_fuller");
  assert.equal(fuller.classBand, "cloth");
  assert.equal(fuller.template, "civilian_man");
  assert.equal(fuller.sex, "male");
  assert.equal(fuller.cloak, "male");

  const woolMerchant = walkerSheet("wk_wool_merchant");
  assert.equal(woolMerchant.classBand, "cloth");
  assert.equal(woolMerchant.template, "merchant");
  assert.equal(woolMerchant.sex, "male");
  assert.equal(woolMerchant.cloak, "merchant");

  // All three have 8 frames (4 directions × 2 gait rows)
  for (const sheet of [shepherd, fuller, woolMerchant]) {
    assert.equal(sheet.frames.length, 8, `${sheet.id} should have 8 frames`);
    const dirs = new Set(sheet.frames.map(f => f.direction));
    assert.deepEqual([...dirs].sort(), ["NE", "NW", "SE", "SW"]);
  }
});

test("UI-9: clothWorkerSheet maps building kind to the right sheet or null", () => {
  const farm = building("pastoral_farm", { id: "farm-1" });
  const mill = building("fulling_mill", { id: "mill-1" });
  const dye = building("dyehouse", { id: "dye-1" });
  const tenter = building("tenter_yard", { id: "tenter-1" });
  const kiln = building("malt_kiln", { id: "kiln-1" });

  const state = { buildings: [farm, mill, dye, tenter, kiln] } as unknown as GameState;

  assert.equal(clothWorkerSheet(state, carter("farm-1")), "wk_shepherd");
  assert.equal(clothWorkerSheet(state, carter("mill-1")), "wk_fuller");
  assert.equal(clothWorkerSheet(state, carter("dye-1")), "wk_wool_merchant");
  assert.equal(clothWorkerSheet(state, carter("tenter-1")), "wk_wool_merchant");
  assert.equal(clothWorkerSheet(state, carter("kiln-1")), null, "malt_kiln → null (ale chain)");
  assert.equal(clothWorkerSheet(state, carter("unknown")), null, "unknown building → null");

  // Non-carter walkers are not matched
  const nonCarter = { ...carter("farm-1"), kind: "builder" } as unknown as Walker;
  assert.equal(clothWorkerSheet(state, nonCarter), null, "builder kind → null");
});

test("UI-9: walkerAppearance gives a pastoral_farm carter the shepherd sheet; cloak inactive outside winter", () => {
  const town = palisadeTown();
  const farm = building("pastoral_farm", { id: "farm-x", tx: 5, ty: 5 });
  const state = { ...town, buildings: [...town.buildings, farm] };
  const walker = carter("farm-x");
  const appearance = walkerAppearance({ ...state, walkers: [walker] }, walker);
  assert.equal(appearance.look.sheetId, "wk_shepherd");
  assert.equal(appearance.cloak, null, "palisade save is not winter — cloak inactive outside season 3");
});

test("UI-9: walkerAppearance gives a fulling_mill carter the fuller sheet", () => {
  const town = palisadeTown();
  const mill = building("fulling_mill", { id: "mill-x", tx: 6, ty: 6 });
  const state = { ...town, buildings: [...town.buildings, mill] };
  const walker = { ...carter("mill-x"), cargo: { resource: "fulled_cloth", amount: 2 } } as unknown as Walker;
  const appearance = walkerAppearance({ ...state, walkers: [walker] }, walker);
  assert.equal(appearance.look.sheetId, "wk_fuller");
});

test("UI-9: walkerAppearance gives a dyehouse / tenter_yard carter the wool merchant sheet", () => {
  const town = palisadeTown();
  const dye = building("dyehouse", { id: "dye-x", tx: 7, ty: 7 });
  const tenter = building("tenter_yard", { id: "tenter-x", tx: 8, ty: 8 });
  const state = { ...town, buildings: [...town.buildings, dye, tenter] };
  for (const [id, resource] of [["dye-x", "dyed_cloth"], ["tenter-x", "finished_cloth"]] as const) {
    const walker = { ...carter(id), cargo: { resource, amount: 1 } } as unknown as Walker;
    const appearance = walkerAppearance({ ...state, walkers: [walker] }, walker);
    assert.equal(appearance.look.sheetId, "wk_wool_merchant", `${id} → wk_wool_merchant`);
  }
});
