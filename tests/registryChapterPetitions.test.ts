import { petitionDecisionView } from "../src/ui/decisionModels";
import { registryOfferView } from "../src/ui/registryCardModel";
import { advanceHistory, recordDecision } from "../src/engine/history";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PETITION_DEFS } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { factionChanges } from "../src/engine/factions";
import { advancePolitics, initialPolitics, openPetitions, respondToPetition } from "../src/engine/politics";
import { advanceRegistry, answerRegistryOffer, initialRegistry, offerChoices, openRegistryOffers } from "../src/engine/registry";
import { canAnswerRegistryChapterPetition, expireRegistryChapterPetitions, prepareRegistryChapterPetition,
  registryChapterPetitionContext, registryChapterPetitionDef, registryChapterPetitionDeadline } from "../src/engine/registryChapterPetitions";
import { stewardshipOf } from "../src/engine/stewardship";
import { initialAgency } from "../src/engine/townAgency";
import { decodeSave, encodeSave } from "../src/save/saveCodec";

function fixture(): GameState {
  const base = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v49/chapter-two-town.save.json"))).envelope.state;
  return { ...base, tick: 328000, agency: initialAgency(), politics: initialPolitics(base), registry: initialRegistry(),
    buildings: [{ id: "91001", workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, kind: "market", tx: 10, ty: 10 }, { id: "91002", workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, kind: "chapel", tx: 12, ty: 10 }] };
}

test("registry definitions stay out of automatic calendar schedule and preserve editorial terms", () => {
  assert.equal(PETITION_DEFS.some(def => def.id === "ck_evt_057" || def.id === "ck_evt_058"), false);
  assert.equal(registryChapterPetitionDef("ck_evt_057")?.outcomes.accept.charterFee, 0);
  assert.equal(registryChapterPetitionDef("ck_evt_057")?.outcomes.accept_with_price.charterFee, 80);
  assert.equal(registryChapterPetitionDef("ck_evt_058")?.outcomes.accept_with_price.charterFee, 50);
  assert.equal(registryChapterPetitionDef("ck_evt_058")?.responses?.includes("refuse"), false);
});

test("candidate copy is side-effect free and any historical response blocks reissue after reload", () => {
  for (const id of ["ck_evt_057", "ck_evt_058"]) {
    const state = fixture();
    const prepared = prepareRegistryChapterPetition(state, id);
    assert.ok(prepared);
    assert.equal(state.politics?.petitions.length, 0);
    assert.equal(prepared.politics?.petitions.length, 1);
    const loaded = decodeSave(encodeSave({ state: prepared, createdAt: "2026-10-06T00:00:00Z", savedAt: "2026-10-06T00:00:00Z" }).bytes).envelope.state;
    assert.equal(prepareRegistryChapterPetition(loaded, id), null);
    for (const response of ["accept", "refuse", "expired"] as const) {
      assert.ok(loaded.politics);
      const historical = { ...loaded, politics: { ...loaded.politics, petitions: loaded.politics.petitions.map(petition => ({ ...petition, response })) } };
      assert.equal(prepareRegistryChapterPetition(historical, id), null);
    }
  }
});

test("expiry is exactly once at deadline including reload and exposes one generic faction transition", () => {
  for (const id of ["ck_evt_057", "ck_evt_058"]) {
    const prepared = prepareRegistryChapterPetition(fixture(), id);
    assert.ok(prepared);
    const petition = prepared.politics?.petitions[0];
    assert.ok(petition);
    const deadline = registryChapterPetitionDeadline(prepared, petition);
    const before = { ...prepared, tick: deadline - 1 };
    assert.equal(expireRegistryChapterPetitions(before), before);
    const due = { ...before, tick: deadline };
    const expired = expireRegistryChapterPetitions(due);
    assert.equal(expired.politics?.petitions[0]?.response, "expired");
    assert.equal(expired.politics?.merchantGauge, 50 + (id === "ck_evt_057" ? -5 : -4));
    assert.deepEqual(factionChanges(due, expired).filter(change => change.reason.startsWith("petition:")),
      [{ factionId: "merchant_house_1", delta: -10, reason: `petition:${id}:expired` }]);
    const loaded = decodeSave(encodeSave({ state: expired, createdAt: "2026-10-06T00:00:00Z", savedAt: "2026-10-06T00:00:00Z" }).bytes).envelope.state;
    assert.equal(expireRegistryChapterPetitions(loaded), loaded);
    assert.deepEqual(factionChanges(loaded, expireRegistryChapterPetitions(loaded)), []);
  }
});

test("eligibility and answer revalidation enforce built context, charter conflict, options and campaign cutoff", () => {
  const state = fixture();
  assert.equal(registryChapterPetitionContext({ ...state, tick: 0 }, "ck_evt_058"), true);
  assert.equal(registryChapterPetitionContext({ ...state, tick: 604000 }, "ck_evt_058"), false);
  assert.equal(prepareRegistryChapterPetition({ ...state, tick: 604000 - 79 }, "ck_evt_058"), null);
  const last = prepareRegistryChapterPetition({ ...state, tick: 604000 - 80 }, "ck_evt_058");
  assert.ok(last);
  const prepared = prepareRegistryChapterPetition(state, "ck_evt_058");
  assert.ok(prepared);
  const petition = prepared.politics?.petitions[0];
  assert.ok(petition);
  assert.equal(canAnswerRegistryChapterPetition(prepared, petition, "accept"), true);
  assert.equal(canAnswerRegistryChapterPetition(prepared, petition, "refuse"), false);
  assert.equal(canAnswerRegistryChapterPetition({ ...prepared, buildings: [] }, petition, "accept"), false);
  assert.equal(canAnswerRegistryChapterPetition({ ...prepared, tick: petition.arrivedTick + 1000 }, petition, "accept"), false);
  assert.ok(state.politics);
  const conflict = { ...state, politics: { ...state.politics, petitions: [{ id: "stock", defId: "market_charter", petitioner: "merchants" as const, arrivedTick: 1 }] } };
  assert.equal(prepareRegistryChapterPetition(conflict, "ck_evt_057"), null);
  assert.equal(registryChapterPetitionContext({ ...state, buildings: state.buildings.filter(building => building.kind === "market") }, "ck_evt_057"), false);
});

test("church-market geometry uses footprint boundary four, not centre or proposed projects", () => {
  const state = fixture();
  const market = state.buildings[0];
  const chapel = state.buildings[1];
  assert.ok(market && chapel);
  const near = { ...state, buildings: [market, { ...chapel, tx: 15 }] };
  const far = { ...state, buildings: [market, { ...chapel, tx: 16 }] };
  assert.equal(registryChapterPetitionContext(near, "ck_evt_057"), true);
  assert.equal(registryChapterPetitionContext(far, "ck_evt_057"), false);
});

test("expiry settles its own open offer and preserves another offer and previous held response", () => {
  const prepared = prepareRegistryChapterPetition(fixture(), "ck_evt_058");
  assert.ok(prepared);
  const petition = prepared.politics?.petitions[0];
  assert.ok(petition);
  const occurrence = { id: "registry:058", entryId: "ck_evt_058", boundId: petition.id, offeredTick: prepared.tick,
    deadline: prepared.tick + 1000, status: "offered" as const, source: "v4" as const,
    bound: { chapterPetition: petition.id }, receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  const due = { ...prepared, tick: prepared.tick + 1000, registry: { ...initialRegistry(),
    occurrences: [occurrence, { ...occurrence, id: "other", bound: { chapterPetition: "other" } }] } };
  const expired = expireRegistryChapterPetitions(due);
  assert.equal(expired.registry?.occurrences[0]?.status, "lapsed");
  assert.equal(expired.registry?.occurrences[1]?.status, "offered");
  const held = { ...due, registry: { ...due.registry, occurrences: [{ ...occurrence, status: "answered" as const, choiceId: "hold" }] } };
  const settled = expireRegistryChapterPetitions(held);
  assert.equal(settled.registry?.occurrences[0]?.status, "answered");
  assert.equal(settled.politics?.petitions[0]?.response, "expired");
});

test("057 respects the lowest existing right fee even when that right is not market_charter", () => {
  const state = fixture();
  assert.ok(state.politics);
  for (const fee of [750, 800]) {
    const withRight: GameState = { ...state, politics: { ...state.politics, rights: [{ id: "other", holder: "merchants" as const,
      grantedTick: 0, petitionId: "old", stallFeePermille: fee }] } };
    assert.equal(registryChapterPetitionContext(withRight, "ck_evt_057"), fee > 750);
  }
});

function selected(id: string): GameState {
  const fixtureState = fixture();
  const base: GameState = { ...fixtureState, tick: 600000, stewardship: { ...stewardshipOf(fixtureState),
    standing: { "sender:merchant_house_1": "lord" } } };
  for (let seed = 1; seed <= 512; seed += 1) {
    const before = { ...base, seed };
    const after = advanceRegistry(before);
    if (after.registry?.occurrences.some(offer => offer.entryId === id && offer.status === "offered")) {
      assert.equal(before.politics?.petitions.length, 0);
      assert.equal(after.politics?.petitions.filter(petition => petition.defId.startsWith("ck_evt_")).length, 1);
      return after;
    }
  }
  assert.fail(`No selected ${id} in deterministic fixture seeds`);
}

test("direct chapter replies close the matching registry offer before reload and never lapse afterward", () => {
  for (const [id, response, choice, amount] of [
    ["ck_evt_057", "accept", "light", 0],
    ["ck_evt_057", "accept_with_price", "fee", 80],
    ["ck_evt_057", "refuse", "refuse", 0],
    ["ck_evt_058", "accept", "remit", 0],
    ["ck_evt_058", "accept_with_price", "collect", 50],
  ] as const) {
    const state = selected(id);
    const offer = state.registry?.occurrences.find(entry => entry.entryId === id);
    const petitionId = offer?.bound?.chapterPetition;
    assert.ok(offer && typeof petitionId === "string");
    const answered = respondToPetition(state, petitionId, response);
    assert.equal(answered.treasuryCoin - state.treasuryCoin, amount);
    assert.equal(openRegistryOffers(answered).some(entry => entry.id === offer.id), false);
    const closed = answered.registry?.occurrences.find(entry => entry.id === offer.id);
    assert.equal(closed?.status, "answered");
    assert.equal(closed?.choiceId, choice);
    assert.equal(closed?.settledTick, state.tick);
    const loaded = decodeSave(encodeSave({ state: answered, createdAt: "2026-10-06T00:00:00Z", savedAt: "2026-10-06T00:00:00Z" }).bytes).envelope.state;
    assert.equal(respondToPetition(loaded, petitionId, response), loaded);
    assert.equal(answerRegistryOffer(loaded, offer.id, choice), loaded);
    const later = advanceRegistry({ ...loaded, tick: offer.deadline + 1 });
    assert.equal(later.registry?.occurrences.find(entry => entry.id === offer.id)?.status, "answered");
    assert.equal(later.treasuryCoin, loaded.treasuryCoin);
    assert.equal(later.politics?.merchantGauge, loaded.politics?.merchantGauge);
  }
});

test("budget selection alone persists a chapter petition, then answers through registry and records faction/history once", () => {
  for (const [id, choice, amount] of [["ck_evt_057", "fee", 80], ["ck_evt_058", "collect", 50]] as const) {
    const selectedState = selected(id);
    const state = decodeSave(encodeSave({ state: selectedState, createdAt: "2026-10-06T00:00:00Z", savedAt: "2026-10-06T00:00:00Z" }).bytes).envelope.state;
    const offer = state.registry?.occurrences.find(entry => entry.entryId === id);
    assert.ok(offer);
    assert.ok(offerChoices(state, offer).includes(choice));
    const beforeRelation = state.factions?.factions.find(faction => faction.id === "merchant_house_1")?.relation;
    assert.ok(beforeRelation !== undefined);
    const reduced = answerRegistryOffer(state, offer.id, choice);
    const after = recordDecision(state, reduced, { type: "answer_registry_offer", occurrenceId: offer.id, choiceId: choice });
    assert.equal(after.treasuryCoin - state.treasuryCoin, amount);
    assert.equal(after.registry?.occurrences.find(entry => entry.id === offer.id)?.side, undefined, "chapter owns its authored relation effect");
    assert.equal(after.factions?.factions.find(faction => faction.id === "merchant_house_1")?.relation, Math.min(100, beforeRelation + 3));
    assert.equal(after.politics?.petitions.find(petition => petition.defId === id)?.response, "accept_with_price");
    assert.equal(after.history?.records.filter(record => record.template === "registry.answered" && record.params?.entry === id).length, 1);
    assert.equal(answerRegistryOffer(after, offer.id, choice), after);
    assert.equal(prepareRegistryChapterPetition(after, id), null);
  }
});

test("actual selected petition expires through registry and generic history observer once", () => {
  const offered = selected("ck_evt_058");
  const offer = offered.registry?.occurrences.find(entry => entry.entryId === "ck_evt_058");
  assert.ok(offer);
  const before = { ...offered, tick: offer.deadline };
  const expired = advanceHistory(before, advanceRegistry(before));
  assert.equal(expired.politics?.petitions.find(petition => petition.defId === "ck_evt_058")?.response, "expired");
  assert.equal(expired.registry?.occurrences.find(entry => entry.id === offer.id)?.status, "lapsed");
  const next = { ...expired, tick: expired.tick + 1 };
  assert.equal(advanceRegistry(next), next);
  assert.equal(respondToPetition(expired, offer.bound?.chapterPetition ?? "", "accept"), expired);
});

test("stock calendar cannot expire registry petitions at a year boundary and cap expires at 1451", () => {
  const state = { ...fixture(), tick: 603920 };
  const prepared = prepareRegistryChapterPetition(state, "ck_evt_058");
  assert.ok(prepared);
  const beforeCap = advancePolitics({ ...prepared, tick: 603950 });
  assert.equal(beforeCap.politics?.petitions.find(petition => petition.defId === "ck_evt_058")?.response, undefined);
  const atCap = advanceRegistry(advancePolitics({ ...beforeCap, tick: 604000 }));
  assert.equal(atCap.politics?.petitions.find(petition => petition.defId === "ck_evt_058")?.response, "expired");
  assert.equal(atCap.politics?.merchantGauge, beforeCap.politics?.merchantGauge === undefined ? undefined : beforeCap.politics.merchantGauge - 4);
});

test("direct normal petition response uses its own forecast and records generic relations exactly once", () => {
  const state = prepareRegistryChapterPetition(fixture(), "ck_evt_058");
  assert.ok(state);
  const petition = state.politics?.petitions[0];
  assert.ok(petition);
  const after = recordDecision(state, respondToPetition(state, petition.id, "accept_with_price"),
    { type: "petition_response", petitionId: petition.id, response: "accept_with_price" });
  const decision = after.history?.records.find(record => record.template === "decision.petition_response" && record.params?.defId === "ck_evt_058");
  assert.ok(decision?.decision);
  assert.equal(decision.decision.predicted.treasury, state.treasuryCoin + 50);
  assert.deepEqual(decision.decision.alternatives, ["accept"]);
  assert.equal(after.history?.records.filter(record => record.template === "faction.relation" && record.params?.reason === "petition:ck_evt_058:accept_with_price").length, 1);
  assert.equal(respondToPetition(after, petition.id, "accept_with_price"), after);
});

test("new expiry adapter preserves ordinary state identity and stock petitions", () => {
  const base = fixture();
  assert.equal(expireRegistryChapterPetitions(base), base);
  const idle = { ...base, tick: base.tick + 1 };
  assert.equal(advanceRegistry(idle), idle);
  assert.ok(base.politics);
  const stock = { ...idle, politics: { ...base.politics,
    petitions: [{ id: "stock@0", defId: "market_charter", petitioner: "merchants" as const, arrivedTick: 0 }] } };
  assert.equal(expireRegistryChapterPetitions(stock), stock);
  assert.equal(advanceRegistry(stock), stock);
});

test("a registry-owned petition exposes exactly one decision surface with its canonical choices", () => {
  const state = selected("ck_evt_058");
  assert.equal(state.politics?.petitions.filter(petition => petition.response === undefined).length, 1);
  assert.equal(openPetitions(state).length, 0);
  assert.equal(petitionDecisionView(state), null);
  const card = registryOfferView(state);
  assert.ok(card);
  assert.equal(card.entryId, "ck_evt_058");
  assert.deepEqual(card.choices.filter(choice => choice.enabled).map(choice => choice.id), ["remit", "collect"]);
});
