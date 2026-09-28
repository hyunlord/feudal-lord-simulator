/**
 * UI-8 (F3-A): ledger, chapter-end and family-tree parts of the Black Death chapter.
 * Covers: wage ledger model, chapter 3 copy, chronicle plague art mapping, actor/claim
 * source bug fix, and plague-death display in biography, person card and family tree.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { PlagueState } from "../src/engine/plague.types";
import { postLedgerEntries } from "../src/ledger/ledger";
import { CHAPTER_COPY } from "../src/ui/chapterCopy.ko";
import { chronicleIllustration } from "../src/ui/chronicleModel";
import { biographyView, recordArt } from "../src/ui/chronicle/chronicleScreenModel";
import { FAMILY_TREE_COPY } from "../src/ui/chronicle/familyTreeCopy.ko";
import { familyTreeView } from "../src/ui/chronicle/familyTreeModel";
import { ledgerSourcePresentation } from "../src/ui/ledgerPanelModel";
import { wageLedgerView } from "../src/ui/hud/wageLedgerModel";
import { personCardView } from "../src/ui/persons/personModels";
import { plagueTown, PLAGUE_ERA_TICK } from "./helpers/plagueTown";

// Shared base: the plague town, a commoner taken dead of plague, a state with plague tracking on.
const base = plagueTown();
const commoner = base.persons!.people.find(p => p.householdId !== "manor" && p.role !== "head")!;
const plagueDead = { ...commoner, alive: false, deathYear: 1348, deathCause: "plague" as const };
// Remove the commoner from people so personById finds the dead version in past, not the living one.
const stateWithDead: GameState = { ...base, persons: {
  ...base.persons!,
  people: base.persons!.people.filter(p => p.id !== commoner.id),
  past: [...base.persons!.past, plagueDead],
} };
const minimalPlague: PlagueState = { eraTick: PLAGUE_ERA_TICK, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 };
// A state with plague present and a wages + statute_fine entry in the recent ledger window.
// postLedgerEntries returns only {ledger, treasuryCoin}, so spread into the full state manually.
const ledgerResult = postLedgerEntries(
  { ...stateWithDead, plague: minimalPlague },
  [{ account: "cash", category: "wages", amount: 150, sourceRefs: [{ type: "actor", id: "labourers" }] },
   { account: "cash", category: "statute_fine", amount: 50, sourceRefs: [{ type: "actor", id: "labourers" }] }],
);
const stateWithPlague: GameState = { ...stateWithDead, plague: minimalPlague, ledger: ledgerResult.ledger, treasuryCoin: ledgerResult.treasuryCoin };

// ─── Chapter 3 copy ───────────────────────────────────────────────────────────

test("CHAPTER_COPY.titles[3] is the chapter 3 title in Korean", () => {
  assert.equal(CHAPTER_COPY.titles[3], "제3장 · 흑사병의 그늘");
});

test("CHAPTER_COPY.goals.resettled is defined for the chapter 3 recovery goal", () => {
  assert.ok(typeof CHAPTER_COPY.goals.resettled === "string", "resettled goal copy must exist");
  assert.ok(CHAPTER_COPY.goals.resettled.length > 0);
});

test("CHAPTER_COPY.resettledProgress shows the current permille as a percentage out of 70 %", () => {
  const label = CHAPTER_COPY.resettledProgress(350);
  assert.match(label, /35/);
  assert.match(label, /70/);
  const full = CHAPTER_COPY.resettledProgress(700);
  assert.match(full, /70 %/);
});

// ─── Wage ledger model ────────────────────────────────────────────────────────

test("wageLedgerView returns null when plague has not arrived", () => {
  assert.equal(wageLedgerView(base), null);
});

test("wageLedgerView returns a view when plague is present", () => {
  const view = wageLedgerView(stateWithPlague);
  assert.ok(view !== null, "expected a non-null wage ledger view");
  assert.equal(view.heading, "임금 장부 (3장)");
  assert.ok(view.rows.length > 0, "expected at least one row");
});

test("wageLedgerView includes all four plague categories as rows", () => {
  const view = wageLedgerView(stateWithPlague);
  assert.ok(view !== null);
  const cats = view.rows.map(r => r.category);
  assert.ok(cats.includes("wages"), "wages row missing");
  assert.ok(cats.includes("statute_fine"), "statute_fine row missing");
  assert.ok(cats.includes("church_fee"), "church_fee row missing");
  assert.ok(cats.includes("entry_fine"), "entry_fine row missing");
});

test("wageLedgerView shows the posted amount in the this-season column", () => {
  const view = wageLedgerView(stateWithPlague);
  assert.ok(view !== null);
  const wages = view.rows.find(r => r.category === "wages");
  assert.ok(wages !== undefined, "wages row must exist");
  assert.equal(wages.thisSeason, 150, "the posted wages amount should appear in the this-season column");
});

// ─── Chronicle plague art mapping ────────────────────────────────────────────

test("chronicleIllustration maps plague.arrived to the ch3 first-death art", () => {
  const art = chronicleIllustration({ template: "plague.arrived", params: {} });
  assert.equal(art, "ch3_chronicle_first_death");
});

test("chronicleIllustration maps plague.rumour and plague.priest_died to first-death art too", () => {
  assert.equal(chronicleIllustration({ template: "plague.rumour", params: {} }), "ch3_chronicle_first_death");
  assert.equal(chronicleIllustration({ template: "plague.priest_died", params: {} }), "ch3_chronicle_first_death");
});

test("chronicleIllustration maps plague.new_graves to the churchyard art", () => {
  assert.equal(chronicleIllustration({ template: "plague.new_graves", params: {} }), "ch3_chronicle_churchyard");
});

test("chronicleIllustration maps plague.empty_streets and plague.abandoned_fields to abandoned-fields art", () => {
  assert.equal(chronicleIllustration({ template: "plague.empty_streets", params: {} }), "ch3_chronicle_abandoned_fields");
  assert.equal(chronicleIllustration({ template: "plague.abandoned_fields", params: {} }), "ch3_chronicle_abandoned_fields");
});

test("chronicleIllustration maps plague.ordinance, .resettlement and second records to Wave21 art", () => {
  assert.equal(chronicleIllustration({ template: "plague.ordinance", params: {} }), "ch3_chronicle_ordinance");
  assert.equal(chronicleIllustration({ template: "plague.resettlement", params: {} }), "ch3_chronicle_resettlement");
  assert.equal(chronicleIllustration({ template: "plague.second", params: {} }), "ch3_chronicle_spring_recovery");
  assert.equal(chronicleIllustration({ template: "plague.second_ended", params: {} }), "ch3_chronicle_spring_recovery");
});

test("recordArt maps plague.arrived to wave21 kind for the chronicle screen", () => {
  const art = recordArt(stateWithPlague, { id: "r1", tick: base.tick, template: "plague.arrived", params: {} });
  assert.ok(art !== null, "recordArt must return art for plague.arrived");
  assert.equal(art!.kind, "wave21");
  assert.equal(art!.id, "ch3_chronicle_first_death");
});

// ─── Actor/claim ledger source bug fix ───────────────────────────────────────

const OPENING_BALANCE_LABEL = "이월 잔액";

test("ledgerSourcePresentation does not show the opening-balance label for an actor source", () => {
  const presentation = ledgerSourcePresentation(base, { type: "actor", id: "labourers" });
  assert.notEqual(presentation.label, OPENING_BALANCE_LABEL, "actor source must not show 이월 잔액");
  assert.ok(presentation.label.length > 0, "actor source must have a non-empty label");
});

test("ledgerSourcePresentation does not show the opening-balance label for a claim source", () => {
  // The original bug: claim and actor sources fell through to show "이월 잔액" (the opening_balance category label).
  // After the fix, claim sources show the rolledUp message instead — a different, non-misleading placeholder.
  const presentation = ledgerSourcePresentation(base, { type: "claim", id: "any-claim" });
  assert.notEqual(presentation.label, OPENING_BALANCE_LABEL, "claim source must not show 이월 잔액");
});

// ─── Plague death in biography ────────────────────────────────────────────────

test("biographyView exposes deathCause for a plague-dead person", () => {
  const view = biographyView(stateWithDead, plagueDead.id);
  assert.ok(view !== null, "biographyView must find the plague-dead person");
  assert.ok(view!.deathCause !== null, "deathCause must be non-null for a plague death");
  assert.match(view!.deathCause!, /역병/);
  assert.match(view!.deathCause!, /1348/);
});

test("biographyView deathCause is null for a living person", () => {
  const living = base.persons!.people.find(p => p.alive)!;
  const view = biographyView(base, living.id);
  assert.ok(view !== null, "biographyView must find a living person");
  assert.equal(view!.deathCause, null, "a living person has no deathCause");
});

// ─── Plague death in person card ─────────────────────────────────────────────

test("personCardView exposes deathCause for a plague-dead person", () => {
  const view = personCardView(stateWithDead, plagueDead.id);
  assert.ok(view !== null, "personCardView must find the plague-dead person");
  assert.ok(view!.deathCause !== null, "deathCause must be non-null for a plague death");
  assert.match(view!.deathCause!, /역병/);
  assert.match(view!.deathCause!, /1348/);
});

test("personCardView deathCause is null for a person who died of age", () => {
  // Move a living person to past with deathCause "age" — should not show plague copy.
  const ageDeadPerson = { ...commoner, id: "age-dead-test", alive: false, deathYear: 1340, deathCause: "age" as const };
  const stateWithAge: GameState = { ...base, persons: { ...base.persons!, past: [...base.persons!.past, ageDeadPerson] } };
  const view = personCardView(stateWithAge, ageDeadPerson.id);
  assert.ok(view !== null);
  assert.equal(view!.deathCause, null, "an age death must not show the plague cause line");
});

// ─── Plague death in family tree copy ────────────────────────────────────────

test("FAMILY_TREE_COPY.plagueDeath produces the expected Korean string with the year", () => {
  const label = FAMILY_TREE_COPY.plagueDeath(1348);
  assert.match(label, /역병/);
  assert.match(label, /1348/);
});

test("familyTreeView renders without error for a living person in a plague state", () => {
  const living = stateWithDead.persons!.people.find(p => p.alive && p.householdId !== "manor")!;
  const view = familyTreeView(stateWithDead, living.id);
  // The tree should render; it may be null if the person has no family links, but it must not throw.
  assert.ok(view === null || typeof view === "object");
});
