import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { MALE_GIVEN_NAMES } from "../src/content/personNames";
import type { GameState } from "../src/engine/engine.types";
import { advancePersons, ageOf, currentYear, displayName, initialPersons, labourPool, personPortrait, personsByRole, personsOf, seasonDeathPermille, MORTALITY_WEIGHTS } from "../src/engine/persons";
import { persons } from "../src/engine/personsApi";
import { MANOR_HOUSEHOLD, type Person, type PersonState } from "../src/engine/persons.types";
import { choosePortraitIdentity, PORTRAIT_BAND, portraitFor } from "../src/engine/portraits";
import { PORTRAIT_POOL } from "../src/content/portraitPool";
import { advanceTick } from "../src/engine/tick";
import type { House } from "../src/population/population.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// PERSON-0 persons v0 (spec docs/design/persons.md PS-1…PS-9), work order N1–N10.

const SEASON = 1_000;
const YEAR = 4_000;

function fixture(name: string, version = 16): GameState {
  return decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${version}/${name}.save.json`))).envelope.state as GameState;
}
const living = (state: GameState) => state.persons!.people.filter(person => person.householdId !== MANOR_HOUSEHOLD);

/** A town of `count` houses of `residents` each (houses only: persons need no buildings). */
function town(count: number, residents: number, tick = 0): GameState {
  const houses: House[] = Array.from({ length: count }, (_, index) => ({ buildingId: `house-${String(index).padStart(3, "0")}`, level: 2, builtLevel: 2,
    residents, hasWater: true, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0, members: { adults: Math.ceil(residents / 2), children: Math.floor(residents / 2), seed: index } }));
  return { ...DEFAULT_GAME_STATE, tick, houses, population: count * residents };
}

test("N1 promotion to v16: every resident of a v15 town is a person with a name and a birth year, and the steward keeps the manor", () => {
  const state = fixture("population-176");
  assert.ok(state.persons !== undefined);
  for (const house of state.houses) assert.equal(personsOf(state, house.buildingId).length, house.residents, house.buildingId);
  assert.equal(living(state).length, state.population);
  assert.ok(state.persons.people.every(person => person.givenName.length > 0 && Number.isInteger(person.birthYear) && person.portraitIdentity.length > 0));
  const heads = state.houses.filter(house => house.residents > 0).map(house => personsOf(state, house.buildingId)[0]!);
  assert.ok(heads.every(head => head.role === "head" && head.surname !== undefined));
  assert.equal(personsByRole(state, "steward").length, 1);
  assert.equal(personsByRole(state, "steward")[0]!.householdId, MANOR_HOUSEHOLD);
  // Deterministic: the same town promotes to the same persons.
  const again = fixture("population-176", 15);
  assert.deepEqual(initialPersons(again), state.persons);
});

test("N2 names follow the period's frequencies, and namesakes in the town carry bynames so every name is unique", () => {
  const state = town(80, 6);
  const people = initialPersons(state).people;
  const names = people.map(displayName);
  assert.equal(new Set(names).size, names.length, "unique display names");
  const men = people.filter(person => person.sex === "male");
  const tally = new Map<string, number>();
  for (const man of men) tally.set(man.givenName, (tally.get(man.givenName) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  assert.equal(ranked[0]![0], "John");
  const top5 = MALE_GIVEN_NAMES.slice(0, 5).reduce((sum, entry) => sum + (tally.get(entry.name) ?? 0), 0);
  assert.ok(top5 / men.length >= 0.45, `top five ${top5}/${men.length}`);
  const withBynames = people.filter(person => person.epithet !== undefined);
  assert.ok(withBynames.length > 0);
  assert.ok(withBynames.every(person => people.some(other => other !== person && other.givenName === person.givenName && other.surname === person.surname)));
});

test("N3 a child who turns fourteen at the year's start is an adult: counted in the household's adults and the town's labour", () => {
  let state = fixture("population-176");
  const year = currentYear(state);
  const child = state.persons!.people.find(person => ageOf(person, year) < 14 && person.householdId !== MANOR_HOUSEHOLD)!;
  // Make the child thirteen now, so the next year makes them fourteen.
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.id === child.id ? { ...person, birthYear: year - 13 } : person) } };
  state = advancePersons(state);
  const adultsBefore = state.houses.find(house => house.buildingId === child.householdId)!.members!.adults;
  const poolBefore = labourPool(state);
  const nextYear = { ...state, tick: (Math.floor(state.tick / YEAR) + 1) * YEAR };
  const after = advancePersons(nextYear);
  const grown = after.persons!.people.find(person => person.id === child.id);
  if (grown === undefined) return; // the year's roll took them; the rule is checked on the living
  assert.equal(ageOf(grown, currentYear(after)), 14);
  assert.equal(grown.occupation, "labourer");
  const house = after.houses.find(entry => entry.buildingId === child.householdId)!;
  assert.equal(house.members!.adults, personsOf(after, house.buildingId).filter(person => ageOf(person, currentYear(after)) >= 14).length);
  assert.ok(house.members!.adults >= adultsBefore);
  assert.equal(labourPool(after), after.houses.reduce((sum, entry) => sum + entry.members!.adults, 0));
  assert.ok(poolBefore > 0);
});

test("N4 the season's death rate rises with age and with dear bread; the dead leave their houses and keep their cause", () => {
  assert.ok(seasonDeathPermille(2) > seasonDeathPermille(20));
  assert.ok(seasonDeathPermille(80) > seasonDeathPermille(60) && seasonDeathPermille(60) > seasonDeathPermille(40));
  assert.equal(seasonDeathPermille(40, MORTALITY_WEIGHTS.famine), 3 * seasonDeathPermille(40));
  assert.ok(seasonDeathPermille(70, MORTALITY_WEIGHTS.dearth) > seasonDeathPermille(70));
  // A town of old people on a season's first day: some die, their houses lose them, the past keeps them.
  let state = town(40, 4, 7 * SEASON - 1);
  state = advancePersons(state);
  const year = currentYear(state);
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.householdId === MANOR_HOUSEHOLD ? person : { ...person, birthYear: year - 80 }) } };
  const after = advancePersons({ ...state, tick: 7 * SEASON + 1 });
  const dead = after.persons!.past.filter(person => !person.alive);
  assert.ok(dead.length > 0);
  assert.ok(dead.every(person => person.deathYear === year && person.deathCause === "age"));
  // Houses refill (the growth rule), so the living still equal the residents.
  for (const house of after.houses) assert.equal(personsOf(after, house.buildingId).length, house.residents);
});

test("N5 a household without adults passes to a child of twelve or more; with only younger children it breaks up and the house empties", () => {
  const base = advancePersons(town(2, 3, 10));
  const year = currentYear(base);
  const [first, second] = base.houses.map(house => house.buildingId) as [string, string];
  const people: Person[] = base.persons!.people.map(person => {
    if (person.householdId === first) return person.role === "head" ? { ...person, role: "child" as const, birthYear: year - 12 } : { ...person, role: "child" as const, birthYear: year - 5 };
    if (person.householdId === second) return { ...person, role: "child" as const, birthYear: year - 6 };
    return person;
  });
  const after = advancePersons({ ...base, tick: 11, persons: { ...base.persons!, people } });
  const heir = personsOf(after, first)[0]!;
  assert.equal(heir.role, "head");
  assert.equal(ageOf(heir, year), 12);
  assert.equal(after.houses.find(house => house.buildingId === second)!.residents, 0);
  assert.equal(personsOf(after, second).length, 0);
  assert.ok(after.persons!.past.filter(person => person.householdId === second).every(person => person.alive && person.leftYear === year));
});

test("N6 the steward and the reeve are persons: the reeve a labour household head of 25–60, chosen again each year", () => {
  const state = advancePersons({ ...fixture("population-176"), tick: 12 * YEAR });
  const [steward] = persons.byRole(state, "steward");
  assert.ok(steward !== undefined && steward.classBand === "gentry" && steward.occupation === "steward");
  const [reeve] = persons.byRole(state, "reeve");
  assert.ok(reeve !== undefined);
  assert.equal(reeve.role, "head");
  assert.equal(reeve.classBand, "labour");
  const age = ageOf(reeve, currentYear(state));
  assert.ok(age >= 25 && age <= 60, `${age}`);
  assert.equal(state.persons!.reeveYear, currentYear(state));
  assert.equal(persons.byRole(state, "reeve").length, 1);
});

test("N7 a petition names two or three household heads, the most substantial first", () => {
  const state = fixture("population-176");
  const petitioned: GameState = { ...state, politics: { merchantGauge: 50, petitions: [{ id: "market_charter@1", defId: "market_charter", petitioner: "merchants", arrivedTick: state.tick }],
    rights: [], decisions: [], chapterEnds: [] } as never };
  const after = advancePersons(petitioned);
  const ids = after.politics!.petitions[0]!.petitionerIds!;
  assert.ok(ids.length >= 2 && ids.length <= 3);
  const named = ids.map(id => after.persons!.people.find(person => person.id === id)!);
  assert.ok(named.every(person => person.role === "head" && person.tags.includes("petitioner:market_charter@1")));
  assert.deepEqual(advancePersons(petitioned).politics, after.politics, "deterministic");
});

test("N8 portraits: chosen deterministically, spread across identities, exact for sex, age band and class; a face ages along its chain", () => {
  const state = town(30, 5);
  const first = initialPersons(state);
  assert.deepEqual(initialPersons(state), first);
  // Fewest repeats (counted per face across the town, every stage): while an exact face is unused, it is taken.
  const labourer = { id: "p-009999", sex: "male" as const, classBand: "labour" as const, build: "average" as const, occupation: "labourer", tags: [] as string[], role: "kin" as const };
  const exactFaces = [...new Set(PORTRAIT_POOL.filter(entry => entry.sex === "male" && entry.band === PORTRAIT_BAND.youth && entry.classBand === "labour").map(entry => entry.identityId))];
  assert.ok(exactFaces.length >= 3);
  const usedAllButOne = new Map(exactFaces.slice(1).map(identity => [identity, 1]));
  assert.equal(choosePortraitIdentity(state.seed, labourer, "youth", usedAllButOne), exactFaces[0]);
  const identities = new Set(first.people.map(person => person.portraitIdentity));
  // Most townsfolk are labour class; the pool holds about twenty labour faces a sex, so thirty-odd faces is the spread.
  assert.ok(identities.size >= 25, `${identities.size} faces for ${first.people.length}`);
  const exact = first.people.filter(person => personPortrait(state, person).exact).length;
  assert.ok(exact / first.people.length >= 0.95, `${exact}/${first.people.length}`);
  // An identity with an aging chain shows young, mature, old as the person ages.
  const chained = { portraitIdentity: "I069", sex: "male" as const, classBand: "artisan" as const };
  assert.deepEqual(["youth", "adult", "elder"].map(band => portraitFor(chained, band as never).stage), ["young", "mature", "old"]);
});

test("N9 the ledger's life records are the persons': born, died, a household's line under its head; the biography gathers them", () => {
  let state = fixture("population-176");
  for (let tick = 0; tick < 6_000; tick += 1) state = advanceTick(state);
  const records = state.history!.records;
  const personal = records.filter(record => record.subject.type === "person");
  assert.ok(personal.length > 0);
  assert.ok(records.some(record => record.template === "person.born" || record.template === "person.arrived" || record.template === "person.married"));
  const householdLine = records.find(record => ["person.level_up", "person.hungry", "person.fed", "person.level_down"].includes(record.template))!;
  assert.equal(householdLine.subject.type, "person");
  assert.equal(householdLine.actors?.[0]?.type, "household");
  const subject = householdLine.subject.id;
  const biography = persons.biography(state, subject)!;
  assert.ok(biography.events.some(event => event.id === householdLine.id));
  assert.equal(biography.name, displayName(biography.person));
  assert.ok(records.every(record => record.template !== "person.grew" && record.template !== "person.shrank"), "sizes are births and deaths now");
});

test("N10 a town with persons round-trips through the save (v16+) and runs on identically; v15 promotes", () => {
  let state = fixture("population-176");
  for (let tick = 0; tick < 1_500; tick += 1) state = advanceTick(state);
  const loaded = decodeSave(encodeSave({ state, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
  assert.ok(SAVE_SCHEMA_VERSION >= 16);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.deepEqual(loaded.envelope.state, state);
  let a = state;
  let b = loaded.envelope.state as GameState;
  for (let tick = 0; tick < 1_200; tick += 1) { a = advanceTick(a); b = advanceTick(b); }
  assert.deepEqual(b.persons, a.persons);
  const promoted = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v15/population-176.save.json")));
  assert.equal(promoted.migratedFrom, 15);
  const people = (promoted.envelope.state as GameState).persons as PersonState;
  assert.equal(people.people.length, (promoted.envelope.state as GameState).population + 1);
});
