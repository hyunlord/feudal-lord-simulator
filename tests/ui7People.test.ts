import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TRAIT_POPULATION, type PersonTraits, type TraitKey } from "../src/content/personTraits";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { ageOf, currentYear } from "../src/engine/persons";
import { persons } from "../src/engine/personsApi";
import type { Person } from "../src/engine/persons.types";
import { PORTRAIT_MIN_AGE } from "../src/engine/portraits";
import { decodeSave } from "../src/save/saveCodec";
import { BiographyPage } from "../src/ui/chronicle/BiographyPage";
import { biographyView, recordCard } from "../src/ui/chronicle/chronicleScreenModel";
import { personCardView, personRow } from "../src/ui/persons/personModels";
import { PersonCardModal, PersonChip } from "../src/ui/persons/PersonViews";
import { personStatesReader } from "../src/ui/persons/personStates";
import { PERSON_TRAIT_COPY } from "../src/ui/persons/personTraitCopy.ko";
import { distinctiveShared, resemblanceParts } from "../src/ui/persons/resemblance";
import { portraitUrl } from "../src/ui/portraitArt";

// UI-7 people: the biography's 닮은 점 (one trait per parent, the rarest value first), the young children's faces, the
// passing states' ledger sentences and the lord's family beside the steward — on the v17 fixture town.

const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v17/population-176.save.json"))).envelope.state as GameState;
const withPeople = (state: GameState, people: readonly Person[]): GameState => {
  const ids = new Set(people.map(person => person.id));
  return { ...state, persons: { ...state.persons!, people: [...state.persons!.people.filter(person => !ids.has(person.id)), ...people] } };
};

const BROWN: PersonTraits = { hair: "brown", skin: 3, eye: "brown", faceShape: "round", nose: "straight", buildBias: "average" };
/** A house's head (the father), spouse (the mother) and a child of theirs, with traits set for the test. */
function family(child: Partial<PersonTraits>, father: Partial<PersonTraits>, mother: Partial<PersonTraits>) {
  const house = town.houses.find(entry => { const members = persons.of(town, entry.buildingId);
    return members.some(member => member.role === "head") && members.some(member => member.role === "spouse") && members.some(member => member.role === "child"); })!;
  const members = persons.of(town, house.buildingId);
  const dad: Person = { ...members.find(member => member.role === "head")!, sex: "male", traits: { ...BROWN, skin: 0, eye: "blue", ...father } };
  const mum: Person = { ...members.find(member => member.role === "spouse")!, sex: "female", traits: { ...BROWN, skin: 7, eye: "grey", nose: "snub", ...mother } };
  const kid: Person = { ...members.find(member => member.role === "child")!, fatherId: dad.id, motherId: mum.id,
    traits: { ...BROWN, skin: 4, eye: "green", faceShape: "long", nose: "bulbous", buildBias: "thin", hair: "black", ...child } };
  return { state: withPeople(town, [dad, mum, kid]), dad, mum, kid };
}

test("UI-7 닮은 점: the rarest shared value first, one trait per parent, the father's first", () => {
  // The child shares red hair (4 %) and an average build (50 %) with the father, the hooked nose (18 %) with the mother.
  const { state, kid, dad } = family({ hair: "red", buildBias: "average", nose: "hooked" }, { hair: "red", buildBias: "average" }, { nose: "hooked" });
  assert.deepEqual(distinctiveShared(state, kid, dad.id), ["hair", "buildBias"]);
  assert.deepEqual(resemblanceParts(state, kid).map(part => [part.parent, part.trait, part.value]), [["father", "hair", "red"], ["mother", "nose", "hooked"]]);
  const view = biographyView(state, kid.id)!;
  assert.equal(view.resemblance, "닮은 점: 아버지의 붉은 머리, 어머니의 매부리코");
  const page = renderToStaticMarkup(createElement(BiographyPage, { view, scale: 1, onPerson: () => undefined, onRecord: () => undefined }));
  assert.match(page, /<header class="chronicle-biography-header"[^>]*>.*<p class="chronicle-biography-resemblance">닮은 점: 아버지의 붉은 머리, 어머니의 매부리코<\/p><\/header>/,
    "the last line of the header slot");
});

test("UI-7 닮은 점: the mother's is another trait than the father's; nothing shared or no parents known — no line", () => {
  // Both parents have the child's hooked nose; the mother also its green eyes: the father's nose, the mother's eyes.
  const both = family({ nose: "hooked", eye: "green" }, { nose: "hooked" }, { nose: "hooked", eye: "green" });
  assert.equal(biographyView(both.state, both.kid.id)!.resemblance, "닮은 점: 아버지의 매부리코, 어머니의 초록 눈");
  // The mother shares only the nose already named: the father's alone.
  const one = family({ nose: "hooked" }, { nose: "hooked" }, { nose: "hooked" });
  assert.equal(biographyView(one.state, one.kid.id)!.resemblance, "닮은 점: 아버지의 매부리코");
  // Skin within one step is shared (LN-11); the child's own value is named.
  const skin = family({ skin: 1 }, { skin: 0 }, {});
  assert.equal(biographyView(skin.state, skin.kid.id)!.resemblance, `닮은 점: 아버지의 ${PERSON_TRAIT_COPY.trait("skin", 1)}`);
  const none = family({}, { hair: "blond", faceShape: "square", nose: "hooked", buildBias: "heavy" }, { hair: "flaxen", faceShape: "pointed", buildBias: "heavy" });
  assert.deepEqual(persons.resemblance(none.state, none.kid.id, none.dad.id), []);
  assert.equal(biographyView(none.state, none.kid.id)!.resemblance, null);
  const { fatherId: _father, motherId: _mother, ...orphan } = none.kid;
  const view = biographyView(withPeople(none.state, [orphan]), orphan.id)!;
  assert.equal(view.resemblance, null);
  assert.doesNotMatch(renderToStaticMarkup(createElement(BiographyPage, { view, scale: 1, onPerson: () => undefined, onRecord: () => undefined })), /chronicle-biography-resemblance/);
});

test("UI-7 닮은 점 copy: every value of every trait has a Korean word", () => {
  for (const [trait, weights] of Object.entries(TRAIT_POPULATION)) for (const [value] of weights) {
    const word = PERSON_TRAIT_COPY.trait(trait as TraitKey, value);
    assert.match(word, /[가-힣]/, `${trait} ${value}: ${word}`);
  }
});

test("UI-7 young faces: a baby, a toddler and a small child wear the pool's face on the chip, the card, the biography and the record card", () => {
  const year = currentYear(town);
  const young = town.persons!.people.filter(person => ageOf(person, year) < PORTRAIT_MIN_AGE);
  assert.ok(young.length >= 10 && young.some(person => ageOf(person, year) < 3), `${young.length} under 8`);
  const states = personStatesReader(town);
  for (const person of young) {
    const portraitId = persons.portrait(town, person).portraitId;
    assert.ok(!portraitId.startsWith("silhouette_"), `${person.id} ${portraitId}`);
    assert.match(portraitUrl(portraitId, 96) ?? "", /\/assets\/portraits\/96\/.+\.jpg$/, portraitId);
    const row = personRow(town, person, states);
    assert.equal(row.portraitId, portraitId);
    assert.match(renderToStaticMarkup(createElement(PersonChip, { row, onOpen: () => undefined })), new RegExp(`data-portrait="${portraitId}"[^>]*>.*assets/portraits/96/${portraitId}\\.jpg`));
  }
  const baby = young.find(person => ageOf(person, year) < 3)!;
  const card = personCardView(town, baby.id)!;
  assert.match(renderToStaticMarkup(createElement(PersonCardModal, { view: card, onClose: () => undefined, onBiography: () => undefined })), new RegExp(`assets/portraits/256/${card.portraitId}\\.jpg`), "the card's 117 px slot draws the 256 px face");
  // The match line names the young stage (it wrote none for a baby or a toddler).
  assert.match(card.match, / 아기 · /);
  const toddler = young.find(person => persons.portrait(town, person).stage === "toddler")!;
  assert.match(personCardView(town, toddler.id)!.match, / 유아 · /);
  const biography = biographyView(town, baby.id)!;
  assert.match(biography.portraitLine, / 아기 · /);
  assert.match(renderToStaticMarkup(createElement(BiographyPage, { view: biography, scale: 1, onPerson: () => undefined, onRecord: () => undefined })),
    new RegExp(`assets/portraits/256/${biography.portraitId}\\.jpg`), "the great circle draws the 256 px face");
  // A parent's biography shows the baby's face among the relations.
  const parent = persons.of(town, baby.householdId).find(member => member.role === "head")!;
  assert.equal(biographyView(town, parent.id)!.relations.find(relation => relation.id === baby.id)!.portraitId, card.portraitId);
  // The birth's record card is the baby's face at birth.
  const born: HistoryRecord = { id: "h-ui7-born", tick: town.tick, kind: "person", template: "person.born", severity: 0, subject: { type: "person", id: baby.id } };
  const art = recordCard(town, { key: born.id, tick: born.tick, record: born, bundle: null }).art;
  assert.equal(art?.kind, "portrait");
  assert.ok(art?.kind === "portrait" && !art.portraitId.startsWith("silhouette_") && portraitUrl(art.portraitId, 96) !== null);
});
