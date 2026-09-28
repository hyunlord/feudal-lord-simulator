import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { setPresentationPreference } from "../src/render/presentationPreferences";
import { decodeSave } from "../src/save/saveCodec";
import { BiographyPage } from "../src/ui/chronicle/BiographyPage";
import { biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { PersonCardModal } from "../src/ui/persons/PersonViews";
import { personCardView } from "../src/ui/persons/personModels";

// UI-7b: a commoner's biography and card cover their printed shield (and the biography its small circle); the lord's
// family show their house's arms in the shield; the small circle never holds a family member; how the portrait was
// chosen shows only with the developer display.
let town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
for (let tick = 0; tick < 30; tick += 1) town = advanceTick(town);
const baby = town.persons!.people.find(person => person.motherId !== undefined && person.householdId !== "manor" && person.classBand !== "merchant")!;
const lord = town.persons!.people.find(person => person.tags.includes("lord-family") && person.role === "head")!;
const page = (id: string) => renderToStaticMarkup(createElement(BiographyPage, { view: biographyView(town, id)!, scale: 1, onPerson: () => undefined, onRecord: () => undefined }));
const card = (id: string) => renderToStaticMarkup(createElement(PersonCardModal, { view: personCardView(town, id)!, onClose: () => undefined, onBiography: () => undefined }));

test("a commoner's biography covers the empty shield and small circle, and puts no parent in the circle", () => {
  const html = page(baby.id);
  assert.match(html, /chronicle-biography-cover--arms/);
  assert.match(html, /chronicle-biography-cover--mark/);
  assert.equal(html.includes("chronicle-biography-companion"), false);
  assert.equal(html.includes("chronicle-biography-caption"), false);
});

test("the lord's biography shows the house's arms in the shield and covers the small circle", () => {
  const html = page(lord.id);
  assert.match(html, /chronicle-biography-arms/);
  assert.equal(html.includes("chronicle-biography-cover--arms"), false);
  assert.match(html, /chronicle-biography-cover--mark/);
});

test("the person card covers a commoner's shield; the portrait's match line only with the developer display", () => {
  assert.match(card(baby.id), /person-card-emblem-cover/);
  assert.equal(card(lord.id).includes("person-card-emblem-cover"), false);
  assert.equal(page(baby.id).includes("chronicle-biography-match"), false);
  assert.equal(card(baby.id).includes("person-card-match"), false);
  setPresentationPreference("developerInfo", true);
  try {
    assert.match(page(baby.id), /chronicle-biography-match/);
    assert.match(card(baby.id), /person-card-match/);
  } finally {
    setPresentationPreference("developerInfo", false);
  }
});
