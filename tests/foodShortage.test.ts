/**
 * FIX-16 (①②): the Great Famine's dear bread kills mostly in the households short of food — starving, or the poor
 * the prices shut out when the lord gives no relief — and a fed house's few dead died "of the famine year's
 * sickness", not of hunger, so relief saves lives. Wheat a barn cannot hand on is no food: the reserve leaves it out
 * and reports it apart with the days it would add. The engine counts the households going hungry (render LM-R1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import { famineShortHouses, foodPricePermille } from "../src/engine/eventSchedule";
import { advanceEvents } from "../src/engine/events";
import { boundWheat, boundWheatReleaseDays, foodShortage, foodShortHouseIds, starvingHouseholds } from "../src/engine/foodShortage";
import { advancePersons, FED_HOUSE_DEARTH_SHARE_PERMILLE, householdMortalityWeight, MORTALITY_WEIGHTS } from "../src/engine/persons";
import { famineResponse } from "../src/engine/politics";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { postLedgerEntries } from "../src/ledger/ledger";
import { foodReserveTicks } from "../src/population/foodReserve";
import { BALANCE } from "../src/content/balanceConfig";
import { decodeSave } from "../src/save/saveCodec";

const SPRING_1315 = 15 * 4000;

/** The chapter tests' town ready for the famine (tests/flowChapterOne.test.ts readyTown). */
function readyTown(): GameState {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v13/population-176.save.json"))).envelope.state as GameState;
  const { seasons: _seasons, events: _events, politics: _politics, historicalEras: _eras, ...state } = saved;
  const market = { id: "market-test", kind: "market" as const, tx: 2, ty: 2, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: 5_000, sourceRefs: [{ type: "building", id: state.houses[0]!.buildingId }] }]);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: [...state.buildings, market] };
}

const arrived = advanceEvents(advanceSeasons({ ...readyTown(), tick: SPRING_1315 }));
/** Every house holds bread: no one starves; only the famine's prices can shut the poor out. */
const fed = (state: GameState): GameState => ({ ...state, houses: state.houses.map(house => ({ ...house, breadStock: 10, emptyFoodTicks: 0 })) });
/** The death day of the famine's first season, on another seed's dice. */
const deathDay = (state: GameState, seed: number): GameState => ({ ...state, seed, tick: SPRING_1315 + 1 });

function deaths(before: GameState, after: GameState): { id: string; householdId: string; cause: string }[] {
  const known = new Set((before.persons?.past ?? []).map(person => person.id));
  return (after.persons?.past ?? []).filter(person => !person.alive && !known.has(person.id))
    .map(person => ({ id: person.id, householdId: person.householdId, cause: person.deathCause ?? "" }));
}

test("FIX-16 a household's weight: the whole of dear bread's extra when short of food, a fifth of it when fed", () => {
  assert.equal(FED_HOUSE_DEARTH_SHARE_PERMILLE, 200);
  assert.equal(householdMortalityWeight(MORTALITY_WEIGHTS.famine, false), 3_000);
  assert.equal(householdMortalityWeight(MORTALITY_WEIGHTS.famine, true), 1_400);
  assert.equal(householdMortalityWeight(MORTALITY_WEIGHTS.dearth, true), 1_100);
  assert.equal(householdMortalityWeight(1_000, false), 1_000);
});

test("FIX-16 the famine's dead: hunger only in the houses short of food, the famine year's sickness in fed houses; relief saves lives", () => {
  assert.ok(foodPricePermille(arrived, SPRING_1315 + 1) >= 2_000, "the famine's prices");
  const totals: Record<string, Record<string, number>> = {};
  for (const choice of ["relief", "laissez_faire"] as const) {
    const answered = fed(famineResponse(arrived, choice));
    const tally: Record<string, number> = {};
    for (let seed = 1; seed <= 24; seed += 1) {
      // Each seed draws its own people (and dice) for the same town.
      const { persons: _persons, ...unpeopled } = deathDay(answered, seed);
      const start = advancePersons({ ...unpeopled, tick: SPRING_1315 });
      const day = deathDay(start, seed);
      const short = foodShortHouseIds(day);
      if (choice === "relief") assert.equal(short.size, 0, "relief feeds the poor");
      else assert.deepEqual([...short].sort(), [...famineShortHouses(day)].sort(), "the famine's poor are short of food");
      for (const death of deaths(day, advancePersons(day))) {
        if (death.cause === "famine") assert.ok(short.has(death.householdId), `hunger in a house short of food (${death.id})`);
        if (death.cause === "famine_year") assert.ok(!short.has(death.householdId), `the year's sickness in a fed house (${death.id})`);
        tally[death.cause] = (tally[death.cause] ?? 0) + 1;
      }
    }
    totals[choice] = tally;
  }
  assert.equal(totals.relief!.famine ?? 0, 0, "no one starves when the lord gives relief and the houses hold bread");
  assert.ok((totals.laissez_faire!.famine ?? 0) > 0, "the poor shut out of the market die of hunger");
  const famineDead = (tally: Record<string, number>) => (tally.famine ?? 0) + (tally.famine_year ?? 0);
  assert.ok(famineDead(totals.relief!) < famineDead(totals.laissez_faire!), JSON.stringify(totals));
});

test("FIX-16 the chronicle names the famine year's death apart from hunger", () => {
  const line = (cause: string) => HISTORY_TEMPLATES["person.died"]!({ age: 61, cause });
  assert.equal(line("famine_year"), "61살에 기근 해에 병들어 죽었다");
  assert.equal(line("famine"), "61살에 굶주림 끝에 죽었다");
});

test("FIX-16 the households going hungry: starving past the grace window, or the famine's poor without relief", () => {
  const laissez = { ...fed(famineResponse(arrived, "laissez_faire")), tick: SPRING_1315 + 50 };
  assert.equal(starvingHouseholds(laissez), famineShortHouses(laissez).length);
  assert.ok(starvingHouseholds(laissez) > 0);
  const relief = { ...fed(famineResponse(arrived, "relief")), tick: SPRING_1315 + 50 };
  assert.equal(starvingHouseholds(relief), 0);
  // One house out of bread past the starvation window starves, relief or not.
  const empty = { ...relief, houses: relief.houses.map((house, index) => index === 0 ? { ...house, breadStock: 0, emptyFoodTicks: BALANCE.STARVATION_WINDOW + 1 } : house) };
  assert.equal(starvingHouseholds(empty), 1);
});

test("FIX-16 bound wheat is no food: the reserve leaves it out and reports it apart, with the days it would add", () => {
  const town = fed(readyTown());
  const barn = town.buildings.find(building => building.kind === "farmstead") ?? town.buildings.find(building => building.kind === "granary")!;
  const withWheat = (stuck: boolean): GameState => ({ ...town, buildings: town.buildings.map(building => building.id !== barn.id ? building
    : { ...building, inventory: { ...building.inventory, wheat: 782 }, ...(stuck ? { stuckSinceTick: { wheat: 0 } } : {}) }) });
  const free = withWheat(false);
  const bound = withWheat(true);
  assert.equal(boundWheat(free), 0);
  assert.equal(boundWheat(bound), 782);
  assert.ok((foodReserveTicks(bound) ?? 0) < (foodReserveTicks(free) ?? 0), "the reserve leaves bound wheat out");
  // 782 wheat is 391 bread; the days it would add at the town's ration.
  const days = boundWheatReleaseDays(bound);
  assert.ok(days > 0);
  assert.deepEqual(foodShortage(bound), { starvingHouseholds: 0, boundWheat: 782, releaseDays: days });
  // With no mill to grind it, released wheat adds no days.
  const noMill = { ...bound, buildings: bound.buildings.filter(building => building.kind !== "mill") };
  assert.equal(boundWheatReleaseDays(noMill), 0);
});
