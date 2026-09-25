import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, mealBread } from "../src/content/houseFoodConfig";
import type { GameState } from "../src/engine/engine.types";
import { placeBuilding } from "../src/engine/gameActions";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { predictPlacementLedger } from "../src/engine/placementLedger";
import { advanceHistoricalEras, historicalEra } from "../src/engine/scenarioState";
import { advanceSeasons, firstWinterWarningActive, seasonStock, WINTER_NEED_TICKS } from "../src/engine/seasonPressure";
import { advanceTick } from "../src/engine/tick";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import { houseLotArea } from "../src/geometry/buildingFootprint";
import { constructionSiteId } from "../src/economy/constructionSites";
import { foodReserveTicks, seasonalFoodReserveTicks } from "../src/population/foodReserve";
import { stepHouseFood } from "../src/population/houseFood";
import { housePressureCause, housePressureCauseLabel, housePressureStatus } from "../src/population/housePressure";
import type { House } from "../src/population/population.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { canPlaceBuildingWithZones } from "../src/zones/zonePlacement";

// F0-A pressure scenarios (spec docs/design/flow-pressure.md FP-1…FP-6), work order P1–P8.

const SEASON = PRESSURE_BALANCE.seasonTicks;
const SPRING_1307 = 7 * 4000;

function town(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v12/population-176.save.json"))).envelope.state as GameState;
}

/** The ladder alone: `advanceSeasons` at every sample tick, the rest of the town standing still. */
function samples(state: GameState, from: number, to: number, edit: (state: GameState) => GameState = current => current): GameState {
  let current = { ...state, tick: from };
  for (let tick = from; tick <= to; tick += PRESSURE_BALANCE.sampleTicks) current = advanceSeasons(edit({ ...current, tick }));
  return current;
}

/** A town with a full granary (its stored food lasts years) and every larder stocked. */
function fedTown(): GameState {
  const state = town();
  const granary = state.buildings.find(building => building.kind === "granary")!;
  return {
    ...state,
    buildings: state.buildings.map(building => building === granary ? { ...building, inventory: { ...building.inventory, bread: 5_000 } } : building),
    houses: state.houses.map(house => ({ ...house, breadStock: 6 })),
  };
}

/** A town whose stored food is gone (buildings and carts hold no bread or wheat); larders stay as they are. */
function hungryTown(): GameState {
  const state = town();
  return {
    ...state,
    buildings: state.buildings.map(building => ({ ...building, inventory: { ...building.inventory, bread: 0, wheat: 0 } })),
    walkers: state.walkers.map(walker => walker.cargo !== null && (walker.cargo.resource === "bread" || walker.cargo.resource === "wheat") ? { ...walker, cargo: null } : walker),
  };
}

const emptyLarder = (id: string) => (state: GameState): GameState => ({
  ...state, houses: state.houses.map(house => house.buildingId === id ? { ...house, breadStock: 0 } : house),
});
const houseOf = (state: GameState, id: string): House => state.houses.find(house => house.buildingId === id)!;

test("P1 a season's end closes one SeasonLedger whose income and expense are the ledger's cash entries of that season", () => {
  let state: GameState = DEFAULT_GAME_STATE;
  let atStart: GameState | null = null;
  while (state.tick < 3 * SEASON) {
    state = advanceTick(state);
    if (state.tick === 2 * SEASON) atStart = state;
    if (state.tick === 3 * SEASON - 1) assert.equal(state.seasons?.history.length, 2, "one ledger per closed season");
  }
  const history = state.seasons!.history;
  assert.equal(history.length, 3);
  const autumn = history.at(-1)!;
  assert.deepEqual([autumn.year, autumn.season, autumn.startTick, autumn.endTick], [1300, 2, 2 * SEASON, 3 * SEASON]);
  const entries = state.ledger!.entries.filter(entry => entry.account === "cash" && entry.category !== "opening_balance"
    && entry.tick > 2 * SEASON && entry.tick <= 3 * SEASON);
  assert.ok(entries.some(entry => entry.tick === LEDGER_PERIOD_TICKS), "the season holds the period close at 2,400");
  assert.equal(autumn.income, entries.filter(entry => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0));
  assert.equal(autumn.expense, -entries.filter(entry => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
  assert.ok(autumn.income > 0);
  const start = seasonStock(atStart!);
  const end = seasonStock(state);
  assert.deepEqual(autumn.stockDelta, { bread: end.bread - start.bread, wheat: end.wheat - start.wheat, timber: end.timber - start.timber, stone: end.stone - start.stone });
  assert.equal(autumn.popDelta, state.population - atStart!.population);
});

test("P1 the history keeps the newest eight seasons", () => {
  const state = samples(fedTown(), SPRING_1307, SPRING_1307 + 10 * SEASON);
  assert.equal(state.seasons!.history.length, PRESSURE_BALANCE.seasonLedgerHistory);
  assert.equal(state.seasons!.history.at(-1)!.endTick, SPRING_1307 + 10 * SEASON);
});

test("P2 a hut's predicted rent, upkeep and labour match what the ledger charges in its first period after it fills", () => {
  const base = DEFAULT_GAME_STATE;
  const well = base.buildings.find(building => building.kind === "well")!;
  const candidates = base.tiles.filter(tile => Math.abs(tile.tx - well.tx) + Math.abs(tile.ty - well.ty) <= 6)
    .filter(tile => canPlaceBuildingWithZones(base, "house", tile.tx, tile.ty).ok)
    .map(tile => ({ tile, prediction: predictPlacementLedger(base, "house", tile) }))
    .filter(entry => entry.prediction.rentPerPeriod > 0);
  assert.ok(candidates.length > 0, "a hut site beside the opening well");
  const { tile, prediction } = candidates[0]!;
  assert.deepEqual(prediction.serviceCoverage.services.includes("water"), true);
  assert.equal(prediction.upkeepPerPeriod, 0);
  assert.equal(prediction.labourDemand, 0);
  const id = constructionSiteId(base.nextConstructionOrdinal);
  let state = placeBuilding(base, "house", tile);
  assert.notEqual(state, base);
  let completed: number | null = null;
  let charged: { tick: number; rent: number; level: number } | null = null;
  for (let step = 0; step < 20_000 && charged === null; step += 1) {
    state = advanceTick(state);
    const house = state.houses.find(entry => entry.buildingId === id);
    if (completed === null && house !== undefined) completed = state.tick;
    if (completed === null || house === undefined || state.tick % LEDGER_PERIOD_TICKS !== 0 || state.tick < completed + 600 || house.residents <= 0) continue;
    const rent = state.ledger!.entries.filter(entry => entry.tick === state.tick && entry.category === "rent" && entry.sourceRefs[0].id === id)
      .reduce((sum, entry) => sum + entry.amount, 0);
    charged = { tick: state.tick, rent, level: house.level };
  }
  assert.ok(charged !== null, "the hut filled and paid rent");
  assert.equal(charged.level, 1);
  assert.equal(charged.rent, prediction.rentPerPeriod);
  assert.equal(state.ledger!.entries.some(entry => entry.category === "upkeep" && entry.sourceRefs[0].id === id), false, "a hut owes no upkeep");
});

test("P2 a well's predicted upkeep and staffing are what the period close charges and the building asks", () => {
  const base = DEFAULT_GAME_STATE;
  const prediction = predictPlacementLedger(base, "well", { tx: 20, ty: 20 });
  assert.equal(prediction.upkeepPerPeriod, 1);
  assert.equal(prediction.labourDemand, 0);
  const withWell: GameState = { ...base, tick: LEDGER_PERIOD_TICKS, buildings: [...base.buildings, { id: "well-test", kind: "well", tx: 20, ty: 20,
    workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }], treasuryCoin: 500 };
  const settled = settleMoneyPeriod(withWell);
  assert.equal(settled.ledger!.entries.filter(entry => entry.category === "upkeep" && entry.sourceRefs[0].id === "well-test")
    .reduce((sum, entry) => sum - entry.amount, 0), prediction.upkeepPerPeriod);
});

test("P3 a household with an empty larder for a season is preparing to leave, for want of food", () => {
  const state = fedTown();
  const id = state.houses.find(house => house.residents > 0)!.buildingId;
  const before = samples(state, SPRING_1307, SPRING_1307 + SEASON - PRESSURE_BALANCE.sampleTicks, emptyLarder(id));
  assert.equal(housePressureStatus(houseOf(before, id)), "settled", "not before a full season");
  assert.equal(houseOf(before, id).foodShortSinceTick, SPRING_1307);
  const after = samples(before, SPRING_1307 + SEASON, SPRING_1307 + SEASON, emptyLarder(id));
  const house = houseOf(after, id);
  assert.equal(housePressureStatus(house), "leaving");
  assert.equal(house.leavingSinceTick, SPRING_1307 + SEASON);
  assert.equal(housePressureCause(house), "food_shortage");
  assert.equal(housePressureCauseLabel(house), "식량 부족으로 떠날 준비");
  assert.equal(after.houses.filter(entry => housePressureStatus(entry) !== "settled").length, 1, "the fed households stay");
  assert.deepEqual(after.seasons!.current.leaving, 1);
});

test("P3 the town's stored food lasting less than a season puts every household on the ladder", () => {
  const state = hungryTown();
  const reserve = foodReserveTicks(state);
  assert.ok(reserve !== null && reserve < SEASON, `the town's stored food lasts ${reserve} ticks`);
  assert.ok(state.houses.some(house => house.residents > 0 && house.breadStock > 0), "larders still hold bread");
  const after = samples(state, SPRING_1307, SPRING_1307 + SEASON);
  assert.equal(after.houses.filter(house => house.residents > 0).every(house => housePressureStatus(house) === "leaving"), true);
});

test("P4 a season more in stage 1 and the household leaves: the house stands abandoned, pays no rent, the population drops", () => {
  const state = fedTown();
  const id = state.houses.find(house => house.residents > 0)!.buildingId;
  const residents = houseOf(state, id).residents;
  const after = samples(state, SPRING_1307, SPRING_1307 + 2 * SEASON, emptyLarder(id));
  const house = houseOf(after, id);
  assert.equal(housePressureStatus(house), "abandoned");
  assert.equal(house.abandonedTick, SPRING_1307 + 2 * SEASON);
  assert.equal(house.residents, 0);
  assert.ok(after.buildings.some(building => building.id === id), "the house stands (not demolished)");
  assert.equal(after.population, state.population - residents);
  const closed = settleMoneyPeriod({ ...after, tick: 30 * LEDGER_PERIOD_TICKS });
  assert.equal(closed.ledger!.entries.some(entry => entry.category === "rent" && entry.sourceRefs[0].id === id), false, "no rent from the abandoned plot");
  assert.equal(after.seasons!.history.at(-1)!.notableEvents.some(event => event.kind === "households_leaving"), true);
  assert.equal(after.seasons!.current.abandoned, 1);
});

test("P4 at most two households leave a season, and never below the opening village's four homes", () => {
  // The town's stored food is gone, so every household is on the ladder and no abandoned house takes a new one.
  const state = hungryTown();
  const occupied = state.houses.filter(house => house.residents > 0).map(house => house.buildingId);
  const second = samples(state, SPRING_1307, SPRING_1307 + 2 * SEASON);
  assert.equal(second.houses.filter(house => house.abandonedTick !== undefined).length, PRESSURE_BALANCE.maxDeparturesPerSeason);
  const third = samples(second, SPRING_1307 + 2 * SEASON + PRESSURE_BALANCE.sampleTicks, SPRING_1307 + 3 * SEASON);
  assert.equal(third.houses.filter(house => house.abandonedTick !== undefined).length, 2 * PRESSURE_BALANCE.maxDeparturesPerSeason);
  const later = samples(third, SPRING_1307 + 3 * SEASON + PRESSURE_BALANCE.sampleTicks, SPRING_1307 + 12 * SEASON);
  assert.equal(later.houses.filter(house => house.residents > 0).length, PRESSURE_BALANCE.minOccupiedHouses);
  assert.equal(later.houses.filter(house => house.abandonedTick !== undefined).length, occupied.length - PRESSURE_BALANCE.minOccupiedHouses);
});

test("P5 bread back during stage 1 lifts it", () => {
  const state = fedTown();
  const id = state.houses.find(house => house.residents > 0)!.buildingId;
  const leaving = samples(state, SPRING_1307, SPRING_1307 + SEASON, emptyLarder(id));
  assert.equal(housePressureStatus(houseOf(leaving, id)), "leaving");
  const refill = (current: GameState): GameState => ({ ...current, houses: current.houses.map(house => house.buildingId === id ? { ...house, breadStock: 3 } : house) });
  const fed = samples(leaving, SPRING_1307 + SEASON + PRESSURE_BALANCE.sampleTicks, SPRING_1307 + SEASON + PRESSURE_BALANCE.sampleTicks, refill);
  const house = houseOf(fed, id);
  assert.equal(housePressureStatus(house), "settled");
  assert.equal(house.foodShortSinceTick, undefined);
  assert.equal(house.leavingSinceTick, undefined);
});

test("P6 an abandoned house with water and a season of stored food takes a new household and recovers", () => {
  const state = fedTown();
  const id = state.houses.find(house => house.residents > 0 && house.hasWater)!.buildingId;
  const abandoned = samples(state, SPRING_1307, SPRING_1307 + 2 * SEASON, emptyLarder(id));
  assert.equal(housePressureStatus(houseOf(abandoned, id)), "abandoned");
  const waiting = samples(abandoned, SPRING_1307 + 2 * SEASON + PRESSURE_BALANCE.sampleTicks, SPRING_1307 + 3 * SEASON - PRESSURE_BALANCE.sampleTicks);
  assert.equal(housePressureStatus(houseOf(waiting, id)), "abandoned", "it stands empty a season first");
  const back = samples(waiting, SPRING_1307 + 3 * SEASON, SPRING_1307 + 3 * SEASON);
  const house = houseOf(back, id);
  assert.equal(housePressureStatus(house), "settled");
  assert.equal(house.residents, houseLotArea(back.buildings.find(building => building.id === id)));
  assert.equal(back.seasons!.current.resettled, 1);
});

test("P6 no new household while the town's stored food will not last a season", () => {
  const state = fedTown();
  const id = state.houses.find(house => house.residents > 0 && house.hasWater)!.buildingId;
  const abandoned = samples(state, SPRING_1307, SPRING_1307 + 2 * SEASON, emptyLarder(id));
  const hungry: GameState = { ...abandoned, buildings: abandoned.buildings.map(building => ({ ...building, inventory: { ...building.inventory, bread: 0, wheat: 0 } })) };
  const later = samples(hungry, SPRING_1307 + 2 * SEASON + PRESSURE_BALANCE.sampleTicks, SPRING_1307 + 4 * SEASON);
  assert.equal(housePressureStatus(houseOf(later, id)), "abandoned");
});

test("P7 1315 without a granary, 12 lots and a market: no famine; it comes forced in 1320; a ready town enters in 1315", () => {
  const state = town();
  const unready: GameState = { ...state, buildings: state.buildings.filter(building => building.kind !== "market"), historicalEras: [{ id: "saturation", enteredTick: 0, forced: false }] };
  const at = (current: GameState, year: number) => advanceHistoricalEras({ ...current, tick: (year - 1300) * 4000 });
  assert.equal(historicalEra(at(unready, 1315)).id, "saturation");
  assert.equal(historicalEra(at(unready, 1319)).id, "saturation");
  const forced = at(unready, 1320);
  assert.equal(historicalEra(forced).id, "famine");
  assert.deepEqual(forced.historicalEras!.at(-1), { id: "famine", enteredTick: 20 * 4000, forced: true });
  const market = { id: "market-test", kind: "market" as const, tx: 1, ty: 1, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const ready: GameState = { ...unready, buildings: [...state.buildings, market] };
  assert.ok(ready.buildings.some(building => building.kind === "market") && ready.buildings.some(building => building.kind === "granary"));
  const entered = at(ready, 1315);
  assert.deepEqual(entered.historicalEras!.at(-1), { id: "famine", enteredTick: 15 * 4000, forced: false });
  assert.equal(historicalEra(at(entered, 1336)).id, "famine", "the next era waits for its own year");
  assert.equal(historicalEra(at(entered, 1337)).id, "war");
});

test("P8 winter meals eat the ration × 1.2; the other seasons the ration", () => {
  const winterMeal = 3 * SEASON + HOUSE_FOOD_INTERVAL / 2;
  assert.equal(winterMeal % HOUSE_FOOD_INTERVAL, 0);
  assert.deepEqual(mealBread(5, winterMeal, 0), { bread: 6, carry: 0 });
  assert.deepEqual(mealBread(5, SEASON + HOUSE_FOOD_INTERVAL, 0), { bread: 5, carry: 0 });
  let carry = 0;
  let eaten = 0;
  for (let meal = 0; meal < 5; meal += 1) {
    const result = mealBread(1, winterMeal, carry);
    eaten += result.bread;
    carry = result.carry;
  }
  assert.equal(eaten, 6, "five winter meals of a one-bread ration eat six");
  const house: House = { buildingId: "h", level: 2, residents: 40, hasWater: true, breadStock: 20, lastServicedTick: 0, unmetRequirementTicks: 0 };
  assert.equal(stepHouseFood(house, winterMeal).breadStock, 14);
  assert.equal(stepHouseFood(house, 2_400).breadStock, 15, "an autumn meal");
  const stocked = fedTown();
  assert.equal(seasonalFoodReserveTicks(stocked, winterMeal), Math.floor(foodReserveTicks(stocked)! * 1000 / 1200));
  assert.equal(WINTER_NEED_TICKS, 1_200);
});

test("P8 the first-winter warning: autumn opens with less stored food than a winter needs", () => {
  const state = hungryTown();
  const autumn = 7 * 4000 + 2 * SEASON;
  const reserve = foodReserveTicks(state)!;
  assert.ok(reserve < WINTER_NEED_TICKS);
  const warned = advanceSeasons({ ...state, tick: autumn });
  assert.deepEqual(warned.seasons!.firstWinterWarning, { tick: autumn, reserveTicks: reserve, winterNeedTicks: WINTER_NEED_TICKS });
  assert.equal(firstWinterWarningActive(warned), true);
  assert.equal(firstWinterWarningActive({ ...warned, tick: autumn + 2 * SEASON }), false, "over when the winter ends");
  const again = advanceSeasons({ ...warned, tick: autumn + 4000 });
  assert.equal(again.seasons!.firstWinterWarning!.tick, autumn, "raised once");
});

test("④ a town on the ladder round-trips through save v12 and runs on identically; two runs agree", () => {
  const state = hungryTown();
  const id = state.houses.find(house => house.residents > 0)!.buildingId;
  const pressured = samples(state, SPRING_1307, SPRING_1307 + 2 * SEASON + 3 * HOUSE_FOOD_INTERVAL, emptyLarder(id));
  assert.ok(pressured.houses.some(house => house.abandonedTick !== undefined) && pressured.houses.some(house => house.leavingSinceTick !== undefined));
  assert.ok(pressured.seasons!.history.length >= 2);
  const loaded = decodeSave(encodeSave({ state: pressured, createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, 12);
  assert.deepEqual(loaded.envelope.state, pressured);
  let a: GameState = pressured;
  let b: GameState = loaded.envelope.state as GameState;
  let c: GameState = structuredClone(pressured);
  for (let step = 0; step < 1_200; step += 1) { a = advanceTick(a); b = advanceTick(b); c = advanceTick(c); }
  const { pathCache: _a, ...restA } = a;
  const { pathCache: _b, ...restB } = b;
  const { pathCache: _c, ...restC } = c;
  assert.deepEqual(restB, restA);
  assert.deepEqual(restC, restA);
});

test("④ a v11 save becomes v12: the season opens at its start, the eras due enter, every household is settled", () => {
  const raw = JSON.parse(readFileSync("fixtures/saves/v11/population-176.save.json", "utf8")) as { state: GameState };
  const decoded = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v11/population-176.save.json")));
  assert.equal(decoded.migratedFrom, 11);
  const state = decoded.envelope.state as GameState;
  const start = Math.floor(raw.state.tick / SEASON) * SEASON;
  assert.equal(state.seasons!.current.startTick, start);
  assert.deepEqual(state.seasons!.history, []);
  assert.deepEqual(state.historicalEras, [{ id: "saturation", enteredTick: raw.state.tick, forced: false }]);
  assert.ok(state.houses.every(house => housePressureStatus(house) === "settled" && house.winterRationCarry === undefined));
  assert.equal(state.population, raw.state.population);
  const later = advanceTick(state);
  assert.equal(later.tick, state.tick + 1);
});
