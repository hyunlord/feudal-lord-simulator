import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { persons } from "../src/engine/personsApi";
import type { Person } from "../src/engine/persons.types";
import { decodeSave } from "../src/save/saveCodec";
import { BiographyPage } from "../src/ui/chronicle/BiographyPage";
import { biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { householdRows, personCardView, personRow } from "../src/ui/persons/personModels";
import { PersonCardModal, PersonChip } from "../src/ui/persons/PersonViews";
import { PERSON_STATE_COPY } from "../src/ui/persons/personStateCopy.ko";
import {
  derivedPersonStates, PERSON_STATE_WINDOW_TICKS, PERSON_STATES, personOrnament, personStateOrnamentStyle, topPersonState,
} from "../src/ui/persons/personStates";
import { WAVE23_IMAGES } from "../src/render/wave23ArtManifest.generated";

// INSTALL-23 ④ person-state ornaments: each derivable state from a constructed state (the v17 fixture town with ledger
// records, a food shortage, an office), child_born on both parents for one season and gone after, the dead greyscale,
// the priority order, and the markup of a chip, a card and a biography with the ornament. UI-7: the passing states
// (persons.condition) and the bailiff's tag, derived like the rest.

const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v17/population-176.save.json"))).envelope.state as GameState;
const SEASON = PERSON_STATE_WINDOW_TICKS;

/** A household with a head, a spouse and at least one other member. */
const family = (() => {
  const house = town.houses.find(entry => { const members = persons.of(town, entry.buildingId);
    return members.some(member => member.role === "head") && members.some(member => member.role === "spouse") && members.length >= 3; })!;
  const members = persons.of(town, house.buildingId);
  return { house: house.buildingId, head: members.find(member => member.role === "head")!, spouse: members.find(member => member.role === "spouse")!,
    other: members.find(member => member.role !== "head" && member.role !== "spouse")! };
})();

let ordinal = 1;
const record = (template: string, subject: string, household: string, tick: number): HistoryRecord => ({
  id: `h-test-${ordinal++}`, tick, kind: "person", template, severity: template === "person.died" ? 1 : 0,
  subject: { type: "person", id: subject }, actors: [{ type: "household", id: household }],
});
const withRecords = (state: GameState, records: readonly HistoryRecord[], tick = state.tick): GameState => ({
  ...state, tick, history: { records, snapshots: [], nextOrdinal: records.length + 1, seasonDecisions: {}, milestones: [], pendingActuals: [] },
});
const livingNow = (state: GameState, id: string) => state.persons!.people.find(person => person.id === id)!;

test("INSTALL-23 dead: a person who died wears the candle and nothing else; their portrait is greyscale on the card and the biography", () => {
  const person = family.other;
  const dead: Person = { ...person, alive: false, deathYear: 1320, deathCause: "famine" };
  const state: GameState = { ...town, persons: { ...town.persons!, people: town.persons!.people.filter(entry => entry.id !== person.id), past: [dead] } };
  assert.deepEqual(derivedPersonStates(state, dead), ["dead"]);
  const card = personCardView(state, person.id)!;
  assert.equal(card.ornament, "dead");
  const markup = renderToStaticMarkup(createElement(PersonCardModal, { view: card, onClose: () => undefined, onBiography: () => undefined }));
  assert.match(markup, /class="person-portrait person-portrait--dead/);
  assert.match(markup, /data-ornament="dead"/);
  assert.match(markup, new RegExp(PERSON_STATE_COPY.cardLine(PERSON_STATE_COPY.label("dead"))));
  const biography = biographyView(state, person.id)!;
  assert.equal(biography.ornament, "dead");
  const page = renderToStaticMarkup(createElement(BiographyPage, { view: biography, scale: 1, onPerson: () => undefined, onRecord: () => undefined }));
  assert.match(page, /class="chronicle-biography-portrait portrait-greyscale"/, "the face greyscale");
  assert.match(page, /class="chronicle-biography-ornament person-state-ornament"[^>]*data-ornament="dead"/, "the candle a sibling layer (not greyed)");
  assert.match(page, new RegExp(`aria-label="${PERSON_STATE_COPY.withState(biography.portraitLine, PERSON_STATE_COPY.label("dead"))}"`));
});

test("INSTALL-23 hunger: every member of a house short of food (the engine's FP-3 foodShortSinceTick); not once it has left", () => {
  const short: GameState = { ...town, houses: town.houses.map(house => house.buildingId === family.house ? { ...house, foodShortSinceTick: town.tick - 10 } : house) };
  for (const member of persons.of(short, family.house)) assert.ok(derivedPersonStates(short, member).includes("hunger"), member.id);
  assert.ok(householdRows(short, family.house).every(row => row.ornament === "hunger"));
  const neighbour = town.persons!.people.find(person => person.householdId !== family.house && person.role === "head")!;
  assert.ok(!derivedPersonStates(short, neighbour).includes("hunger"));
  const left: GameState = { ...short, houses: short.houses.map(house => house.buildingId === family.house ? { ...house, abandonedTick: town.tick } : house) };
  assert.ok(!derivedPersonStates(left, family.head).includes("hunger"));
});

test("INSTALL-23 mourning: a death in the household within one season (the ledger's person.died), for the others only", () => {
  const dead: Person = { ...family.other, alive: false, deathYear: 1320, deathCause: "age" };
  const base: GameState = { ...town, persons: { ...town.persons!, people: town.persons!.people.filter(entry => entry.id !== dead.id), past: [dead] } };
  const died = record("person.died", dead.id, family.house, town.tick - 100);
  const state = withRecords(base, [died]);
  assert.deepEqual(derivedPersonStates(state, livingNow(state, family.head.id)), ["mourning"]);
  assert.deepEqual(derivedPersonStates(state, livingNow(state, family.spouse.id)), ["mourning"]);
  const neighbour = state.persons!.people.find(person => person.householdId !== family.house)!;
  assert.deepEqual(derivedPersonStates(state, neighbour), []);
  assert.deepEqual(derivedPersonStates(withRecords(base, [died], died.tick + SEASON - 1), family.head), ["mourning"], "the last tick of the season");
  assert.deepEqual(derivedPersonStates(withRecords(base, [died], died.tick + SEASON), family.head), [], "a season on: gone");
});

test("INSTALL-23 child_born: the child's parents (head and spouse) wear it for one season; the child and the rest do not", () => {
  const child: Person = { ...family.other, id: "p-newborn", role: "child", birthYear: 1320, occupation: "child", tags: [] };
  const base: GameState = { ...town, persons: { ...town.persons!, people: [...town.persons!.people, child] } };
  const born = record("person.born", child.id, family.house, town.tick);
  const now = withRecords(base, [born]);
  assert.deepEqual(derivedPersonStates(now, family.head), ["child_born"]);
  assert.deepEqual(derivedPersonStates(now, family.spouse), ["child_born"]);
  assert.deepEqual(derivedPersonStates(now, child), [], "the child itself does not wear it");
  if (family.other.role !== "head" && family.other.role !== "spouse") assert.deepEqual(derivedPersonStates(now, family.other), []);
  const rows = householdRows(now, family.house);
  assert.equal(rows.find(row => row.id === family.head.id)!.ornament, "child_born");
  assert.equal(rows.find(row => row.id === family.spouse.id)!.ornament, "child_born");
  assert.equal(personOrnament(withRecords(base, [born], born.tick + SEASON - 1), family.spouse), "child_born", "still within the season");
  const later = withRecords(base, [born], born.tick + SEASON);
  assert.equal(personOrnament(later, family.head), null, "a season on: gone from the head");
  assert.equal(personOrnament(later, family.spouse), null, "and from the spouse");
});

test("INSTALL-23 marriage: the spouse who joined and the head of that household, for one season", () => {
  const married = record("person.married", family.spouse.id, family.house, town.tick - 5);
  const state = withRecords(town, [married]);
  assert.deepEqual(derivedPersonStates(state, family.spouse), ["marriage"]);
  assert.deepEqual(derivedPersonStates(state, family.head), ["marriage"]);
  assert.deepEqual(derivedPersonStates(withRecords(town, [married], married.tick + SEASON), family.spouse), []);
});

test("INSTALL-23 offices: the steward by role, the reeve by tag; UI-7: the bailiff by its tag", () => {
  const steward = town.persons!.people.find(person => person.role === "steward")!;
  assert.deepEqual(derivedPersonStates(town, steward), ["steward"]);
  const reeve: Person = { ...family.head, tags: [...family.head.tags, "reeve"] };
  const state: GameState = { ...town, persons: { ...town.persons!, people: town.persons!.people.map(person => person.id === reeve.id ? reeve : person) } };
  assert.deepEqual(derivedPersonStates(state, reeve), ["reeve"]);
  const bailiff: Person = { ...family.spouse, tags: [...family.spouse.tags, "bailiff"] };
  assert.deepEqual(derivedPersonStates(town, bailiff), ["bailiff"]);
  assert.equal(PERSON_STATE_COPY.label("bailiff"), "집행관", "UI-7: the office in Korean only");
  assert.deepEqual(derivedPersonStates(town, { ...bailiff, tags: [...bailiff.tags, "reeve"] }), ["bailiff", "reeve"], "the lord's office before the town's");
});

test("UI-7 passing states: sick, injury, pregnant and pilgrim from persons.condition, while it lasts", () => {
  for (const kind of ["sick", "injury", "pregnant", "pilgrim"] as const) {
    const person: Person = { ...family.other, condition: { kind, since: town.tick - 10, until: town.tick + 10 } };
    assert.deepEqual(derivedPersonStates(town, person), [kind], kind);
    assert.deepEqual(derivedPersonStates({ ...town, tick: town.tick + 10 }, person), [], `${kind}: over at its tick`);
  }
  // Nothing is derived without the engine's data: the fixture town's people wear none of the five.
  const derived = new Set(town.persons!.people.filter(person => person.condition === undefined && !person.tags.includes("bailiff"))
    .flatMap(person => derivedPersonStates(town, person)));
  for (const id of ["sick", "injury", "pregnant", "pilgrim", "bailiff"] as const) assert.ok(!derived.has(id), id);
  // The card and the chip wear it and say it.
  const pilgrim: Person = { ...family.head, condition: { kind: "pilgrim", since: town.tick, until: town.tick + SEASON } };
  const state: GameState = { ...town, persons: { ...town.persons!, people: town.persons!.people.map(person => person.id === pilgrim.id ? pilgrim : person) } };
  assert.equal(personCardView(state, pilgrim.id)!.ornament, "pilgrim");
  const markup = renderToStaticMarkup(createElement(PersonChip, { row: personRow(state, pilgrim), onOpen: () => undefined }));
  assert.match(markup, /data-ornament="pilgrim"/);
  assert.match(markup, new RegExp(`<span class="person-chip-state" data-person-state="pilgrim">${PERSON_STATE_COPY.label("pilgrim")}</span>`));
});

test("UI-7 priority with the passing states: sick over mourning, a hungry pilgrim shows hunger, pregnant after child_born", () => {
  assert.equal(topPersonState(["mourning", "sick"]), "sick");
  assert.equal(topPersonState(["pilgrim", "hunger"]), "hunger");
  assert.equal(topPersonState(["pregnant", "child_born"]), "child_born");
  assert.equal(topPersonState(["reeve", "bailiff", "pilgrim"]), "pilgrim");
  const sick: Person = { ...family.head, tags: [...family.head.tags, "bailiff"], condition: { kind: "sick", since: town.tick, until: town.tick + SEASON } };
  const short: GameState = { ...town, houses: town.houses.map(house => house.buildingId === family.house ? { ...house, foodShortSinceTick: town.tick } : house) };
  assert.deepEqual(derivedPersonStates(short, sick), ["hunger", "sick", "bailiff"]);
  assert.equal(personOrnament(town, sick), "sick");
});

test("INSTALL-23 one ornament per portrait: the priority order", () => {
  assert.deepEqual([...PERSON_STATES], ["dead", "hunger", "sick", "injury", "mourning", "child_born", "pregnant", "marriage", "pilgrim", "steward", "bailiff", "reeve"]);
  assert.equal(topPersonState(["reeve", "hunger", "mourning"]), "hunger");
  assert.equal(topPersonState(["child_born", "mourning"]), "mourning", "grief before joy");
  assert.equal(topPersonState(["reeve", "marriage"]), "marriage", "the season's event before the lasting office");
  assert.equal(topPersonState([]), null);
  // A hungry reeve who just had a child: hunger shows.
  const reeve: Person = { ...family.head, tags: [...family.head.tags, "reeve"] };
  const child: Person = { ...family.other, id: "p-newborn", role: "child", birthYear: 1320, tags: [] };
  const state = withRecords({ ...town, houses: town.houses.map(house => house.buildingId === family.house ? { ...house, foodShortSinceTick: town.tick } : house),
    persons: { ...town.persons!, people: [...town.persons!.people.map(person => person.id === reeve.id ? reeve : person), child] } },
  [record("person.born", child.id, family.house, town.tick)]);
  assert.deepEqual(derivedPersonStates(state, reeve), ["hunger", "child_born", "reeve"]);
  assert.equal(personOrnament(state, reeve), "hunger");
});

test("INSTALL-23 the chip's markup: the 48 px ornament (96 at 2x) at the frame's bottom-right layer, the state in words and in the button's name", () => {
  const child: Person = { ...family.other, id: "p-newborn", role: "child", birthYear: 1320, tags: [] };
  const state = withRecords({ ...town, persons: { ...town.persons!, people: [...town.persons!.people, child] } }, [record("person.born", child.id, family.house, town.tick)]);
  const row = personRow(state, family.head);
  assert.equal(row.ornament, "child_born");
  const markup = renderToStaticMarkup(createElement(PersonChip, { row, onOpen: () => undefined }));
  const label = PERSON_STATE_COPY.label("child_born");
  assert.match(markup, new RegExp(`aria-label="${PERSON_STATE_COPY.openCard(row.name, label)}"`));
  assert.match(markup, /<span class="person-state-ornament" data-ornament="child_born"/);
  assert.ok(markup.includes(`/${WAVE23_IMAGES.child_born_48.url}`) && markup.includes(`/${WAVE23_IMAGES.child_born_96.url}`), "image-set 48 1x, 96 2x");
  assert.match(markup, new RegExp(`<span class="person-chip-state" data-person-state="child_born">${label}</span>`));
  assert.doesNotMatch(markup, /person-portrait--dead/);
  // The card and biography draw the 96 px art.
  assert.match(String(personStateOrnamentStyle("child_born", 117).backgroundImage), /child_born_96\.png"\)$/);
  const card = renderToStaticMarkup(createElement(PersonCardModal, { view: personCardView(state, family.spouse.id)!, onClose: () => undefined, onBiography: () => undefined }));
  assert.match(card, /data-ornament="child_born"/);
  // No state, no ornament and the plain name.
  const plain = renderToStaticMarkup(createElement(PersonChip, { row: personRow(town, family.other), onOpen: () => undefined }));
  assert.doesNotMatch(plain, /person-state-ornament/);
});
