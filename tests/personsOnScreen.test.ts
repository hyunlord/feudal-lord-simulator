import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import { persons } from "../src/engine/personsApi";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { decodeSave } from "../src/save/saveCodec";
import { armsKey, armsRecipe, COLOURS, merchantKey, merchantRecipe, METALS } from "../src/ui/heraldry/heraldry";
import { householdRows, personCardView, personEmblem, petitionerRows, portraitMatchRate, stewardPerson, walkerHeadline, walkerPerson } from "../src/ui/persons/personModels";
import { PERSONS_COPY } from "../src/ui/persons/personsCopy.ko";
import { walkerLook } from "../src/render/walkerLook";
import { biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { PersonCardModal } from "../src/ui/persons/PersonViews";
import { portraitUrl, STEWARD_PORTRAIT } from "../src/ui/portraitArt";
import { Inspector } from "../src/ui/InspectorView";
import { DiagnosticCard } from "../src/render/DiagnosticCard";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import { PetitionModal } from "../src/ui/hud/StoryModals";
import { INITIAL_UI_STATE, reduceUi, timeStopped, topModal } from "../src/ui/stateMachine/uiStateMachine";
import { WAVE14_IMAGES } from "../src/ui/wave14ArtManifest.generated";
import { petitionPresentation } from "../src/ui/petitionPresentation";

// UI-5 people on screen, on the v17 fixtures' towns (PERSON-0 persons): the rows, the card, the steward, the walker's
// person and line, the arms and marks (the same seed, the same emblem), and how many portraits match.

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v17/${name}.save.json`))).envelope.state as GameState;
const town = load("population-176");
const big = load("palisade-construction");

test("UI-5 a house's members: head, spouse, kin, children with name, age, role and a pool portrait; the steward is the pool's steward", () => {
  const house = town.houses.find(entry => persons.of(town, entry.buildingId).length >= 3)!;
  const rows = householdRows(town, house.buildingId);
  assert.ok(rows.length >= 3);
  assert.match(rows[0]!.line, /^가구주 · \d+살/);
  assert.ok(rows.every(row => portraitUrl(row.portraitId, 96) !== null), "every member drawn from the installed pool");
  const steward = stewardPerson(town)!;
  assert.equal(steward.householdId, MANOR_HOUSEHOLD);
  assert.equal(persons.portrait(town, steward).identityId, "I037", "the pool's steward, a fixed person");
  const card = personCardView(town, steward.id)!;
  assert.equal(card.role, "청지기", "no trade repeated after the role");
  assert.equal(card.household, "영주의 집안");
  assert.equal(card.emblem?.kind, "arms");
  assert.deepEqual([card.portraitId, card.exact], [STEWARD_PORTRAIT.neutral, true]);
  // The chronicle draws the same face, and names the office once ("청지기", not "청지기 · 청지기").
  const biography = biographyView(town, steward.id)!;
  assert.deepEqual([biography.portraitId, biography.role, biography.portraitLine], [STEWARD_PORTRAIT.neutral, "청지기", PERSONS_COPY.stewardPortrait]);
  assert.equal(portraitUrl(card.portraitId, 96), "/assets/ui-p0/portraits/advisor_steward_portrait_neutral-96.png");
  const markup = renderToStaticMarkup(createElement(Inspector, { state: town, buildingId: house.buildingId, onClose: () => undefined, onPerson: () => undefined }));
  assert.match(markup, new RegExp(PERSONS_COPY.membersHeading));
  // The first four (head first) and the rest behind the toggle; five or fewer all at once.
  const shown = rows.length <= 5 ? rows : rows.slice(0, 4);
  for (const row of shown) assert.match(markup, new RegExp(`data-person="${row.id}"`));
  // The map's house card (a click on the house) lists them too.
  const card2 = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, model: { kind: "house", value: houseDiagnosisModel(town, house.buildingId)! },
    houseMembers: rows, onPerson: () => undefined }));
  assert.match(card2, /class="inspector-members"/);
  assert.deepEqual([...card2.matchAll(/data-person="(p-\d+)"/g)].map(match => match[1]), shown.map(row => row.id));
  const crowdedHouse = town.houses.find(entry => householdRows(town, entry.buildingId).length > 5)!;
  const crowded = householdRows(town, crowdedHouse.buildingId);
  const long = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, model: { kind: "house", value: houseDiagnosisModel(town, crowdedHouse.buildingId)! },
    houseMembers: crowded, onPerson: () => undefined }));
  assert.equal([...long.matchAll(/class="person-chip[ "]/g)].length, 4);
  assert.match(long, new RegExp(PERSONS_COPY.membersAll(crowded.length)));
});

test("UI-5 petitioners: the petition's two or three heads by name (PERSON-0 PS-4)", () => {
  const heads = town.persons!.people.filter(person => person.role === "head").slice(0, 3);
  const rows = petitionerRows(town, { petitionerIds: heads.map(person => person.id) });
  assert.deepEqual(rows.map(row => row.id), heads.map(person => person.id));
  assert.deepEqual(petitionerRows(town, {}), []);
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view: { petitionId: "market_rights@1", options: [],
    presentation: petitionPresentation(town, { id: "market_rights@1", defId: "market_charter", petitioner: "merchants", arrivedTick: town.tick }) }, onRespond: () => undefined,
    onLater: () => undefined, petitioners: rows, onPerson: () => undefined }));
  assert.match(markup, new RegExp(PERSONS_COPY.petitionersHeading));
  for (const row of rows) assert.match(markup, new RegExp(`data-person="${row.id}"`));
});

test("UI-5 a walker: the same walker is always the same person, and its card says verb + what + where + progress", () => {
  const carter = town.walkers.find(walker => walker.kind === "carter")!;
  assert.equal(walkerPerson(town, carter)?.id, walkerPerson(town, carter)?.id);
  const walkers = [town, big].flatMap(state => state.walkers.filter(entry => entry.kind !== "builder").map(walker => [state, walker] as const));
  assert.ok(walkers.length >= 5, `${walkers.length} walkers`);
  for (const [state, walker] of walkers) assert.equal(walkerPerson(state, walker)?.sex, walkerLook(state, walker).sex, "the portrait is the figure's sex");
  const headline = walkerHeadline(town, carter.id)!;
  assert.ok(headline.name !== null && headline.portraitId !== null);
  assert.match(headline.line, /(나르는 중|돌아가는 중)/);
  assert.equal(PERSONS_COPY.carrying("목재", "방앗간 공사장"), "목재를 방앗간 공사장으로 나르는 중");
  assert.equal(PERSONS_COPY.carrying("빵", "마을"), "빵을 마을로 나르는 중", "로 after ㄹ");
  assert.equal(PERSONS_COPY.progress(PERSONS_COPY.carrying("목재", "방앗간 공사장"), 12, 20), "목재를 방앗간 공사장으로 나르는 중 · 12/20");
});

test("UI-5 arms and marks: the same seed gives the same emblem, another seed another; the rule of tincture holds", () => {
  assert.equal(armsKey(armsRecipe(town.seed, MANOR_HOUSEHOLD)), armsKey(armsRecipe(town.seed, MANOR_HOUSEHOLD)));
  const keys = new Set(Array.from({ length: 60 }, (_, seed) => armsKey(armsRecipe(seed, MANOR_HOUSEHOLD))));
  assert.ok(keys.size >= 40, `${keys.size} different arms in 60 seeds`);
  for (let seed = 0; seed < 200; seed += 1) {
    const arms = armsRecipe(seed, MANOR_HOUSEHOLD);
    assert.ok((COLOURS as readonly string[]).includes(arms.field), "a colour field");
    if (arms.partition !== null) assert.ok((COLOURS as readonly string[]).includes(arms.partition.tincture) && arms.partition.tincture !== arms.field);
    if (arms.ordinary !== null) assert.ok((METALS as readonly string[]).includes(arms.ordinary.tincture), "metal on colour");
    if (arms.charge !== null) assert.ok((METALS as readonly string[]).includes(arms.charge.tincture), "metal on colour");
    for (const id of [`shield_${arms.shield}`, arms.partition && `partition_${arms.partition.id}`, arms.ordinary && `ordinary_${arms.ordinary.id}`,
      arms.charge && `charge_${arms.charge.id}`]) if (id) assert.ok(id in WAVE14_IMAGES, id);
  }
  assert.equal(merchantKey(merchantRecipe(5, "house-1")), merchantKey(merchantRecipe(5, "house-1")));
  assert.notEqual(merchantKey(merchantRecipe(5, "house-1")), merchantKey(merchantRecipe(5, "house-2-long-id")), "(a different house here)");
  const merchant = big.persons!.people.find(person => person.classBand === "merchant");
  if (merchant !== undefined) assert.equal(personEmblem(big, merchant)?.kind, "merchant");
});

test("UI-5 the person card: a modal (time stops) with the Wave 14 frame, the portrait, the emblem and how the portrait matches", () => {
  const steward = stewardPerson(town)!;
  const markup = renderToStaticMarkup(createElement(PersonCardModal, { view: personCardView(town, steward.id)!, onClose: () => undefined, onBiography: () => undefined }));
  assert.match(markup, /frame_person_card-v1\.png/);
  assert.match(markup, /data-portrait="steward_neutral"/, "the steward's fixed portrait (the P0 steward), not the pool's I037");
  assert.match(markup, /data-emblem-kind="arms"/);
  // UI-7b: how the portrait was chosen is a developer display (off by default).
  assert.equal(markup.includes("초상 청지기 고정 인물"), false);
  assert.match(markup, /전기 보기/);
  const ui = reduceUi({ ...INITIAL_UI_STATE, mode: "selection" }, { type: "push_modal", modal: "person_card" });
  assert.deepEqual([topModal(ui), timeStopped(ui), reduceUi(ui, { type: "escape" }).mode], ["person_card", true, "selection"]);
});

test("UI-5 gate ②: at least 95 % of the living have an exactly matching portrait (sex, age band, class)", () => {
  for (const state of [town, big]) {
    const rate = portraitMatchRate(state);
    assert.ok(rate.percent >= 95, JSON.stringify(rate));
  }
});
