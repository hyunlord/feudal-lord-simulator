import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { initialRegistry } from "../src/engine/registry";
import type { RegistryOccurrence } from "../src/engine/registry.types";
import { bindEntry, boundIdentities, v4Entry } from "../src/engine/registryV4";
import { EMPTY_STEWARDSHIP } from "../src/engine/stewardship";
import type { EstatePetition, HomePetitionKind } from "../src/engine/stewardship.types";
import { initialAgency } from "../src/engine/townAgency";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { decisionPresentation, answerPresentationParams } from "../src/engine/decisionPresentation";
import { homePetitionView } from "../src/ui/lordCardsModel";
import { registryOfferView } from "../src/ui/registryCardModel";
const chapterTwo = (): GameState => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v49/chapter-two-town.save.json"))).envelope.state;
const homePetition = (id: string, kind: HomePetitionKind, amount: number, tick: number): EstatePetition =>
  ({ id, estateId: "estate-home", kind, group: "tenants", amount, rights: false, marriage: false, tick, deadline: tick + 1000, status: "open" });
const reload = (state: GameState): GameState =>
  decodeSave(encodeSave({ state, createdAt: "2026-10-09T00:00:00Z", savedAt: "2026-10-09T00:00:00Z" }).bytes).envelope.state;

function pannage(): GameState {
  const base = chapterTwo();
  const tick = (Math.floor(base.tick / 4000) + 1) * 4000 + 2000;
  return { ...base, tick, archetypeId: "core:forest_edge", agency: initialAgency(), tiles: base.tiles.map((tile, i) => i === 0 ? { ...tile, terrain: "forest" } : tile),
    stewardship: { ...EMPTY_STEWARDSHIP, petitions: [homePetition("pannage-real", "pannage", 20, tick)] } };
}
function pasture(): GameState {
  const base = chapterTwo();
  // The engine test's pasture zone as one the save takes (its undo stack stays valid): the save's own smallest field, a pasture.
  return { ...base, agency: initialAgency(), zones: (base.zones ?? []).map(zone => zone.id === "zone-000004" ? { ...zone, kind: "pasture" as const } : zone),
    stewardship: { ...EMPTY_STEWARDSHIP, petitions: [homePetition("pasture-real", "common_pasture", 0, base.tick)] } };
}
function road(): GameState {
  const base = chapterTwo();
  return { ...base, agency: initialAgency(), stewardship: { ...EMPTY_STEWARDSHIP, petitions: [homePetition("road-real", "road_bridge", 30, base.tick)] } };
}
const HOME = [
  { variant: "ck_evt_041", petitionId: "pannage-real", kind: "pannage", build: pannage },
  { variant: "ck_evt_048", petitionId: "pasture-real", kind: "common_pasture", build: pasture },
  { variant: "ck_evt_056", petitionId: "road-real", kind: "road_bridge", build: road },
] as const;

function offered(entryId: string): { readonly state: GameState; readonly occurrence: RegistryOccurrence } {
  const base = chapterTwo();
  const person = base.persons?.people[0];
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const estates = Array.from({ length: 12 }, (_, index) => ({ ...original, id: `estate-${index}`, offMap: true,
    titleHolder: "lord", possessor: "lord", pieces: original.pieces.map(piece => ({ ...piece, titleHolder: "lord", possessor: "lord" })) }));
  const estate = estates[0];
  assert.ok(estate);
  const current = { personId: "current", estateId: estate.id, ability: 40, loyalty: 40, disposition: "greedy" as const, connection: null, since: 0, kept: 0, errors: 0, status: "serving" as const };
  const able = { ...current, personId: "able", ability: 80, loyalty: 20, disposition: "merchant" as const, status: "candidate" as const };
  const loyal = { ...current, personId: "loyal", ability: 20, loyalty: 80, disposition: "peasant" as const, status: "candidate" as const };
  const oversight = estates.map(item => ({ estateId: item.id, mode: entryId === "ck_evt_031" ? "steward" as const : "direct" as const,
    stewardId: current.personId, auditMode: "accounts" as const, tenants: 0, merchants: 0, undetected: 0, since: 0 }));
  const state: GameState = { ...base, agency: initialAgency(), registry: initialRegistry(),
    estates: { ...estatesOf(base), estates, people: [current, able, loyal].map(item => ({ ...person, id: item.personId, alive: true, birthYear: 1270 })) },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current, able, loyal], oversight } };
  const entry = v4Entry(entryId);
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound, entryId);
  const occurrence: RegistryOccurrence = { id: `variant-screen:${entryId}`, entryId, source: "v4", boundId: estate.id,
    offeredTick: state.tick, deadline: state.tick + 1000, status: "offered", bound: boundIdentities(bound),
    receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  return { state: { ...state, registry: { ...initialRegistry(), occurrences: [occurrence] } }, occurrence };
}

for (const { variant, petitionId, build } of HOME) {
  test(`${variant}: clicked home display identity survives answer and save`, () => {
    const before = build();
    const view = homePetitionView(before); assert.ok(view);
    assert.equal(view.displayEntryId, variant);
    const command = { type: "answer_estate_petition", petitionId, grant: true, displayEntryId: view.displayEntryId } as const;
    const after = gameReducer(before, command);
    const record = after.history?.records.filter(row => row.template === "decision.card").at(-1); assert.ok(record);
    assert.deepEqual(decisionPresentation(record), { sourceEntryId: `home:${view.kind}`, displayEntryId: variant });
    assert.deepEqual(decisionPresentation(reload(after).history?.records.find(row => row.id === record.id)), decisionPresentation(record));
    assert.equal(gameReducer(after, command), after);
  });
}
for (const [source, variant] of [["ck_evt_031", "ck_evt_067"], ["ck_evt_059", "ck_evt_067"], ["ck_evt_019", "ck_evt_078"]] as const) {
  test(`${source}: clicked registry identity persists without replacing source or choice`, () => {
    const { state, occurrence } = offered(source);
    const view = registryOfferView(state); assert.ok(view);
    assert.equal(view.displayEntryId, variant);
    const choice = view.choices.find(row => row.enabled && !row.hold); assert.ok(choice);
    const command = { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: choice.id, displayEntryId: view.displayEntryId } as const;
    const after = gameReducer(state, command);
    const record = after.history?.records.filter(row => row.template === "decision.card").at(-1); assert.ok(record);
    assert.deepEqual(decisionPresentation(record), { sourceEntryId: source, displayEntryId: variant });
    assert.equal(record.params?.chosen, choice.id);
    assert.equal(after.registry?.occurrences[0]?.entryId, source);
    assert.deepEqual(decisionPresentation(reload(after).history?.records.find(row => row.id === record.id)), decisionPresentation(record));
    assert.equal(gameReducer(after, command), after);
  });
}
test("metadata missing or wrong-source does not alter the answer or invent exposure", () => {
  const before = pannage();
  const command = { type: "answer_estate_petition", petitionId: "pannage-real", grant: false } as const;
  const ordinary = gameReducer(before, command);
  for (const displayEntryId of ["ck_evt_078", "not-an-entry"]) {
    const after = gameReducer(before, { ...command, displayEntryId });
    assert.deepEqual(after, ordinary);
  }
  assert.equal(decisionPresentation(ordinary.history?.records.filter(row => row.template === "decision.card").at(-1)), null);
  assert.deepEqual(answerPresentationParams(before, ordinary, { ...command, displayEntryId: 41 }), {});
});
test("stale presentation eligibility does not replace the clicked identity", () => {
  const selected = pannage();
  const view = homePetitionView(selected); assert.ok(view);
  const before = { ...selected, archetypeId: "core:river_crossing" };
  assert.notEqual(homePetitionView(before)?.displayEntryId, view.displayEntryId);
  const after = gameReducer(before, { type: "answer_estate_petition", petitionId: view.petitionId, grant: false, displayEntryId: view.displayEntryId });
  assert.equal(decisionPresentation(after.history?.records.filter(row => row.template === "decision.card").at(-1))?.displayEntryId, "ck_evt_041");
});
test("invalid registry answers and no-op attempts record no presentation", () => {
  const { state, occurrence } = offered("ck_evt_031");
  const command = { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: "missing", displayEntryId: "ck_evt_067" } as const;
  assert.equal(gameReducer(state, command), state);
  const missing = { ...state, estates: { ...estatesOf(state), people: [] } };
  const invalid = gameReducer(missing, { ...command, choiceId: "a" });
  assert.deepEqual(answerPresentationParams(missing, invalid, command), {});
  assert.equal(decisionPresentation(invalid.history?.records.filter(row => row.template === "decision.card").at(-1)), null);
});
test("history reader fails closed for missing and malformed provenance", () => {
  assert.equal(decisionPresentation(undefined), null);
  const record = { id: "h-test", tick: 0, kind: "decision", template: "decision.card", severity: 1, subject: { type: "town", id: "town" } } as const;
  assert.equal(decisionPresentation({ ...record, params: { sourceEntryId: "ck_evt_031", displayEntryId: "ck_evt_078" } }), null);
  assert.equal(decisionPresentation({ ...record, params: { sourceEntryId: "ck_evt_031", displayEntryId: 67 } }), null);
  assert.deepEqual(decisionPresentation({ ...record, params: { sourceEntryId: "ck_evt_031", displayEntryId: "ck_evt_031" } }), { sourceEntryId: "ck_evt_031", displayEntryId: "ck_evt_031" });
});

test("plain displayed copy is explicit while absent bot metadata remains unknown", () => {
  const selected = pannage();
  const before = { ...selected, archetypeId: "core:river_crossing" };
  const view = homePetitionView(before); assert.ok(view);
  assert.equal(view.displayEntryId, "home:pannage");
  const after = gameReducer(before, { type: "answer_estate_petition", petitionId: view.petitionId, grant: true, displayEntryId: view.displayEntryId });
  assert.deepEqual(decisionPresentation(after.history?.records.filter(row => row.template === "decision.card").at(-1)),
    { sourceEntryId: "home:pannage", displayEntryId: "home:pannage" });
});
test("saved answer presentation survives occurrence retention and ignores other-source metadata", () => {
  const { state, occurrence } = offered("ck_evt_031");
  const view = registryOfferView(state); assert.ok(view);
  const choice = view.choices.find(row => row.enabled && !row.hold); assert.ok(choice);
  const command = { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: choice.id } as const;
  const ordinary = gameReducer(state, command);
  assert.deepEqual(gameReducer(state, { ...command, displayEntryId: "ck_evt_078" }), ordinary);
  const after = gameReducer(state, { ...command, displayEntryId: view.displayEntryId });
  const retained = reload({ ...after, registry: initialRegistry() });
  assert.deepEqual(decisionPresentation(retained.history?.records.filter(row => row.template === "decision.card").at(-1)),
    { sourceEntryId: "ck_evt_031", displayEntryId: "ck_evt_067" });
});
