/**
 * FIX-4 human-play rules (spec docs/design/human-play-rules.md HR-1…HR-12): scenarios for gates ③ (E2·E3·E4·E5·E8·E10·E11,
 * with E1·E6·E7·E9) and ④ (portraits). Gate ① is tests/tutorialPaceSurvival.test.ts, gate ② tests/humanPlotSettlement.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { BALANCE, MONEY_BALANCE, PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { moneyOf, rentRelief, settleMoneyPeriod, upkeepCharges } from "../src/engine/moneyRules";
import { advancePersons, personPortrait } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { choosePortraitIdentity, INFANT_AGE, PORTRAIT_BAND, PORTRAIT_MIN_AGE, portraitFor } from "../src/engine/portraits";
import { PORTRAIT_POOL } from "../src/content/portraitPool";
import { advanceSeasons, firstWinterWarningActive, foodNeeds, recordStarvation } from "../src/engine/seasonPressure";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import { foodReserveTicks, millGrindRate } from "../src/population/foodReserve";
import { houseIsStarving } from "../src/population/houseFood";
import type { House } from "../src/population/population.types";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { inFieldWorkWindow } from "../src/zones/arableFields";
import { ZONE_SETTLEMENT } from "../src/content/zoneConfig";
import { advanceZoneSettlement, homesAwaitingHouseholds, townHungry, zoneSettlementStatus } from "../src/zones/zoneSettlement";

const PERIOD = LEDGER_PERIOD_TICKS;
const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;

function building(id: string, kind: Building["kind"], patch: Partial<Building> = {}): Building {
  return { id, kind, tx: 0, ty: 0, workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...patch };
}
function home(id: string, patch: Partial<House> = {}): House {
  return { buildingId: id, level: 1, residents: 4, hasWater: true, breadStock: 8, lastServicedTick: 0, unmetRequirementTicks: 0, ...patch };
}
/** A starving household (larder empty past the starvation window). */
const starving = (id: string): House => home(id, { breadStock: 0, emptyFoodTicks: BALANCE.STARVATION_WINDOW + 1 });
function money(patch: Partial<GameState> = {}): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), buildings: [], houses: [], tick: PERIOD, treasuryCoin: 0, ...patch };
}
function town176(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v12/population-176.save.json"))).envelope.state as GameState;
}

test("HR-1 (E1) a new game opens with 60d, three periods of a tutorial town's upkeep, and its granary's bread lasts a season", () => {
  assert.equal(DEFAULT_GAME_STATE.treasuryCoin, BALANCE.STARTING_COIN);
  const { mill, well, storehouse } = MONEY_BALANCE.upkeep;
  assert.ok(BALANCE.STARTING_COIN >= 3 * (mill + 2 * well + storehouse), `${BALANCE.STARTING_COIN}d`);
  assert.ok((foodReserveTicks(DEFAULT_GAME_STATE) ?? 0) >= SEASON, "the opening granary's bread lasts at least a season");
});

test("HR-2 (E2) upkeep is charged food chain first, then services, then the rest; oldest first within a rank", () => {
  const state = money({ buildings: [
    building("construction-site-000009", "well"), building("construction-site-000003", "storehouse"),
    building("construction-site-000012", "mill"), building("well-opening", "well"), building("construction-site-000004", "church"),
  ] });
  assert.deepEqual(upkeepCharges(state).map(charge => charge.facility.id),
    ["construction-site-000012", "well-opening", "construction-site-000004", "construction-site-000009", "construction-site-000003"]);
  // The UX-0b audit town: a new well (1d) and the mill (8d) on 8d — the mill is paid, the well waits.
  const audit = settleMoneyPeriod(money({ treasuryCoin: MONEY_BALANCE.upkeep.mill,
    buildings: [building("construction-site-000002", "mill"), building("construction-site-000005", "well")] }));
  assert.deepEqual(audit.buildings.filter(candidate => candidate.upkeepUnpaid === true).map(candidate => candidate.kind), ["well"]);
});

test("HR-3 (E3) a facility that pays this period runs while its old debt waits on the arrears account", () => {
  const mill = building("construction-site-000002", "mill");
  const owing = settleMoneyPeriod(money({ buildings: [mill], treasuryCoin: 0 }));
  assert.equal(owing.buildings[0]!.upkeepUnpaid, true, "unpaid this period: idle");
  // Rent covers this period's mill upkeep but not the old charge as well.
  const homes = Array.from({ length: Math.ceil(MONEY_BALANCE.upkeep.mill / MONEY_BALANCE.rentByLevel[1]) }, (_, index) => home(`h-${index}`));
  assert.ok(homes.length * MONEY_BALANCE.rentByLevel[1] < 2 * MONEY_BALANCE.upkeep.mill);
  const funded = settleMoneyPeriod({ ...owing, tick: 2 * PERIOD, houses: homes });
  assert.equal(funded.buildings[0]!.upkeepUnpaid, undefined, "paid this period: running");
  assert.deepEqual(moneyOf(funded).arrears.map(arrear => [arrear.facility.id, arrear.tick]), [["construction-site-000002", PERIOD]], "the old charge waits");
});

test("HR-4 (E4) in the first year ploughing and sowing run to late spring's end; from the second year the old window", () => {
  assert.equal(ARABLE_CONFIG.firstYearFieldWorkUntil, 2_000);
  assert.equal(inFieldWorkWindow(1_700), true, "1300, in-year 1,700 (the audit town's barn)");
  assert.equal(inFieldWorkWindow(1_999), true);
  assert.equal(inFieldWorkWindow(2_000), false);
  assert.equal(inFieldWorkWindow(YEAR + 1_700), false, "1301: the window closes at 1,500 again");
  assert.equal(inFieldWorkWindow(YEAR + 1_499), true);
});

test("HR-5 (E5) stored wheat is food only as fast as the running mills grind it", () => {
  const houses = [home("h-1", { residents: 8 }), home("h-2", { residents: 8 })];
  const store = building("granary-1", "granary", { inventory: { bread: 10, wheat: 400 } });
  const noMill = { houses, buildings: [store], walkers: [] };
  const breadOnly = foodReserveTicks({ houses, buildings: [{ ...store, inventory: { bread: 10 } }], walkers: [] });
  assert.equal(foodReserveTicks(noMill), breadOnly, "no mill: the wheat adds nothing");
  const mill = building("mill-1", "mill");
  const grinding = foodReserveTicks({ houses, buildings: [store, mill], walkers: [] })!;
  assert.ok(grinding > breadOnly!, "a staffed mill turns the wheat into days");
  assert.ok(millGrindRate({ buildings: [mill] }) > 0);
  for (const stopped of [{ upkeepUnpaid: true }, { operationPaused: true }, { workers: 0 }]) {
    const idle = { ...mill, ...stopped };
    assert.equal(millGrindRate({ buildings: [idle] }), 0);
    assert.equal(foodReserveTicks({ houses, buildings: [store, idle], walkers: [] }), breadOnly, JSON.stringify(stopped));
  }
});

test("HR-6 (E6) plot settlement: a house on the first empty plot each cadence tick, not while hungry or with two homes waiting", () => {
  assert.equal(ZONE_SETTLEMENT.cadenceTicks, 120);
  // The zoned opening (plots painted beside the village road), before its first plot house is placed (as in Z-15).
  const opening = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v6/zoned-opening.save.json"))).envelope.state as GameState;
  const plots: GameState = { ...opening, constructionSites: [],
    tiles: opening.tiles.map(tile => (tile.buildingId?.startsWith("construction-site") ? { ...tile, buildingId: null } : tile)) };
  const status = zoneSettlementStatus(plots);
  if (status.kind === "settling") {
    const onCadence = advanceZoneSettlement({ ...plots, tick: ZONE_SETTLEMENT.cadenceTicks });
    assert.equal(homesAwaitingHouseholds(onCadence), homesAwaitingHouseholds(plots) + 1, "one house site on the plot");
    const off = { ...plots, tick: ZONE_SETTLEMENT.cadenceTicks + 1 };
    assert.equal(advanceZoneSettlement(off), off, "off cadence: nothing");
  } else {
    assert.fail(`the zoned opening's plots should settle, got ${JSON.stringify(status)}`);
  }
  const hungry = { ...plots, tick: Math.max(plots.tick, 1), houses: plots.houses.map((house, index) => index === 0 ? starving(house.buildingId) : house) };
  assert.equal(townHungry(hungry), true);
  assert.deepEqual(zoneSettlementStatus(hungry), { kind: "hungry" });
  const waiting = { ...plots, houses: [...plots.houses, home("empty-1", { residents: 0 }), home("empty-2", { residents: 0 })] };
  assert.deepEqual(zoneSettlementStatus(waiting), { kind: "homes_waiting", homes: 2 });
  assert.deepEqual(zoneSettlementStatus(DEFAULT_GAME_STATE), { kind: "no_zone" });
});

test("HR-7 (E7) residents lost to hunger are counted into the season and named at its close", () => {
  const before = town176();
  const victim = before.houses.find(house => house.residents > 4)!;
  const after = { ...before, houses: before.houses.map(house => house === victim ? { ...house, residents: house.residents - 3 } : house) };
  const counted = recordStarvation(before, after);
  assert.equal(counted.seasons!.current.starved, (before.seasons!.current.starved ?? 0) + 3);
  assert.equal(recordStarvation(before, before), before, "no loss: the state is unchanged");
  const seasonStart = Math.ceil((counted.tick + 1) / SEASON) * SEASON;
  const closed = advanceSeasons({ ...counted, tick: seasonStart });
  assert.deepEqual(closed.seasons!.history.at(-1)!.notableEvents.find(event => event.kind === "residents_starved"), { kind: "residents_starved", count: 3 + (before.seasons!.current.starved ?? 0) });
});

test("HR-8 (E8) the first-winter warning is raised each autumn that opens short, not once a game", () => {
  const hungry = { ...town176(), buildings: town176().buildings.map(entry => ({ ...entry, inventory: { ...entry.inventory, bread: 0, wheat: 0 } })) };
  const autumn = 7 * YEAR + 2 * SEASON;
  const first = advanceSeasons({ ...hungry, tick: autumn });
  assert.equal(first.seasons!.firstWinterWarning!.tick, autumn);
  const next = advanceSeasons({ ...first, tick: autumn + YEAR });
  assert.equal(next.seasons!.firstWinterWarning!.tick, autumn + YEAR);
  assert.equal(firstWinterWarningActive(next), true);
});

test("HR-10 (E10) a starving household pays no rent and one getting ready to leave pays half", () => {
  assert.equal(rentRelief(home("fed"), 5_000, 6), 6);
  assert.equal(rentRelief(starving("hungry"), 5_000, 6), 0);
  assert.equal(rentRelief(home("leaving", { leavingSinceTick: 4_000 }), 5_000, 6), 3);
  assert.equal(rentRelief(home("leaving", { leavingSinceTick: 4_000 }), 5_000, 5), 2, "half rounds down");
  const settled = settleMoneyPeriod(money({ tick: PERIOD * 50, houses: [home("fed"), starving("hungry"), home("leaving", { leavingSinceTick: PERIOD * 49 })] }));
  const rent = (id: string) => settled.ledger!.entries.filter(entry => entry.category === "rent" && entry.sourceRefs[0].id === id).reduce((sum, entry) => sum + entry.amount, 0);
  const full = MONEY_BALANCE.rentByLevel[1];
  assert.deepEqual([rent("fed"), rent("hungry"), rent("leaving")], [full, 0, Math.floor(full / 2)]);
});

test("HR-11 (E11) a hungry town's season hint is about food, and it names what the food chain lacks", () => {
  const base = town176();
  const noBread = { ...base, houses: base.houses.map((house, index) => index < 3 ? starving(house.buildingId) : house),
    buildings: base.buildings.filter(entry => entry.kind !== "mill" && entry.kind !== "farmstead") };
  assert.ok(noBread.houses.some(house => houseIsStarving(house, noBread.tick)));
  const needs = foodNeeds(noBread);
  assert.equal(needs.mill, true, "no mill");
  assert.equal(needs.farmstead, true, "no barn");
  assert.ok(needs.arableCells >= 0);
  const seasonStart = Math.ceil((noBread.tick + 1) / SEASON) * SEASON;
  const closed = advanceSeasons({ ...noBread, tick: seasonStart }).seasons!.history.at(-1)!;
  assert.equal(closed.nextObjectiveHint, "food_reserve");
  assert.deepEqual(closed.foodNeeds, foodNeeds({ ...noBread, tick: seasonStart }));
});

test("HR-12 (portraits) under 8 the common pool's baby, toddler and child faces (LN4), 8–13 child faces only, and a petition's heads show different faces", () => {
  const adultOnly = PORTRAIT_POOL.find(entry => entry.lineage === undefined && !PORTRAIT_POOL.some(other => other.identityId === entry.identityId && other.band === "child"))!;
  const person = { portraitIdentity: adultOnly.identityId, sex: adultOnly.sex as Person["sex"], classBand: "labour" as const };
  assert.equal(PORTRAIT_MIN_AGE, 8);
  // PERSON-1a (LN4, replacing the figure under 8): the common pool's picture of the age.
  const bandOf = (choice: ReturnType<typeof portraitFor>) => PORTRAIT_POOL.find(entry => entry.id === choice.portraitId)?.band;
  assert.deepEqual([bandOf(portraitFor(person, "child", 2)), bandOf(portraitFor(person, "child", INFANT_AGE)), bandOf(portraitFor(person, "child", 7))], ["baby", "toddler", "child"]);
  assert.ok([2, INFANT_AGE, 7].every(age => PORTRAIT_POOL.find(entry => entry.id === portraitFor(person, "child", age).portraitId)!.lineage === "common"));
  assert.equal(portraitFor(person, "child", 10).silhouette, "child", "an adult-only face is never shown for a child");
  const childFace = PORTRAIT_POOL.find(entry => entry.band === "child")!;
  const child = { portraitIdentity: childFace.identityId, sex: childFace.sex as Person["sex"], classBand: "labour" as const };
  const shown = portraitFor(child, "child", 10);
  assert.equal(shown.silhouette, undefined);
  assert.equal(PORTRAIT_POOL.find(entry => entry.id === shown.portraitId)!.band, "child");
  const chosen = choosePortraitIdentity(7, { id: "p-000900", sex: "female", classBand: "labour", build: "average", occupation: "none", tags: [], role: "child" }, "child", new Map());
  assert.ok(PORTRAIT_POOL.some(entry => entry.identityId === chosen && entry.band === PORTRAIT_BAND.child), "a child is given a face with a child picture");
  // A child who died at two is remembered as a baby, not a grown face.
  const state = DEFAULT_GAME_STATE;
  const dead: Person = { id: "p-000901", givenName: "Alice", sex: "female", birthYear: 1300, householdId: "h", role: "child", classBand: "labour",
    occupation: "none", build: "average", hair: "brown", alive: false, deathYear: 1302, portraitIdentity: adultOnly.identityId, tags: [],
    lineageId: "lin:p-000901", traits: { hair: "brown", skin: 3, eye: "grey", faceShape: "round", nose: "snub", buildBias: "average" } };
  assert.equal(bandOf(personPortrait({ ...state, tick: 20 * YEAR }, dead)), "baby", "a child who died at two is remembered as the baby she was");
  // Two petitioners never share a face: give the town's first heads one identity and name a petition.
  const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v16/population-176.save.json"))).envelope.state as GameState;
  const heads = town.persons!.people.filter(entry => entry.role === "head" && entry.householdId !== "manor");
  const twin = heads[0]!.portraitIdentity;
  const twinned = { ...town, persons: { ...town.persons!, people: town.persons!.people.map(entry => entry.role === "head" ? { ...entry, portraitIdentity: twin } : entry) },
    politics: { merchantGauge: 50, petitions: [{ id: "market_charter@1", defId: "market_charter", petitioner: "merchants", arrivedTick: town.tick }], rights: [], decisions: [], chapterEnds: [] } } as unknown as GameState;
  const named = advancePersons(twinned).politics!.petitions[0]!.petitionerIds!;
  const faces = named.map(id => advancePersons(twinned).persons!.people.find(entry => entry.id === id)!.portraitIdentity);
  assert.equal(new Set(faces).size, faces.length, `petitioners ${named.join(", ")} faces ${faces.join(", ")}`);
});
