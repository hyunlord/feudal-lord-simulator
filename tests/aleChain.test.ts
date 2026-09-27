/**
 * C4 the ale chain (spec docs/design/ale-chain.md AL-1…AL-9): scenarios A1–A8.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALE_BALANCE } from "../src/content/aleConfig";
import { BUILDING_CONFIG_BY_KIND, fieldOutputResource, type Building } from "../src/content/buildingConfig";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { RESOURCE_CATALOG, STORAGE_KIND_BY_RESOURCE } from "../src/content/resourceCatalog";
import { RESOURCE_COPY } from "../src/content/resourceCatalog.ko";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { advanceAle, aleRequired, aleServedHouses, alehouses, brewingSlot, setFarmsteadCrop } from "../src/engine/ale";
import { aleChainAction } from "../src/engine/autoplayEra";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { stepProduction } from "../src/economy/production";
import { updateHouse } from "../src/population/housing";
import type { House } from "../src/population/population.types";
import { expectedAnnualWheat } from "../src/zones/arableOutlook";
import { stepArableFields } from "../src/zones/arableFields";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";

const YEAR = 4000;
const BATCH = 400;

/** The 24-house walled town (v22 fixture): three barns, houses of levels 1–3, its persons. */
function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  return { ...state, politics: initialPolitics(state) };
}
const barns = (state: GameState) => state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id));
/** A malt kiln (built) next to the first house, holding `malt`. */
function withKiln(state: GameState, malt: number): GameState {
  const home = state.buildings.find(building => building.id === state.houses[0]!.buildingId)!;
  const kiln: Building = { id: "malt_kiln-test", kind: "malt_kiln", tx: home.tx + 1, ty: home.ty + 1, workers: 2, inventory: { malt }, reserved: {}, stockReserved: {}, productionProgress: 0 };
  return { ...state, buildings: [...state.buildings, kiln] };
}
const atBatch = (state: GameState) => ({ ...state, tick: Math.ceil((state.tick + 1) / BATCH) * BATCH });

test("A1 (AL-1) barley, malt and ale are three lines of the catalog: five groups, their stores, their names — and no hops", () => {
  const ids = RESOURCE_CATALOG.map(entry => entry.id);
  assert.deepEqual(ids.filter(id => ["barley", "malt", "ale"].includes(id)), ["barley", "malt", "ale"]);
  assert.deepEqual([...new Set(RESOURCE_CATALOG.map(entry => entry.group))].sort(), ["drink", "food", "goods", "money", "raw"]);
  assert.deepEqual([STORAGE_KIND_BY_RESOURCE.barley, STORAGE_KIND_BY_RESOURCE.malt, STORAGE_KIND_BY_RESOURCE.ale], ["granary", "granary", "storehouse"]);
  assert.deepEqual([RESOURCE_COPY.barley.name, RESOURCE_COPY.malt.name, RESOURCE_COPY.ale.name], ["보리", "엿기름", "에일"]);
  assert.ok(!ids.some(id => /hop/.test(id)), "no hops before the 1400s");
});

test("A2 (AL-2) a barn set to barley sows barley, harvests a quarter more than wheat, carts its old wheat first, and leaves the wheat outlook", () => {
  const base = town();
  const barn = barns(base)[0]!;
  const barley = gameReducer(base, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
  assert.equal(barley.buildings.find(building => building.id === barn.id)!.crop, "barley");
  assert.equal(gameReducer(barley, { type: "set_farmstead_crop", buildingId: barn.id, crop: "wheat" }).buildings.find(building => building.id === barn.id)!.crop, undefined);
  assert.equal(setFarmsteadCrop(base, barns(base)[0]!.id, "wheat"), base, "already wheat");
  assert.equal(setFarmsteadCrop(base, base.houses[0]!.buildingId, "barley"), base, "only a farmstead");
  // The old wheat leaves the barn first; then its crop.
  const switched = barley.buildings.find(building => building.id === barn.id)!;
  assert.equal(fieldOutputResource(switched), (switched.inventory.wheat ?? 0) > 0 ? "wheat" : "barley");
  assert.equal(fieldOutputResource({ ...switched, inventory: {} }), "barley");
  assert.ok(expectedAnnualWheat(barley) < expectedAnnualWheat(base), "a barley barn's strips feed no one");
  // The harvest: every ripe strip barley, worked through the harvest window.
  const harvest = (state: GameState, crop: "wheat" | "barley") => {
    let next: GameState = { ...state, tick: Math.floor(state.tick / YEAR) * YEAR + YEAR + 2100,
      buildings: state.buildings.map(building => building.kind === "farmstead" ? { ...building, workers: 40, inventory: {} } : building),
      arableFields: (state.arableFields ?? []).map(field => ({ ...field, strips: field.strips.map(strip => ({ ...strip, crop, stage: "ripe" as const, completionPermille: 1000 })) })) };
    for (let step = 0; step < 300; step += 1) next = stepArableFields({ ...next, tick: next.tick + 1 }).state;
    return next.buildings.filter(building => building.kind === "farmstead").reduce((sum, building) => sum + (building.inventory[crop] ?? 0), 0);
  };
  const wheat = harvest(base, "wheat"), barleyHarvest = harvest(base, "barley");
  assert.ok(wheat > 0, `wheat ${wheat}`);
  assert.ok(barleyHarvest > wheat && barleyHarvest <= Math.ceil(wheat * 1.25) + 20, `barley ${barleyHarvest} vs wheat ${wheat}`);
});

test("A3 (AL-3) the malt kiln turns barley into malt by labour alone (2×2, no fuel)", () => {
  const definition = BUILDING_CONFIG_BY_KIND.malt_kiln;
  assert.deepEqual([definition.width, definition.height, definition.production?.input, definition.production?.output], [2, 2, "barley", "malt"]);
  let kiln: Building = { id: "k", kind: "malt_kiln", tx: 0, ty: 0, workers: 2, inventory: { barley: 3 }, reserved: {}, stockReserved: {}, productionProgress: 0 };
  let made = 0;
  for (let step = 0; step < definition.production!.ticksPerOutput * 3; step += 1) {
    const result = stepProduction(kiln, definition);
    kiln = result.building;
    if (result.produced !== null) made += 1;
  }
  assert.deepEqual([made, kiln.inventory.malt, kiln.inventory.barley ?? 0], [3, 3, 0]);
  const idle = stepProduction({ ...kiln, workers: 0, inventory: { barley: 1 } }, definition);
  assert.equal(idle.produced, null, "no workers, no malt");
});

test("A4 (AL-4) a household with a woman takes up brewing, fetches malt from a store in reach and brews two casks a batch", () => {
  const base = withKiln(town(), 50);
  const first = base.houses[0]!;
  const brewed = advanceAle(atBatch(base));
  const slot = brewingSlot(brewed.houses.find(house => house.buildingId === first.buildingId)!)!;
  assert.equal(slot.craftId, "brew_ale");
  assert.deepEqual([slot.stock.ale, slot.stock.malt ?? 0], [2, 0]);
  const kiln = brewed.buildings.find(building => building.id === "malt_kiln-test")!;
  assert.ok((kiln.inventory.malt ?? 0) < 50, "the malt came from the kiln");
  // No woman in the house: no brewing.
  const men = { ...base, persons: { ...base.persons!, people: base.persons!.people.map(person => person.householdId === first.buildingId ? { ...person, sex: "male" as const } : person) } };
  assert.equal(brewingSlot(advanceAle(atBatch(men)).houses.find(house => house.buildingId === first.buildingId)!), null);
  // A town with neither malt nor a kiln brews nothing.
  assert.equal(advanceAle(atBatch(town())).houses.some(house => brewingSlot(house) !== null), false);
});

test("A5 (AL-5) a level-2 house with ale is an alehouse; each season the houses in reach drink a cask and the alehouse pays its dues", () => {
  let state = withKiln(town(), 40);
  for (let batch = 0; batch < 3; batch += 1) state = advanceAle(atBatch(state));
  const stakes = alehouses(state);
  assert.ok(stakes.length > 0, "alehouses");
  assert.ok(stakes.every(id => state.houses.find(house => house.buildingId === id)!.level >= ALE_BALANCE.alehouseMinLevel));
  const served = aleServedHouses(state);
  assert.ok(served.size >= stakes.length);
  const aleBefore = state.houses.reduce((sum, house) => sum + (brewingSlot(house)?.stock.ale ?? 0), 0);
  const seasonTick = Math.ceil((state.tick + 1) / 1000) * 1000;
  const drunk = advanceAle({ ...state, tick: seasonTick % BATCH === 0 ? seasonTick + 1000 * 2 : seasonTick });
  const aleAfter = drunk.houses.reduce((sum, house) => sum + (brewingSlot(house)?.stock.ale ?? 0), 0);
  const drinkers = state.houses.filter(house => house.level >= 2 && house.residents > 0 && served.has(house.buildingId)).length;
  assert.ok(aleAfter < aleBefore + 2 * state.houses.length, "some was drunk");
  const dues = drunk.ledger!.entries.filter(entry => entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail).startsWith("alehouse:")));
  assert.ok(dues.length > 0 && drinkers > 0);
});

test("A6 (AL-6) from 1318 (chapter 2) a house rises to level 2+ only with an alehouse in reach, and never falls for want of ale", () => {
  const base = town();
  assert.equal(aleRequired({ ...base, tick: 60_000 }), false);
  assert.equal(aleRequired({ ...base, tick: 60_000, politics: { ...base.politics!, chapter: { ...base.politics!.chapter, number: CHAPTER_TWO.chapter } } }), true);
  assert.equal(aleRequired({ ...base, tick: 72_000, scenarioId: SANDBOX_SCENARIO_ID }), true);
  const house: House = { buildingId: "h", level: 1, residents: 8, hasWater: true, breadStock: 9, lastServicedTick: 0, unmetRequirementTicks: 0, promotionTicks: 2_399 };
  const context = { tick: 100, hasGranaryNearby: true, hasMarketAccess: true, hasChurchAccess: true, palisadeProtection: "inside" as const };
  assert.equal(updateHouse(house, context).level, 2, "no ale needed");
  assert.equal(updateHouse(house, { ...context, aleBlocked: true }).level, 1, "blocked without an alehouse");
  assert.equal(updateHouse({ ...house, level: 2, promotionTicks: 0 }, { ...context, aleBlocked: true }).level, 2, "kept without ale");
});

test("A7 (AL-8) the bot, once ale is required: one barn to barley (the last of two or more), then a malt kiln", () => {
  const base = town();
  const chapter2 = { ...base, politics: { ...base.politics!, chapter: { ...base.politics!.chapter, number: CHAPTER_TWO.chapter } } };
  const build = (_state: GameState, kind: string) => ({ kind: "place_building" as const, building: kind as "malt_kiln", tx: 1, ty: 1 });
  assert.deepEqual(aleChainAction({ ...base, tick: 60_000 }, build), { kind: "none" });
  assert.deepEqual(aleChainAction(chapter2, build), { kind: "set_farmstead_crop", buildingId: barns(base).at(-1)!.id, crop: "barley" });
  const barley = setFarmsteadCrop(chapter2, barns(base).at(-1)!.id, "barley");
  assert.deepEqual(aleChainAction(barley, build), { kind: "place_building", building: "malt_kiln", tx: 1, ty: 1 });
  assert.deepEqual(aleChainAction(withKiln(barley, 0), build), { kind: "none" });
});

test("A8 (AL-9) the save round trip (v23) keeps the crop and the brewing slots; a v22 town opens growing wheat; the same batches twice", () => {
  let state = setFarmsteadCrop(withKiln(town(), 10), barns(town())[0]!.id, "barley");
  state = advanceAle(atBatch(state));
  const again = advanceAle(atBatch(setFarmsteadCrop(withKiln(town(), 10), barns(town())[0]!.id, "barley")));
  assert.deepEqual(again, state);
  assert.equal(SAVE_SCHEMA_VERSION, 23);
  const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-28T00:00:00.000Z", savedAt: "2026-09-28T00:00:00.000Z" }).bytes);
  assert.deepEqual(saved.envelope.state, state);
  const v22 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json")));
  assert.equal(v22.migratedFrom, 22);
  assert.ok((v22.envelope.state as GameState).buildings.every(building => building.crop === undefined));
});
