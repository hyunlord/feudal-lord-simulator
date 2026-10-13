/**
 * LS1-6 (lord-screen-v1.md §3, "영주 집안 출생·사망·혼인 — 가족 칩, 모든 출생·사망"; the user's ruling 2026-10-13): one chip for
 * each birth, death and marriage in the lord's family, the season after it, its people named by the ids the records give
 * (KIN-D1), from the engine's `person.born`, `person.died` and `person.married` records. Not twice: the lord's
 * death a house change follows is the house card's, the first child of an arranged marriage its moment's. And the one
 * place the screen picks a Korean particle (particle.ko.ts).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import type { Person } from "../src/engine/persons.types";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import { particle, withParticle } from "../src/ui/particle.ko";
import { familyBeats } from "../src/ui/persons/familyBeats";

const start = advanceTick(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!);
const family = start.persons!.people.filter(person => person.tags.includes("lord-family"));
const head = family.find(person => person.role === "head")!;
const spouse = family.find(person => person.role === "spouse")!;
const record = (id: string, tick: number, template: string, subject: string, params: Record<string, unknown> = {}) =>
  ({ id, tick, template, subject: { type: "person", id: subject }, params }) as unknown as HistoryRecord;
const town = (tick: number, records: readonly HistoryRecord[], people: readonly Person[] = start.persons!.people, past: readonly Person[] = start.persons!.past): GameState =>
  ({ ...start, tick, history: { ...start.history!, records: [...(start.history?.records ?? []), ...records] }, persons: { ...start.persons!, people, past } }) as GameState;

test("a death, a marriage in the lord's family: a chip each, the season after, its people by the record's ids", () => {
  const dead = { ...spouse, alive: false } as Person;
  const kin = { ...spouse, id: "m-900001", givenName: "Edith", role: "kin" } as Person;
  const state = town(2_400, [record("h-9001", 2_001, "person.died", spouse.id, { cause: "age", age: 41, spouseId: head.id }),
    record("h-9002", 2_300, "person.married", kin.id, { spouseId: head.id })], [...start.persons!.people.filter(person => person.id !== spouse.id), kin], [dead]);
  const beats = familyBeats(state);
  assert.deepEqual(beats.map(beat => beat.id), ["family:h-9001", "family:h-9002"]);
  assert.equal(beats[0]!.kind, "family_news");
  assert.equal(beats[0]!.title, "앨리스가 세상을 떠났습니다");
  assert.deepEqual(beats[0]!.facts, ["배우자 월터"], "the spouse she leaves, by the record's spouseId");
  assert.equal(beats[0]!.chronicle?.recordId, "h-9001");
  assert.equal(beats[1]!.title, "월터와 이디스가 혼인했습니다");
  assert.equal(familyBeats(town(2_001 + 1_000, [record("h-9001", 2_001, "person.died", spouse.id, {})])).length, 0, "a season on: gone");
});

test("a child of the lord's house born: its record, the child by name, its parents by the record's ids", () => {
  const child = { ...family.find(person => person.role === "child")!, id: "m-900002", givenName: "Roger", sex: "male", birthYear: 1300, motherId: spouse.id, fatherId: head.id } as Person;
  const people = [...start.persons!.people, child];
  const born = familyBeats(town(400, [record("h-9301", 0, "person.born", child.id, { motherId: spouse.id, fatherId: head.id, nameFrom: "common" })], people));
  assert.deepEqual(born.map(beat => beat.id), ["family:h-9301"]);
  assert.equal(born[0]!.title, "로저가 태어났습니다");
  assert.deepEqual(born[0]!.facts, ["어머니 앨리스 · 아버지 월터"]);
  assert.equal(born[0]!.chronicle?.recordId, "h-9301");
  assert.equal(familyBeats(town(400, [], people)).length, 0, "no record, no chip: the screen reads the engine's records only");
});

test("not twice: the lord's death a house change follows, an arranged marriage's first child", () => {
  const state = town(17_100, [record("h-9101", 17_001, "person.died", head.id, { cause: "age", age: 49 }),
    { ...record("h-9102", 17_001, "house.succession", head.id), params: { deceasedId: head.id } } as HistoryRecord]);
  assert.equal(familyBeats(state).length, 0, "the house card tells it");
  const child = { ...family.find(person => person.role === "child")!, id: "m-900003", birthYear: 1300, motherId: spouse.id } as Person;
  const arranged = town(400, [record("h-9104", 300, "person.born", child.id, { motherId: spouse.id }),
    { ...record("h-9103", 300, "marriage.child_born", child.id), subject: { type: "town", id: "town" }, params: { child: child.id } } as unknown as HistoryRecord],
    [...start.persons!.people, child]);
  assert.equal(familyBeats(arranged).length, 0, "the moment's chip tells it");
});

test("outside the lord's family: none", () => {
  const other = start.persons!.people.find(person => !person.tags.includes("lord-family"))!;
  assert.equal(familyBeats(town(2_400, [record("h-9201", 2_001, "person.died", other.id, { cause: "age", age: 60 })])).length, 0);
});

test("the particle by the last syllable: 이/가, 을/를, 은/는, 과/와, 으로/로 (ㄹ takes 로)", () => {
  assert.deepEqual(["교회", "목책", "윌리엄", "로저"].map(word => withParticle(word, "이/가")), ["교회가", "목책이", "윌리엄이", "로저가"]);
  assert.equal(particle("집", "을/를"), "을");
  assert.equal(particle("마을", "으로/로"), "로");
  assert.equal(particle("성채", "은/는"), "는");
  assert.equal(particle("월터", "과/와"), "와");
  assert.equal(particle("Walter", "이/가"), "가", "not a Hangul syllable: the vowel form");
});
