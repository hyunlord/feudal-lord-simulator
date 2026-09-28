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
import { aleChainAction, aleWantsBarley, KILN_NEAR_BARN } from "../src/engine/autoplayEra";
import { canPlaceBuilding } from "../src/world/placement";
import { arableSupplyShort } from "../src/engine/autoplayArable";
import { deliverCandidate } from "../src/agents/deliveryBuildingCandidates";
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

test("A5 (AL-5) a brewing level-2 house is an alehouse; each season a brewer drinks her own ale, the other houses in reach buy a cask and the alehouse pays its dues", () => {
  // Every other house has no woman of fourteen or more: it cannot brew and buys its ale.
  const base = withKiln(town(), 40);
  const buyers = new Set(base.houses.filter((_house, index) => index % 2 === 1).map(house => house.buildingId));
  let state: GameState = { ...base, persons: { ...base.persons!, people: base.persons!.people.map(person => buyers.has(person.householdId ?? "") ? { ...person, sex: "male" as const } : person) } };
  for (let batch = 0; batch < 3; batch += 1) state = advanceAle(atBatch(state));
  const stakes = alehouses(state);
  assert.ok(stakes.length > 0, "alehouses");
  assert.ok(stakes.every(id => state.houses.find(house => house.buildingId === id)!.level >= ALE_BALANCE.alehouseMinLevel));
  assert.ok(state.houses.filter(house => buyers.has(house.buildingId)).every(house => brewingSlot(house) === null), "the buyers do not brew");
  const served = aleServedHouses(state);
  assert.ok(state.houses.filter(house => (brewingSlot(house)?.stock.ale ?? 0) > 0).every(house => served.has(house.buildingId)), "a brewer with ale is served by it");
  const seasonTick = Math.ceil((state.tick + 1) / 1000) * 1000;
  const drunk = advanceAle({ ...state, tick: seasonTick % BATCH === 0 ? seasonTick + 1000 * 2 : seasonTick });
  const brewers = state.houses.filter(house => (brewingSlot(house)?.stock.ale ?? 0) > 0);
  for (const brewer of brewers) {
    const after = drunk.houses.find(house => house.buildingId === brewer.buildingId)!;
    assert.ok(after.aleUntilTick === drunk.tick + ALE_BALANCE.aleServedTicks, `${brewer.buildingId} drank`);
  }
  const boughtBy = drunk.houses.filter(house => buyers.has(house.buildingId) && house.level >= 1 && house.aleUntilTick === drunk.tick + ALE_BALANCE.aleServedTicks);
  assert.ok(boughtBy.length > 0, "buyers drank from an alehouse");
  const dues = drunk.ledger!.entries.filter(entry => entry.tick === drunk.tick && entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail).startsWith("alehouse:")));
  const casks = dues.reduce((sum, entry) => sum + Number(String(entry.sourceRefs[0]!.detail).split(":")[1]), 0);
  assert.equal(casks, boughtBy.length, "the alehouses are paid for what the buyers drank, not for the brewers' own");
});

test("A6 (AL-6) from 1318 (chapter 2) a house rises to level 2+ half as slowly again without ale, and never falls for want of ale", () => {
  const base = town();
  assert.equal(aleRequired({ ...base, tick: 60_000 }), false);
  assert.equal(aleRequired({ ...base, tick: 80_000 }), false, "a campaign still in chapter 1 after 1318 need not brew");
  assert.equal(aleRequired({ ...base, tick: 60_000, politics: { ...base.politics!, chapter: { ...base.politics!.chapter, number: CHAPTER_TWO.chapter } } }), true);
  assert.equal(aleRequired({ ...base, tick: 72_000, scenarioId: SANDBOX_SCENARIO_ID }), true);
  const house: House = { buildingId: "h", level: 1, residents: 8, hasWater: true, breadStock: 9, lastServicedTick: 0, unmetRequirementTicks: 0, promotionTicks: 2_399 };
  const context = { tick: 100, hasGranaryNearby: true, hasMarketAccess: true, hasChurchAccess: true, palisadeProtection: "inside" as const };
  assert.equal(updateHouse(house, context).level, 2, "no ale needed");
  assert.equal(updateHouse(house, { ...context, aleServed: false }).level, 1, "slowed without ale (150 % of the hold)");
  assert.equal(updateHouse({ ...house, promotionTicks: 3_599 }, { ...context, aleServed: false }).level, 2, "never blocked: it rises after 3,600 ticks");
  assert.equal(updateHouse({ ...house, level: 2, promotionTicks: 0 }, { ...context, aleServed: false }).level, 2, "kept without ale");
});

test("A9 (AL-6, decision AL11) the rule's settings: B (the rule, default) delays; require blocks; A requires ale from level 3 and speeds a served rise to 2; B delays an unserved rise by half", () => {
  const house: House = { buildingId: "h", level: 1, residents: 8, hasWater: true, breadStock: 9, lastServicedTick: 0, unmetRequirementTicks: 0, promotionTicks: 0 };
  const context = { tick: 100, hasGranaryNearby: true, hasMarketAccess: true, hasChurchAccess: true, palisadeProtection: "inside" as const };
  const balance = ALE_BALANCE as unknown as Record<string, unknown>;
  const saved = { ...balance };
  const rises = (ticks: number, served: boolean, level = 1) => updateHouse({ ...house, level, promotionTicks: ticks - 1 }, { ...context, aleServed: served }).level > level;
  try {
    Object.assign(balance, { rule: "require", unservedHoldPermille: 1_000 });
    assert.deepEqual([rises(2_400, true), rises(2_400, false), rises(99_999, false), rises(1_800, true)], [true, false, false, false], "require: the hold, and no rise unserved");
    Object.assign(balance, { requiredFromLevel: 3, servedBonusFromLevel: 2, servedHoldPermille: 750 });
    // (A as probed: require from level 3.)
    assert.deepEqual([rises(1_800, true), rises(1_800, false), rises(2_400, false)], [true, false, true], "A: served 75 %, unserved the plain hold");
    assert.deepEqual([rises(8_400, true, 2), rises(8_400, false, 2)], [true, false], "A: level 3 needs ale");
    Object.assign(balance, { ...saved, rule: "delay", unservedHoldPermille: 1_500 });
    assert.deepEqual([rises(2_400, true), rises(2_400, false), rises(3_600, false), rises(12_600, false, 2)], [true, false, true, true], "B: unserved 150 %");
  } finally {
    Object.assign(balance, saved);
  }
});

test("A7 (AL-8) the bot, once ale is required: a malt kiln within six road tiles of a barn the wheat can spare, then that barn turns to barley", () => {
  const base = town();
  const chapter2 = { ...base, politics: { ...base.politics!, chapter: { ...base.politics!.chapter, number: CHAPTER_TWO.chapter } } };
  // The build step as the bot's: the first legal tile the site test accepts.
  const build = (state: GameState, kind: string, accepts: (coordinate: { tx: number; ty: number }) => boolean = () => true) => {
    const tile = state.tiles.find(entry => canPlaceBuilding(state, kind as "malt_kiln", entry.tx, entry.ty).ok && accepts(entry));
    return tile === undefined ? { kind: "none" as const } : { kind: "place_building" as const, building: kind as "malt_kiln", tx: tile.tx, ty: tile.ty };
  };
  assert.deepEqual(aleChainAction({ ...base, tick: 60_000 }, build), { kind: "none" }, "not before ale is required");
  assert.equal(aleWantsBarley(chapter2), true, "the food step plants wider until a barn grows barley");
  const spare = barns(chapter2).filter(barn => !arableSupplyShort(setFarmsteadCrop(chapter2, barn.id, "barley")));
  const first = aleChainAction(chapter2, build);
  if (spare.length === 0) {
    assert.deepEqual(first, { kind: "none" }, "no barn to spare: no kiln yet");
  } else {
    assert.equal(first.kind === "place_building" && first.building, "malt_kiln", "the kiln first");
    const site = first as { tx: number; ty: number };
    assert.ok(spare.some(barn => Math.abs(barn.tx - site.tx) + Math.abs(barn.ty - site.ty) <= KILN_NEAR_BARN), "beside a barn to spare");
  }
  const kiln = withKiln(chapter2, 0);
  const action = aleChainAction(kiln, build);
  // A barn is switched only if the wheat outlook without it still meets the planner's margin.
  if (action.kind === "set_farmstead_crop") {
    assert.equal(arableSupplyShort(setFarmsteadCrop(kiln, action.buildingId, "barley")), false);
    assert.equal(aleWantsBarley(setFarmsteadCrop(kiln, action.buildingId, "barley")), false);
  } else {
    assert.deepEqual(action, { kind: "none" });
    assert.ok(barns(kiln).every(barn => arableSupplyShort(setFarmsteadCrop(kiln, barn.id, "barley"))), "no barn to spare");
  }
  // The kiln's carts carry as the mill's (decision AL12).
  assert.equal(BUILDING_CONFIG_BY_KIND.malt_kiln.carterCapacity, BUILDING_CONFIG_BY_KIND.mill.carterCapacity);
  // Barley waits in its barn: no cart takes it to a granary.
  assert.equal(deliverCandidate({ ...barns(kiln)[0]!, crop: "barley", inventory: { barley: 20 } }, "barley", kiln.buildings, { availableStock: () => 20, availableSpace: () => 800 } as never, { betweenBuildings: () => [{ tx: 0, ty: 0 }] } as never), null);
});

test("A8 (AL-9) the save round trip (v23) keeps the crop and the brewing slots; a v22 town opens growing wheat; the same batches twice", () => {
  let state = setFarmsteadCrop(withKiln(town(), 10), barns(town())[0]!.id, "barley");
  state = advanceAle(atBatch(state));
  const again = advanceAle(atBatch(setFarmsteadCrop(withKiln(town(), 10), barns(town())[0]!.id, "barley")));
  assert.deepEqual(again, state);
  assert.ok(SAVE_SCHEMA_VERSION >= 23); // PERSON-1a: v24
  const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-28T00:00:00.000Z", savedAt: "2026-09-28T00:00:00.000Z" }).bytes);
  assert.deepEqual(saved.envelope.state, state);
  const v22 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json")));
  assert.equal(v22.migratedFrom, 22);
  assert.ok((v22.envelope.state as GameState).buildings.every(building => building.crop === undefined));
});
