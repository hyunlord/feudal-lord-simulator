/**
 * FIX-11 regression tests: minor lord wardship, death rules, epithets, mayor candidate,
 * double house change, heirCandidates leftYear.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { beginWardship, lordFamilyExtinct } from "../src/engine/lordship";
import { HEIR_CANDIDATE_TAG, advancePersons, inTown } from "../src/engine/persons";
import { MANOR_HOUSEHOLD, type Person } from "../src/engine/persons.types";
import { heirCandidates } from "../src/engine/legacy";
import type { HeirCandidate } from "../src/engine/legacy.types";
import { lordshipOf } from "../src/engine/lordshipState";
import type { PersonTraits } from "../src/content/personTraits";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const TRAITS: PersonTraits = { hair: "brown", skin: 2, eye: "brown", faceShape: "round", nose: "straight", buildBias: "average" };

function makePerson(overrides: Partial<Person> & { id: string; householdId: string }): Person {
  return {
    givenName: "John", surname: "Smith", sex: "male",
    birthYear: 1320, alive: true, role: "head",
    classBand: "labour", occupation: "farmer",
    portraitIdentity: "p01", tags: [],
    build: "average", hair: "brown",
    lineageId: "town",
    traits: TRAITS,
    ...overrides,
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...DEFAULT_GAME_STATE, persons: { people: [], past: [], nextOrdinal: 1 }, ...overrides };
}

// --- Item 4 / baseline: inTown() ---

test("FIX-11 inTown: alive person without leftYear is in town", () => {
  const p = makePerson({ id: "p1", householdId: "house-001" });
  assert.equal(inTown(p), true);
});

test("FIX-11 inTown: alive person with leftYear is NOT in town", () => {
  const p = makePerson({ id: "p1", householdId: "house-001", leftYear: 1383 });
  assert.equal(inTown(p), false);
});

test("FIX-11 inTown: dead person is not in town", () => {
  const p: Person = { ...makePerson({ id: "p1", householdId: "house-001" }), alive: false, deathYear: 1383, deathCause: "age" };
  assert.equal(inTown(p), false);
});

// --- Item 5: lordFamilyExtinct returns false when heir candidates pending ---

test("FIX-11 lordFamilyExtinct: returns false when heir-candidate persons are alive in town", () => {
  const houseOrder = 1;
  const tag = `lord-house:${houseOrder}`;
  const heirCandidate = makePerson({ id: "p-heir", householdId: MANOR_HOUSEHOLD, tags: [HEIR_CANDIDATE_TAG] });
  const deceased: Person = { ...makePerson({ id: "p-dead", householdId: MANOR_HOUSEHOLD, tags: [tag] }), alive: false, deathYear: 1383, deathCause: "plague" };
  const state = baseState({ persons: { people: [heirCandidate], past: [deceased], nextOrdinal: 2 } });
  assert.equal(lordFamilyExtinct(state), false, "heir candidate pending: should not fire extinction");
});

test("FIX-11 lordFamilyExtinct: returns true when plague killed all lord-house members and no candidates", () => {
  const tag = "lord-house:1";
  const deceased: Person = { ...makePerson({ id: "p-dead", householdId: MANOR_HOUSEHOLD, tags: [tag] }), alive: false, deathYear: 1383, deathCause: "plague" };
  const state = baseState({ persons: { people: [], past: [deceased], nextOrdinal: 2 } });
  assert.equal(lordFamilyExtinct(state), true);
});

// --- Item 1: beginWardship sets wardship ---

test("FIX-11 beginWardship: sets wardship.since to tick", () => {
  const minorLord = makePerson({ id: "p-lord", householdId: MANOR_HOUSEHOLD, role: "head", birthYear: 1375, tags: ["lord-house:1"] });
  const state = baseState({ tick: 5_000, persons: { people: [minorLord], past: [], nextOrdinal: 2 } });
  const after = beginWardship(state, 5_000, minorLord);
  const wardship = lordshipOf(after).wardship;
  assert.ok(wardship !== undefined, "wardship must be set");
  assert.equal(wardship.since, 5_000);
});

test("FIX-11 beginWardship: guardianId null when no adult kin (overlord wardship)", () => {
  const minorLord = makePerson({ id: "p-lord", householdId: MANOR_HOUSEHOLD, role: "head", birthYear: 1375, tags: ["lord-house:1"] });
  const state = baseState({ tick: 5_000, persons: { people: [minorLord], past: [], nextOrdinal: 2 } });
  const after = beginWardship(state, 5_000, minorLord);
  assert.equal(lordshipOf(after).wardship?.guardianId, null);
});

test("FIX-11 beginWardship: mother becomes guardian when present", () => {
  const minorLord = makePerson({ id: "p-lord", householdId: MANOR_HOUSEHOLD, role: "head", birthYear: 1375, tags: ["lord-house:1"] });
  const mother = makePerson({ id: "p-mum", householdId: MANOR_HOUSEHOLD, role: "spouse", sex: "female", birthYear: 1340 });
  const state = baseState({ tick: 5_000, persons: { people: [minorLord, mother], past: [], nextOrdinal: 3 } });
  const after = beginWardship(state, 5_000, minorLord);
  assert.equal(lordshipOf(after).wardship?.guardianId, "p-mum");
});

// --- Item 6: heirCandidates includes leftYear ---

test("FIX-11 heirCandidates: result includes leftYear field (undefined for in-town person)", () => {
  const candidate: HeirCandidate = { kind: "eldest_son", personId: "p-heir", throughId: null, relation: "son", created: false };
  const person = makePerson({ id: "p-heir", householdId: MANOR_HOUSEHOLD, role: "head" });
  const state = {
    ...DEFAULT_GAME_STATE,
    tick: 0,
    legacy: {
      startTick: 0, steps: { "succession.question": 0 },
      answers: {}, mayorCandidateId: null, candidates: [candidate],
      royalSubsidy: 0, backlash: 0,
    } as unknown as GameState["legacy"],
    persons: { people: [person], past: [], nextOrdinal: 2 },
  } as unknown as GameState;
  const results = heirCandidates(state);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.leftYear, undefined, "in-town person has no leftYear (field absent or undefined)");
});

test("FIX-11 heirCandidates: leftYear is set for a person who left", () => {
  const candidate: HeirCandidate = { kind: "eldest_son", personId: "p-heir", throughId: null, relation: "son", created: false };
  const person = makePerson({ id: "p-heir", householdId: "house-001", role: "head", leftYear: 1390 });
  const state = {
    ...DEFAULT_GAME_STATE,
    tick: 0,
    legacy: {
      startTick: 0, steps: { "succession.question": 0 },
      answers: {}, mayorCandidateId: null, candidates: [candidate],
      royalSubsidy: 0, backlash: 0,
    } as unknown as GameState["legacy"],
    persons: { people: [person], past: [], nextOrdinal: 2 },
  } as unknown as GameState;
  const results = heirCandidates(state);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.leftYear, 1390);
});

// --- Item 3: pair epithet cleared when lone survivor ---

test("FIX-11 pair epithet clearing: lone survivor loses pair epithet when namesake leaves", () => {
  // elder in house-001 (removed), younger in house-002 (kept).
  // When house-001 is gone, elder leaves → younger's epithet should be cleared.
  const elder = makePerson({ id: "p01", householdId: "house-001", epithet: "the elder" });
  const younger = makePerson({ id: "p02", householdId: "house-002", epithet: "the younger" });
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: 0,
    houses: [{
      buildingId: "house-002", level: 1, builtLevel: 1, residents: 1,
      hasWater: true, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0,
      members: { adults: 1, children: 0, seed: 2 },
    }],
    population: 1,
    persons: { people: [elder, younger], past: [], nextOrdinal: 3 },
  };
  const after = advancePersons(state);
  const survivor = after.persons!.people.find(p => p.id === "p02") ??
    after.persons!.past.find(p => p.id === "p02");
  assert.ok(survivor !== undefined, "younger (p02) should appear in people or past");
  assert.equal(survivor.epithet, undefined, "lone survivor pair epithet must be cleared");
});

// --- Item 2: death not gated by canRefill ---

test("FIX-11 canRefill gate removed: code path runs without error for waterless house on deathDay", () => {
  // We cannot guarantee a specific death roll outcome, but verify no error is thrown and
  // the code path is reachable (old gate would skip the roll entirely).
  const oldBirthYear = 1383 - 90;
  const oldPerson = makePerson({ id: "p99", householdId: "house-dry", birthYear: oldBirthYear });
  const dryHouse = {
    buildingId: "house-dry", level: 1, builtLevel: 1, residents: 1,
    hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0,
    members: { adults: 1, children: 0, seed: 99 },
  };
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: 1, // first deathDay (tick % SEASON === 1)
    houses: [dryHouse],
    population: 1,
    persons: { people: [oldPerson], past: [], nextOrdinal: 2 },
  };
  // Must not throw; in old code the death roll was skipped entirely for canRefill=false houses.
  let ran = false;
  assert.doesNotThrow(() => { advancePersons(state); ran = true; });
  assert.ok(ran);
});

test("FIX-11 item 2: a house that cannot refill still loses its old to age (was skipped: canRefill gated the roll)", () => {
  const old = Array.from({ length: 40 }, (_, index) => makePerson({ id: `p-${index + 1}`, householdId: "house-dry", birthYear: 1200, role: index === 0 ? "head" : "kin" }));
  const dryHouse = { buildingId: "house-dry", level: 1, builtLevel: 1, residents: 40, hasWater: false, breadStock: 0, lastServicedTick: 0,
    unmetRequirementTicks: 0, members: { adults: 40, children: 0, seed: 99 } };
  const state: GameState = { ...DEFAULT_GAME_STATE, tick: 1_001, houses: [dryHouse], population: 40, persons: { people: old, past: [], nextOrdinal: 41 } };
  const after = advancePersons(state);
  const aged = (after.persons?.past ?? []).filter(person => !person.alive && person.deathCause === "age");
  assert.ok(aged.length >= 3, `age deaths ${aged.length}`);
});

test("FIX-11 item 2: someone who left town ages out on the same table (was never rolled)", () => {
  const gone = Array.from({ length: 40 }, (_, index) => makePerson({ id: `p-${index + 1}`, householdId: "house-gone", birthYear: 1200, leftYear: 1290 }));
  const state: GameState = { ...DEFAULT_GAME_STATE, tick: 1_001, persons: { people: [], past: gone, nextOrdinal: 41 } };
  const after = advancePersons(state);
  const died = (after.persons?.past ?? []).filter(person => !person.alive);
  assert.ok(died.length >= 3, `deaths ${died.length}`);
  for (const person of died) { assert.equal(person.deathCause, "age"); assert.equal(person.leftYear, undefined); }
  const young = { ...state, persons: { people: [], past: gone.map(person => ({ ...person, birthYear: 1280 })), nextOrdinal: 41 } };
  assert.ok((advancePersons(young).persons?.past ?? []).filter(person => !person.alive).length <= 2);
});

test("FIX-11 item 2: a widowed head of 60 or more takes no new spouse of their own age (a 100-year-old took a bride of 100)", () => {
  const house = (id: string) => ({ buildingId: id, level: 1, builtLevel: 1, residents: 3, hasWater: true, breadStock: 5, lastServicedTick: 0,
    unmetRequirementTicks: 0, members: { adults: 3, children: 0, seed: 7 } });
  const widower = (id: string, household: string, birthYear: number) => makePerson({ id, householdId: household, birthYear, role: "head" });
  const state: GameState = { ...DEFAULT_GAME_STATE, tick: 1_000, houses: [house("house-old"), house("house-young")], population: 6,
    persons: { people: [widower("p-1", "house-old", 1300 - 95), widower("p-2", "house-young", 1300 - 40)], past: [], nextOrdinal: 3 } };
  const after = advancePersons(state);
  const spouses = (household: string) => (after.persons?.people ?? []).filter(person => person.householdId === household && person.role === "spouse");
  assert.equal(spouses("house-old").length, 0, "no bride for the 95-year-old");
  assert.equal(spouses("house-young").length, 1, "the 40-year-old marries again");
  const year = 1300;
  for (const person of after.persons?.people ?? []) assert.ok(year - person.birthYear < 100 || person.id === "p-1", `${person.id} ${year - person.birthYear}`);
});
