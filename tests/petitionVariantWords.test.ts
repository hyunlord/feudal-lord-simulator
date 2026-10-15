// ER-13 wording variants on the screens (docs/requests/engine-B-petition-variant-presentation.md): the home estate's
// pannage / common pasture / road petitions take the canon's 041 / 048 / 056 words, the registry's 031 · 059 and 019 offers
// take 067 and 078 — title and body only, on the card and its chip. The states are the engine's evidence tests' (the
// chapter-two save with lord mode's agency and the petition or offer the variant reads: tests/registryWoodlandPetition,
// registryPasturePetition, registryMarketRoadPetition, registryVariants). "The same card without the variant" is the same
// state with the variant's calendar shut (as the engine's calendar tests shut it), so everything but the words compares.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
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
import { homePetitionCard } from "../src/ui/decisionCard/families/homePetitionCard";
import { eventArtFor } from "../src/ui/eventArt";
import { HOME_PETITION_COPY } from "../src/ui/lordCardsCopy.ko";
import { homePetitionView, parties } from "../src/ui/lordCardsModel";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { openRegistryCards, registryHeadline, registryOfferView } from "../src/ui/registryCardModel";
import { HOME_PETITION_ART } from "../src/ui/wave44Art";

const chapterTwo = (): GameState => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v49/chapter-two-town.save.json"))).envelope.state;
const homePetition = (id: string, kind: HomePetitionKind, amount: number, tick: number): EstatePetition =>
  ({ id, estateId: "estate-home", kind, group: "tenants", amount, rights: false, marriage: false, tick, deadline: tick + 1000, status: "open" });
const reload = (state: GameState): GameState =>
  decodeSave(encodeSave({ state, createdAt: "2026-10-09T00:00:00Z", savedAt: "2026-10-09T00:00:00Z" }).bytes).envelope.state;

/** The same state seen with the variant's calendar shut (a new object: the views are once per state). */
function shut<T>(variantId: string, state: GameState, read: (state: GameState) => T): T {
  const entry = v4Entry(variantId);
  assert.ok(entry);
  const saved = entry.calendar;
  try {
    assert.ok(Reflect.set(entry, "calendar", { ...saved, seasonIndices: [] }));
    return read({ ...state });
  } finally { Reflect.set(entry, "calendar", saved); }
}

// The three home petitions as the engine's tests raise them: 041 on a woodland in autumn, 048 with a pasture zone and both
// parties, 056 beside the town's market and its road.
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

const words = (variant: string) => { const copy = V4_COPY[variant]; assert.ok(copy); return copy; };
const homeChip = (state: GameState, id: string) => lordBeats(state).find(beat => beat.id === `home-petition:${id}`);

for (const { variant, petitionId, kind, build } of HOME) {
  test(`${variant}: the real home ${kind} petition's card and chip say the canon's title and body, nothing else changes`, () => {
    const state = build();
    const { title, body } = words(variant);
    const view = homePetitionView(state);
    assert.ok(view);
    assert.equal(view.petitionId, petitionId);
    assert.equal(view.title, title);
    assert.equal(view.demand, body);
    assert.equal(view.art, HOME_PETITION_ART[kind]);
    const card = homePetitionCard(state);
    assert.ok(card);
    assert.equal(card.subjectId, petitionId);
    assert.equal(card.title, title);
    assert.equal(card.situation, body);
    assert.equal(card.illustration, HOME_PETITION_ART[kind]);
    const chip = homeChip(state, petitionId);
    assert.equal(chip?.title, title);
    assert.equal(chip?.line, body);
    // Shut, only the displayed words and their provenance change; the card, frame and chip keep their behavior.
    const plain = shut(variant, state, open => ({ view: homePetitionView(open), card: homePetitionCard(open), chip: homeChip(open, petitionId) }));
    const copy = HOME_PETITION_COPY[kind];
    assert.equal(plain.view?.title, copy.title);
    assert.equal(plain.view?.demand, copy.demand(state.stewardship!.petitions[0]!.amount, parties(state, state.stewardship!.petitions[0]!)));
    assert.equal(plain.card?.situation, plain.view?.demand);
    assert.deepEqual({ ...card, title: null, situation: null }, { ...plain.card, title: null, situation: null });
    assert.deepEqual([view.displayEntryId, plain.view?.displayEntryId], [variant, `home:${kind}`]);
    assert.deepEqual({ ...view, title: null, demand: null, displayEntryId: null }, { ...plain.view, title: null, demand: null, displayEntryId: null });
    assert.deepEqual({ ...chip, title: null, line: null }, { ...plain.chip, title: null, line: null });
    assert.deepEqual(card.choices.map(choice => [choice.id, choice.label]), [["grant", copy.grant(parties(state, {}))], ["refuse", copy.refuse(parties(state, {}))]]);
  });

  test(`${variant}: after a save and restore the card still says it, and the answer goes to the same petition once`, () => {
    const state = build();
    const loaded = reload(state);
    assert.equal(homePetitionView(loaded)?.title, words(variant).title);
    assert.equal(homePetitionCard(loaded)?.subjectId, petitionId);
    for (const grant of [true, false]) {
      const command = { type: "answer_estate_petition", petitionId, grant } as const;
      const fromSave = gameReducer(loaded, command);
      const fromState = gameReducer(state, command);
      assert.equal(fromSave.treasuryCoin, fromState.treasuryCoin);
      assert.deepEqual(fromSave.factions, fromState.factions);
      assert.deepEqual(fromSave.stewardship?.petitions.map(entry => [entry.id, entry.status]), [[petitionId, grant ? "granted" : "refused"]]);
      // Once: the answered petition takes no second answer, and its card and chip are gone (words with them).
      assert.equal(gameReducer(fromSave, { ...command, grant: !grant }), fromSave);
      assert.equal(homePetitionView(fromSave), null);
      assert.equal(lordBeats(fromSave).some(beat => beat.title === words(variant).title), false);
    }
    // Past its deadline it is no longer offered: no card, no words.
    const late = { ...loaded, tick: state.stewardship!.petitions[0]!.deadline + 1 };
    assert.equal(homePetitionView(late), null);
  });

  test(`${variant}: another estate's ${kind} petition never takes the words`, () => {
    const state = build();
    const elsewhere = estatesOf(state).estates.find(estate => estate.id !== "estate-home")?.id ?? "estate-neighbour-1";
    const moved: GameState = { ...state, stewardship: { ...state.stewardship!, petitions: state.stewardship!.petitions.map(entry => ({ ...entry, estateId: elsewhere })) } };
    assert.equal(homePetitionView(moved), null);
    assert.equal(lordBeats(moved).some(beat => beat.title === words(variant).title || beat.line === words(variant).body), false);
  });
}

test("041 · 048 · 056: the cause or party gone, or out of the variant's window, the card keeps the kind's own words", () => {
  const forest = pannage();
  const cases: readonly [string, GameState, HomePetitionKind][] = [
    // 041: the land is not a woodland; out of autumn (the petition still waits).
    ["041 open field", { ...forest, archetypeId: "core:open_field" }, "pannage"],
    ["041 out of autumn", { ...forest, tick: forest.tick - 1000, stewardship: { ...forest.stewardship!, petitions: [homePetition("pannage-real", "pannage", 20, forest.tick - 1000)] } }, "pannage"],
    // 048: a party gone, the pasture gone.
    ["048 no second merchant house", { ...pasture(), factions: { ...pasture().factions!, factions: pasture().factions!.factions.filter(faction => faction.id !== "merchant_house_2") } }, "common_pasture"],
    ["048 no pasture", { ...pasture(), zones: [] }, "common_pasture"],
    // 056: no market to read the road by.
    ["056 no market", { ...road(), buildings: road().buildings.filter(building => building.kind !== "market") }, "road_bridge"],
  ];
  for (const [what, state, kind] of cases) {
    const view = homePetitionView(state);
    assert.ok(view, what);
    assert.equal(view.title, HOME_PETITION_COPY[kind].title, what);
    assert.equal(homePetitionCard(state)?.title, HOME_PETITION_COPY[kind].title, what);
    assert.equal(homeChip(state, view.petitionId)?.title, HOME_PETITION_COPY[kind].title, what);
  }
});

// The registry's offers as tests/registryVariants.test.ts makes them: twelve off-map estates, the serving steward and two
// candidates (the able, the loyal), the offer bound to them.
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
const offerChip = (state: GameState, id: string) => lordBeats(state).find(beat => beat.id === `registry:${id}`);

for (const [source, variant] of [["ck_evt_031", "ck_evt_067"], ["ck_evt_059", "ck_evt_067"], ["ck_evt_019", "ck_evt_078"]] as const) {
  test(`${variant}: the real ${source} offer's card and chip say the variant's title and body; its choices, stake, deadline and picture stay`, () => {
    const { state, occurrence } = offered(source);
    const { title, body } = words(variant);
    const head = registryHeadline(state);
    assert.ok(head);
    assert.equal(registryHeadline(state), head, "once per state");
    assert.deepEqual([head.occurrenceId, head.entryId, head.art, head.title, head.body], [occurrence.id, source, eventArtFor(source), title, body]);
    const view = registryOfferView(state);
    assert.ok(view);
    assert.deepEqual([view.title, view.body, view.card.title, view.card.situation, view.card.subjectId], [title, body, title, body, occurrence.id]);
    const chip = offerChip(state, occurrence.id);
    assert.deepEqual([chip?.title, chip?.line], [title, body]);
    // Not a card of its own: the variant entry is never an offer the lord gets.
    assert.deepEqual(openRegistryCards(state).map(card => card.entry.id), [source]);
    const plain = shut(variant, state, open => ({ view: registryOfferView(open), chip: offerChip(open, occurrence.id) }));
    assert.deepEqual([plain.view?.title, plain.view?.body], [V4_COPY[source]?.title, V4_COPY[source]?.body]);
    assert.deepEqual([view.displayEntryId, plain.view?.displayEntryId], [variant, source]);
    const strip = (offer: typeof view | null | undefined) => offer === null || offer === undefined ? null
      : { ...offer, title: null, body: null, displayEntryId: null, card: { ...offer.card, title: null, situation: null } };
    assert.deepEqual(strip(view), strip(plain.view));
    assert.deepEqual({ ...chip, title: null, line: null }, { ...plain.chip, title: null, line: null });
  });

  test(`${variant}: after a save and restore the ${source} card still says it, and its answer is the original offer's, once`, () => {
    const { state, occurrence } = offered(source);
    const loaded = reload(state);
    const view = registryOfferView(loaded);
    assert.equal(view?.title, words(variant).title);
    const choice = view?.choices.find(entry => entry.enabled && !entry.hold);
    assert.ok(choice);
    const command = { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: choice.id } as const;
    const fromSave = gameReducer(loaded, command);
    const fromState = gameReducer(state, command);
    assert.equal(fromSave.treasuryCoin, fromState.treasuryCoin);
    assert.deepEqual(fromSave.factions, fromState.factions);
    assert.deepEqual(fromSave.stewardship, fromState.stewardship);
    assert.deepEqual(fromSave.registry?.occurrences.map(entry => [entry.id, entry.entryId, entry.status]), [[occurrence.id, source, "answered"]]);
    assert.equal(gameReducer(fromSave, command), fromSave);
    assert.equal(registryOfferView(fromSave), null);
    assert.equal(lordBeats(fromSave).some(beat => beat.title === words(variant).title), false);
  });
}

test("067 · 078: only on their own offers — a party gone, past the deadline or another offer, the canon's own words", () => {
  const { state, occurrence } = offered("ck_evt_031");
  const missing: GameState = { ...state, estates: { ...state.estates!, people: state.estates!.people.filter(person => person.id !== "able") } };
  assert.equal(registryHeadline(missing)?.title, V4_COPY.ck_evt_031?.title);
  assert.equal(registryOfferView(missing)?.card.situation, V4_COPY.ck_evt_031?.body);
  assert.equal(registryHeadline({ ...state, tick: occurrence.deadline + 1 }), null);
  // An offer the variants are not linked to (002) keeps its own words on the same parties.
  const other = { ...occurrence, entryId: "ck_evt_002" };
  const unlinked: GameState = { ...state, registry: { ...initialRegistry(), occurrences: [other] } };
  assert.equal(registryHeadline(unlinked)?.title, V4_COPY.ck_evt_002?.title);
  assert.notEqual(registryHeadline(unlinked)?.title, V4_COPY.ck_evt_067?.title);
  // A home petition the variant words are for is never on the registry card, and the registry's words never on the home card.
  const both: GameState = { ...state, stewardship: { ...state.stewardship!, petitions: road().stewardship!.petitions } };
  assert.notEqual(homePetitionView(both)?.title, V4_COPY.ck_evt_067?.title);
  assert.equal(registryHeadline(both)?.entryId, "ck_evt_031");
});
