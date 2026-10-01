/**
 * FIX-6 ③ (decision FX6-4): every person's name reads in Korean — the tables cover every given name, surname, byname and
 * king the game gives, and `personDisplayName` writes no Latin letter for anyone in five towns or their factions to 1450.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { KINGS } from "../src/content/factionConfig";
import { BISHOP_SURNAMES, EARL_SURNAMES, NEIGHBOUR_SURNAMES } from "../src/content/gentryNames";
import { LORD_HOUSE_NAMES } from "../src/content/lordshipConfig";
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES, NAMESAKE_EPITHETS, OCCUPATIONAL_SURNAMES, ORDINAL_EPITHETS, PATRONYMIC_SURNAMES, TOPOGRAPHIC_SURNAMES } from "../src/content/personNames";
import { EPITHETS_KO, GIVEN_NAMES_KO, KING_NAMES_KO, SURNAMES_KO } from "../src/content/personNames.ko";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactions } from "../src/engine/factions";
import { personDisplayName } from "../src/engine/persons";
import { persons } from "../src/engine/personsApi";
import { initialPolitics } from "../src/engine/politics";
import { decodeSave } from "../src/save/saveCodec";

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;
const LATIN = /[A-Za-z]/;

test("the reading tables cover every given name, surname, byname and king the game gives", () => {
  const missing = (table: Readonly<Record<string, string>>, names: readonly string[]) => names.filter(name => table[name] === undefined || LATIN.test(table[name]!));
  assert.deepEqual(missing(GIVEN_NAMES_KO, [...MALE_GIVEN_NAMES, ...FEMALE_GIVEN_NAMES].map(entry => entry.name)), []);
  assert.deepEqual(missing(SURNAMES_KO, [...Object.values(OCCUPATIONAL_SURNAMES), ...TOPOGRAPHIC_SURNAMES, ...Object.values(PATRONYMIC_SURNAMES),
    ...EARL_SURNAMES, ...NEIGHBOUR_SURNAMES, ...BISHOP_SURNAMES, ...LORD_HOUSE_NAMES]), []);
  assert.deepEqual(missing(EPITHETS_KO, [...NAMESAKE_EPITHETS, ...ORDINAL_EPITHETS]), []);
  assert.deepEqual(missing(KING_NAMES_KO, KINGS.map(king => king.name)), []);
});

test("personDisplayName: the byname as an epithet before the name, the gentry's houses, the kings, the last numbered byname", () => {
  const person = { givenName: "Thomas", surname: "Adamson", occupation: "labourer" };
  // QA010: the elder and the younger of a namesake pair are 큰/작은 (the pair's order, not an age).
  assert.equal(personDisplayName({ ...person, epithet: "the elder" }), "큰 토머스 애덤슨");
  assert.equal(personDisplayName({ ...person, epithet: "the younger" }), "작은 토머스 애덤슨");
  assert.equal(personDisplayName({ givenName: "Joan", surname: "atte Well", occupation: "brewer", epithet: "le Rous" }), "붉은 머리 조앤 아트웰");
  assert.equal(personDisplayName({ givenName: "Agnes", occupation: "child" }), "애그니스");
  assert.equal(personDisplayName({ givenName: "John", surname: "Smith", occupation: "smith", epithet: "no. 000123" }), "123번 존 스미스");
  assert.equal(personDisplayName({ givenName: "William", surname: EARL_SURNAMES[0]!, occupation: "earl" }), `윌리엄 ${SURNAMES_KO[EARL_SURNAMES[0]!]}`);
  assert.equal(personDisplayName({ givenName: "Edward III", occupation: "king" }), "에드워드 3세");
  assert.equal(persons.displayName, personDisplayName, "the screens' one path");
});

test("no Latin letter in any name of five towns (the living, the past) and their factions' people to 1450", () => {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  for (const seed of [1, 2, 3, 4, 5]) {
    const { factions: _factions, ...rest } = { ...saved, seed, tick: Math.ceil(saved.tick / YEAR) * YEAR, politics: initialPolitics(saved) };
    let state = advanceFactions(rest as GameState);
    for (let year = Math.floor(state.tick / YEAR) + 1301; year <= 1450; year += 1) state = advanceFactions({ ...state, tick: (year - 1300) * YEAR });
    const people = [...state.persons!.people, ...state.persons!.past, ...state.factions!.people];
    const latin = people.map(personDisplayName).filter(name => LATIN.test(name));
    assert.deepEqual(latin, [], `seed ${seed}`);
  }
});
