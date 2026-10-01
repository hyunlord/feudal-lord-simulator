/**
 * PERSON-1a lineage (spec docs/design/lineage.md LN-1…LN-12): scenarios H1–H10.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HAIR_TRAITS, TRAIT_MUTATION_PERMILLE, TRAIT_POPULATION, hairFromWords, skinFromWords, traitDistance, type PersonTraits } from "../src/content/personTraits";
import { PORTRAIT_POOL } from "../src/content/portraitPool";
import type { GameState } from "../src/engine/engine.types";
import { inheritTraits, populationTraits, sharedTraits } from "../src/engine/heredity";
import { advanceHistory } from "../src/engine/history";
import { LORD_FAMILY_TAG, advancePersons, newbornCustomName } from "../src/engine/persons";
import { persons } from "../src/engine/personsApi";
import { MANOR_HOUSEHOLD, type Person } from "../src/engine/persons.types";
import { choosePortraitIdentity, identityLineage, portraitFor } from "../src/engine/portraits";
import type { House } from "../src/population/population.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const SEASON = 1_000;
const YEAR = 4_000;
const TRAITS: PersonTraits = { hair: "red", skin: 2, eye: "green", faceShape: "long", nose: "hooked", buildBias: "thin" };
const OTHER: PersonTraits = { hair: "black", skin: 6, eye: "brown", faceShape: "round", nose: "snub", buildBias: "heavy" };

function town(count: number, residents: number, tick = 0, seed = DEFAULT_GAME_STATE.seed): GameState {
  const houses: House[] = Array.from({ length: count }, (_, index) => ({ buildingId: `house-${String(index).padStart(3, "0")}`, level: 2, builtLevel: 2,
    residents, hasWater: true, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0, members: { adults: Math.ceil(residents / 2), children: Math.floor(residents / 2), seed: index } }));
  return { ...DEFAULT_GAME_STATE, seed, tick, houses, population: count * residents };
}
const fixture = (name: string, version: number) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${version}/${name}.save.json`))).envelope.state as GameState;
const person = (id: string, sex: Person["sex"], extra: Partial<Person> = {}): Person => ({ id, givenName: sex === "male" ? "Walter" : "Agnes", sex, birthYear: 1270,
  householdId: "h", role: "head", classBand: "labour", occupation: "labourer", build: "average", hair: "brown", alive: true, portraitIdentity: "I061",
  tags: [], lineageId: `lin:${id}`, traits: TRAITS, ...extra });

test("H1 (LN-1) every portrait's traits are read from its record: a known hair on nearly all, grey hair as the colour it was, every value in the vocabulary", () => {
  const withHair = PORTRAIT_POOL.filter(entry => entry.traits.hair !== undefined).length;
  assert.ok(withHair / PORTRAIT_POOL.length >= 0.95, `${withHair} of ${PORTRAIT_POOL.length}`);
  assert.ok(PORTRAIT_POOL.every(entry => entry.traits.hair === undefined || (HAIR_TRAITS as readonly string[]).includes(entry.traits.hair)));
  assert.ok(PORTRAIT_POOL.every(entry => entry.traits.skin === undefined || (entry.traits.skin >= 0 && entry.traits.skin <= 7)));
  assert.equal(hairFromWords("silver-grey and white remnants of original black brown"), "dark_brown");
  assert.equal(hairFromWords("sparse pale flaxen down"), "flaxen");
  assert.equal(hairFromWords("copper red"), "red");
  assert.equal(hairFromWords("dark auburn with grey strands"), "auburn");
  assert.ok(skinFromWords("very fair rosy ivory")! < skinFromWords("warm medium tan")!);
  // An aging chain is one person: its pictures share their traits.
  const chain = PORTRAIT_POOL.filter(entry => entry.identityId === "I061");
  assert.ok(chain.length >= 2 && chain.every(entry => entry.traits.hair === chain[0]!.traits.hair));
});

test("H2 (LN-2) a child's traits come from the father or the mother, each deterministic; one trait in twenty mutates", () => {
  assert.deepEqual(inheritTraits(7, "town", 42, TRAITS, OTHER), inheritTraits(7, "town", 42, TRAITS, OTHER));
  let traits = 0; let fromParents = 0; let fromFather = 0;
  for (let subject = 0; subject < 4_000; subject += 1) {
    const child = inheritTraits(7, "town", subject, TRAITS, OTHER);
    for (const key of ["hair", "eye", "faceShape", "nose", "buildBias"] as const) {
      traits += 1;
      if (child[key] === TRAITS[key] || child[key] === OTHER[key]) fromParents += 1;
      if (child[key] === OTHER[key]) fromFather += 1;
    }
  }
  const mutated = 1 - fromParents / traits;
  // A mutation that draws a parent's value by chance reads as inherited: the rate seen is at most the rule's 5 %.
  assert.ok(mutated > 0.02 && mutated <= TRAIT_MUTATION_PERMILLE / 1000 + 0.01, `mutation ${mutated}`);
  assert.ok(Math.abs(fromFather / traits - 0.5) < 0.05, `from the father ${fromFather / traits}`);
});

test("H3 (LN-3) founders and newcomers draw from the population of 1300 southern England", () => {
  const draws = Array.from({ length: 20_000 }, (_, subject) => populationTraits(11, "town", subject));
  const share = (hair: PersonTraits["hair"]) => draws.filter(traits => traits.hair === hair).length / draws.length;
  const total = TRAIT_POPULATION.hair.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [hair, weight] of TRAIT_POPULATION.hair) assert.ok(Math.abs(share(hair) - weight / total) < 0.015, `${hair} ${share(hair)}`);
  assert.ok(draws.every(traits => traits.skin >= 0 && traits.skin <= 7));
});

test("H4 (LN-2, LN-11) a child born in a household has its mother and father; the woman with child bears it; the API finds them", () => {
  let state = advancePersons(town(1, 4, SEASON));
  const couple = state.persons!.people.filter(entry => entry.householdId === "house-000" && (entry.role === "head" || entry.role === "spouse"));
  const wife = couple.find(entry => entry.sex === "female")!;
  const husband = couple.find(entry => entry.sex === "male")!;
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(entry => entry.id === wife.id ? { ...entry, condition: { kind: "pregnant" as const, since: 0, until: 9 * SEASON } } : entry) } };
  const known = new Set(state.persons!.people.map(entry => entry.id));
  state = advancePersons({ ...state, tick: SEASON + 1, houses: state.houses.map(house => ({ ...house, residents: 5 })) });
  const child = state.persons!.people.find(entry => entry.role === "child" && !known.has(entry.id))!;
  assert.equal(child.motherId, wife.id);
  assert.equal(child.fatherId, husband.id);
  assert.equal(child.lineageId, husband.lineageId, "the father's lineage");
  assert.equal(state.persons!.people.find(entry => entry.id === wife.id)!.condition, undefined, "the birth ends the pregnancy");
  assert.deepEqual(persons.parents(state, child.id), { mother: persons.parents(state, child.id).mother, father: persons.parents(state, child.id).father });
  assert.equal(persons.parents(state, child.id).mother!.id, wife.id);
  assert.ok(persons.children(state, husband.id).some(entry => entry.id === child.id), "the father's children include the newborn");
  assert.ok(sharedTraits(child.traits, wife.traits).length + sharedTraits(child.traits, husband.traits).length >= 4, "a child shares most traits with its parents");
});

test("H5 (LN-4) naming custom: first son 50 % father, 20 % grandfather, 30 % godparent; first daughter 40 · 20 · 30 · 10 common; later children common", () => {
  const grandfather = person("p-g", "male", { givenName: "Hugh" });
  const grandmother = person("p-gm", "female", { givenName: "Emma" });
  const father = person("p-f", "male", { givenName: "Walter", fatherId: "p-g" });
  const mother = person("p-m", "female", { givenName: "Agnes", motherId: "p-gm" });
  const reeve = person("p-r", "male", { givenName: "Roger", tags: ["reeve"] });
  const godmother = person("p-gd", "female", { givenName: "Cecily", householdId: MANOR_HOUSEHOLD });
  const find = (id: string | undefined) => [grandfather, grandmother, father, mother].find(entry => entry.id === id);
  const count = (sex: Person["sex"]) => {
    const tally: Record<string, number> = {};
    for (let key = 0; key < 5_000; key += 1) {
      const name = newbornCustomName({ seed: 3, key, sex, mother, father, firstOfSex: true, find, notables: [reeve, godmother] });
      const from = name?.nameFrom ?? "common";
      tally[from] = (tally[from] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(tally).map(([from, n]) => [from, Math.round(n / 50)]));
  };
  const sons = count("male");
  assert.ok(Math.abs(sons.father! - 50) <= 3 && Math.abs(sons.grandfather! - 20) <= 3 && Math.abs(sons.godparent! - 30) <= 3, JSON.stringify(sons));
  const daughters = count("female");
  assert.ok(Math.abs(daughters.mother! - 40) <= 3 && Math.abs(daughters.grandmother! - 20) <= 3 && Math.abs(daughters.godparent! - 30) <= 3
    && Math.abs(daughters.common! - 10) <= 3, JSON.stringify(daughters));
  const byGodparent = newbornCustomName({ seed: 3, key: [...Array(200).keys()].find(key => newbornCustomName({ seed: 3, key, sex: "male", mother, father, firstOfSex: true, find, notables: [reeve, godmother] })?.nameFrom === "godparent")!,
    sex: "male", mother, father, firstOfSex: true, find, notables: [reeve, godmother] })!;
  assert.deepEqual([byGodparent.givenName, byGodparent.godparentId], ["Roger", "p-r"], "the godparent of the child's sex");
  assert.equal(newbornCustomName({ seed: 3, key: 1, sex: "male", mother, father, firstOfSex: false, find, notables: [reeve] }), null, "a later son: the common names");
});

test("H6 (LN-5, LN-9) lineages: the lord's family in the manor (L3), a merchant head's (L4), a miller's (L8), two reeves' (L5), a new house's family (L1)", () => {
  let state = advancePersons(town(6, 4, SEASON));
  const lordFamily = state.persons!.people.filter(entry => entry.tags.includes(LORD_FAMILY_TAG));
  assert.equal(lordFamily.length, 4);
  assert.ok(lordFamily.every(entry => entry.householdId === MANOR_HOUSEHOLD && entry.id.startsWith("m-")));
  assert.equal(state.population, 24, "the lord's family is not in the town's count");
  const heads = state.persons!.people.filter(entry => entry.role === "head" && entry.householdId !== MANOR_HOUSEHOLD).sort((a, b) => a.id.localeCompare(b.id));
  const people = state.persons!.people.map(entry => entry.id === heads[0]!.id ? { ...entry, classBand: "merchant" as const }
    : entry.id === heads[1]!.id ? { ...entry, occupation: "miller", classBand: "artisan" as const } : entry);
  state = advancePersons({ ...state, tick: 2 * SEASON, persons: { ...state.persons!, people, reeveTerms: { [heads[2]!.lineageId]: 2 } } });
  const sets = Object.fromEntries(state.persons!.lineages!.map(lineage => [lineage.kind, lineage.set]));
  assert.deepEqual(sets, { lord: "L3", merchant: "L4", miller: "L8", reeve: "L5" });
  assert.equal(persons.lineageSet(state, heads[0]!.lineageId)!.set, "L4");
  // A child's lineage is its father's; the lineage lists its generations.
  const lord = state.persons!.people.find(entry => entry.tags.includes(LORD_FAMILY_TAG) && entry.role === "head")!;
  const generations = persons.lineage(state, lord.lineageId);
  assert.deepEqual(generations.map(row => row.length), [1, 2]);
  assert.ok(generations[1]!.every(child => child.fatherId === lord.id));
  // A new house (FL-7): the old family leaves, the new house's forms and takes L1.
  const house2 = advancePersons({ ...state, tick: 3 * SEASON, lordship: { house: { order: 2, name: "de Querney", heraldrySeed: 2, since: 3 * SEASON },
    pastHouses: [], titleDemoted: false, decline: null } });
  assert.ok(house2.persons!.people.filter(entry => entry.tags.includes(LORD_FAMILY_TAG)).every(entry => entry.tags.includes("lord-house:2")));
  assert.equal(house2.persons!.lineages!.find(lineage => lineage.id === "lord:2")!.set, "L1");
});

test("H7 (LN-6, LN-7) faces: a set's family wears the set (founders 1xx, children 2xx); under 8 the common pool; the town's faces follow the traits", () => {
  const state = advancePersons(town(2, 4, SEASON));
  const family = state.persons!.people.filter(entry => entry.tags.includes(LORD_FAMILY_TAG));
  assert.ok(family.every(entry => identityLineage(entry.portraitIdentity) === "L3"), family.map(entry => entry.portraitIdentity).join(","));
  const lord = family.find(entry => entry.role === "head")!;
  assert.match(lord.portraitIdentity, /^L3_10[12]$/);
  assert.ok(family.filter(entry => entry.role === "child").every(entry => /^L3_20[1-4]$/.test(entry.portraitIdentity)));
  // A baby: the common pool's (or the set's baby picture), never a silhouette while the pool has the sex.
  const baby = portraitFor({ portraitIdentity: "I061", sex: "female", classBand: "labour", id: "p-000777", traits: TRAITS }, "child", 1);
  assert.equal(PORTRAIT_POOL.find(entry => entry.id === baby.portraitId)!.lineage, "common");
  // The town's face follows the traits: two people who differ only in their traits get faces nearer their own.
  const chooser = { id: "p-000800", sex: "male" as const, classBand: "labour" as const, build: "average" as const, occupation: "labourer", tags: [], role: "head" as const };
  const red = choosePortraitIdentity(5, { ...chooser, traits: TRAITS }, "adult", new Map());
  const dark = choosePortraitIdentity(5, { ...chooser, traits: OTHER }, "adult", new Map());
  const traitsOf = (identity: string) => PORTRAIT_POOL.find(entry => entry.identityId === identity)!.traits;
  assert.equal(traitsOf(red).hair, "red");
  assert.ok(traitDistance(OTHER, traitsOf(dark)) < traitDistance(OTHER, traitsOf(red)) && traitDistance(TRAITS, traitsOf(red)) < traitDistance(TRAITS, traitsOf(dark)),
    "each face is nearer its own person's traits");
  assert.equal(identityLineage(red), undefined, "the lineage sets are not the town's faces");
});

test("H8 (LN-12) a v23 save promotes: every person has traits and a lineage, children their household's parents; v24 round-trips", () => {
  const state = fixture("palisade-construction", 23);
  const people = [...state.persons!.people, ...state.persons!.past, ...(state.factions?.people ?? [])];
  assert.ok(people.every(entry => entry.traits !== undefined && entry.lineageId.length > 0));
  const children = state.persons!.people.filter(entry => entry.role === "child" && entry.householdId !== MANOR_HOUSEHOLD);
  const linked = children.filter(entry => entry.motherId !== undefined || entry.fatherId !== undefined);
  assert.ok(linked.length / children.length >= 0.8, `${linked.length} of ${children.length}`);
  for (const child of linked) {
    const parent = state.persons!.people.find(entry => entry.id === (child.fatherId ?? child.motherId))!;
    assert.equal(parent.householdId, child.householdId);
    assert.ok(child.birthYear - parent.birthYear >= 14);
  }
  // Traits are the face's: a promoted person's hair is their portrait's.
  const withFace = state.persons!.people.find(entry => PORTRAIT_POOL.find(picture => picture.identityId === entry.portraitIdentity)?.traits.hair !== undefined)!;
  assert.equal(withFace.traits.hair, PORTRAIT_POOL.find(picture => picture.identityId === withFace.portraitIdentity)!.traits.hair);
  const advanced = advancePersons({ ...state, tick: Math.ceil(state.tick / SEASON) * SEASON });
  const loaded = decodeSave(encodeSave({ state: advanced, createdAt: "2026-09-28T00:00:00.000Z", savedAt: "2026-09-28T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.deepEqual(loaded.envelope.state, advanced);
});

test("H9 (LN-10) the five states: ill, injured, with child, on pilgrimage and the bailiff are in the ledger, and change no house", () => {
  let state = advancePersons(town(24, 8, SEASON));
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map((entry, index) => entry.role === "head" && index % 5 === 0 ? { ...entry, classBand: "artisan" as const } : entry) } };
  const templates = new Map<string, number>();
  for (let season = 2; season <= 48; season += 1) {
    const before = state;
    const next = advancePersons({ ...state, tick: season * SEASON });
    state = advanceHistory(before, next);
    for (const record of state.history?.records ?? []) templates.set(record.template, (templates.get(record.template) ?? 0) + 1);
    // The states touch no house: the same step without them gives the same houses and population.
    const plain = advancePersons({ ...before, tick: season * SEASON, persons: { ...before.persons!, people: before.persons!.people.map(({ condition: _c, ...rest }) => rest) } });
    assert.deepEqual(plain.houses.map(house => [house.residents, house.members?.adults]), next.houses.map(house => [house.residents, house.members?.adults]));
  }
  for (const template of ["person.fell_ill", "person.injured", "person.expecting", "person.pilgrimage", "person.bailiff", "person.recovered"]) {
    assert.ok((templates.get(template) ?? 0) > 0, `${template}: ${[...templates.entries()].filter(([key]) => key.startsWith("person.")).map(([key, n]) => `${key} ${n}`).join(", ")}`);
  }
  assert.equal(state.persons!.people.filter(entry => entry.tags.includes("bailiff")).length, 1);
});

test("H10 (LN-2, LN-11) determinism: the same town twice gives the same people; resemblance lists the shared traits", () => {
  const run = () => {
    let state = town(8, 6, SEASON, 99);
    for (let season = 1; season <= 20; season += 1) state = advancePersons({ ...state, tick: season * SEASON, houses: state.houses.map(house => ({ ...house, residents: 6 + (season % 3) })) });
    return state.persons!;
  };
  assert.deepEqual(run(), run());
  const a = person("p-a", "male", { traits: TRAITS });
  const b = person("p-b", "female", { traits: { ...OTHER, hair: "red", nose: "hooked" } });
  const state = { ...DEFAULT_GAME_STATE, persons: { people: [a, b], past: [], nextOrdinal: 3 } } as GameState;
  assert.deepEqual(persons.resemblance(state, "p-a", "p-b"), ["hair", "nose"]);
  assert.equal(YEAR, 4 * SEASON);
});

test("H7 (FIX-9, FX9-3) a house whose heiress died: her widower holds it while a child of theirs lives (the courtesy); else her nearest of the blood comes home", () => {
  // The chapter-4 town (seed 1, 1368): the heiress Cecily died of the plague in 1361, her son Geoffrey with her; her
  // widower Henry stayed, with no head. Her mother's brothers left the manor long ago (Thomas b. 1293, Roger b. 1304).
  const town = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-four-town.save.json`))).envelope.state as GameState;
  const yearStart = Math.ceil((town.tick + 1) / YEAR) * YEAR;
  const house = (state: GameState) => [...state.persons!.people].filter(person => person.tags.includes("lord-house:1") && person.householdId === MANOR_HOUSEHOLD);
  assert.ok(!house(town).some(person => person.role === "head"), "no head before");
  const kin = advancePersons({ ...town, tick: yearStart });
  const head = house(kin).find(person => person.role === "head")!;
  assert.equal(head.id, "m-000007", "Roger, her grandfather's son (Thomas, 76, is past the age to be called home)");
  assert.equal(head.leftYear, undefined);
  assert.equal(kin.persons!.past.some(person => person.id === "m-000007"), false);
  assert.equal(house(kin).find(person => person.id === "m-000013")?.role, "kin", "the widower");
  // The courtesy: had her son lived, Henry would hold the house for his life.
  const son = town.persons!.past.find(person => person.id === "m-000014")!;
  const { deathYear: _year, deathCause: _cause, ...living } = son;
  const withSon: GameState = { ...town, tick: yearStart, persons: { ...town.persons!, people: [...town.persons!.people, { ...living, alive: true }],
    past: town.persons!.past.filter(person => person.id !== son.id) } };
  const courtesy = advancePersons(withSon);
  assert.equal(house(courtesy).find(person => person.role === "head")?.id, "m-000013");
  assert.equal(house(courtesy).find(person => person.id === son.id)?.role, "child", "the son stays the heir");
});
