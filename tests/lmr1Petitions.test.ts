/**
 * LM-R1 (petitions): the home estate's petitions as the lord's cards (lord mode only) with Astra's Wave 44 pictures
 * (spec docs/ops/install-plan-20261003/SPECS/wave44.md), the town's requests and the court line (DEC-CARD-2: the steward's
 * precedent card is gone — DEC-TRACE DTR-1; tests/deccard2Steward.test.ts has his season and his standing policies).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildKeyartDerivative, KEYART_DERIVATIVE_BY_URL, sha256, WAVE44_DERIVATIVES } from "../scripts/keyartDerivatives";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_KINDS, HOME_PETITION_ORDER } from "../src/content/stewardshipConfig";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import { beginWardship } from "../src/engine/lordship";
import { lordHouse } from "../src/engine/lordshipState";
import { manorLord } from "../src/engine/persons";
import { stewardshipOf } from "../src/engine/stewardship";
import type { EstatePetition, HomePetitionKind } from "../src/engine/stewardship.types";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { decisionModal, storyBeats } from "../src/ui/eventStory";
import { HOME_PETITION_COPY } from "../src/ui/lordCardsCopy.ko";
import { courtLine, homePetitionView, lordRequestView, openHomePetitions, parties } from "../src/ui/lordCardsModel";
import { factionDisplayName } from "../src/content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../src/content/gentryNames";
import { standingPolicies } from "../src/engine/decisionReads";
import { HOME_PETITION_CARD_COPY } from "../src/ui/decisionCard/families/homePetitionCopy.ko";
import { outlookTreasury } from "../src/ui/decisionCard/outlook";
import { moneyShort } from "../src/ui/money.ko";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { HOME_PETITION_ART, PRECEDENT_ART } from "../src/ui/wave44Art";
import { WAVE44_IMAGES } from "../src/ui/wave44ArtManifest.generated";
import { LORD_SLICE_FACTIONS } from "../src/content/lordSliceConfig";
import { lordSliceFactionsMet } from "../src/engine/lordSlice";
import { factionRows } from "../src/ui/chronicle/factionTabModel";
import { lordHouseArms } from "../src/ui/persons/personModels";
import { DecisionCard } from "../src/ui/decisionCard/DecisionCard";
import { lordOutcome } from "../src/ui/decisionCard/families/lordOutcome";
import { lordRequestCard } from "../src/ui/decisionCard/families/lordRequestCard";
import { afterAnswer } from "../src/ui/decisionCard/remembers";
import { answerOutlook } from "../src/state/decisionOutlook";
import { LordRequestModal } from "../src/ui/hud/LordCards";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { homePetitionCard } from "../src/ui/decisionCard/families/homePetitionCard";
import { directionAccess, tutorialAccess } from "../src/ui/tutorial/tutorialModel";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandPins } from "../src/ui/hud/CommandPins";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";

const SEASON = 1_000;
const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
/** Width and height from the JPEG's frame header (walking the segments: SOF0/1/2). */
function jpegSize(bytes: Buffer): readonly [number, number] {
  for (let at = 2; at + 9 < bytes.length;) {
    const marker = bytes[at + 1]!;
    if (marker >= 0xc0 && marker <= 0xc2) return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return [0, 0];
}

/** Lord slice seed 1 run to its first home petition (1301 spring, the first winter's petition). */
const firstPetition: GameState = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  // DEC-TRACE §1 (GP-7): home petitions are the steward's by default; the lord keeps every kind here so the card comes.
  for (const kind of Object.keys(HOME_PETITION_KINDS)) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lord" });
  while (openHomePetitions(state).length === 0) state = advanceTick(state);
  return state;
})();
const open = (state: GameState) => openHomePetitions(state)[0]!;
/** The state with its open home petition turned into `kind` (the kind's own amount range and party, as the engine draws them). */
function asKind(state: GameState, kind: HomePetitionKind): GameState {
  const def = HOME_PETITION_KINDS[kind];
  const stewardship = stewardshipOf(state);
  const id = open(state).id;
  const petitions = stewardship.petitions.map(petition => petition.id !== id ? petition : {
    ...petition, kind, group: def.group, amount: def.amount[1], rights: def.rights === true, marriage: def.marriage === true,
    ...(def.party === true ? { party: "neighbour_1" } : {}) } as EstatePetition);
  return { ...state, stewardship: { ...stewardship, petitions } };
}

test("Wave 44: eleven confirmed received JPEGs (ten kinds and the precedent), 960×540, provenance rows, shipped as received", () => {
  assert.equal(WAVE44_DERIVATIVES.length, 11);
  for (const item of WAVE44_DERIVATIVES) {
    const bytes = readFileSync(item.source);
    assert.ok(inbox.includes(`${sha256(bytes)},confirmed`), `${item.id}: confirmed in INBOX_LEDGER by its sha256`);
    assert.ok(provenance.includes(item.source), `${item.id}: provenance row`);
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item, `${item.id}: in WEB_ART_DERIVATIVES`);
    assert.equal(item.format, "jpeg-received");
    assert.deepEqual(buildKeyartDerivative(item), bytes, `${item.id}: the received bytes, no second encode`);
    assert.deepEqual(jpegSize(bytes), [960, 540], item.id);
  }
  // The spec's mismatches are not installed: the manor court (no kind) and the forest trespass (not the pannage).
  const sources = Object.values(WAVE44_IMAGES).map(image => image.source).join("\n");
  assert.ok(!sources.includes("11_court_baron") && !sources.includes("12_forest_trespass"));
});

test("Wave 44: the ten matching kinds have their own picture; the pannage and the chancel have none (no other picture stands in)", () => {
  const exact: Readonly<Record<string, string>> = { boundary_dispute: "01_", mill_suit: "02_", heriot: "03_", merchet: "04_", ale_fines: "05_", road_bridge: "06_",
    stall_dispute: "07_", wardship: "08_", common_pasture: "09_", newcomer: "10_" };
  for (const kind of HOME_PETITION_ORDER) {
    const art = HOME_PETITION_ART[kind];
    if (kind === "pannage" || kind === "chancel_repair") { assert.equal(art, null, kind); continue; }
    assert.ok(art !== null && WAVE44_IMAGES[art].assetId.startsWith(exact[kind]!), `${kind} → ${art}`);
  }
  assert.equal(WAVE44_IMAGES[PRECEDENT_ART].assetId, "13_by_precedent");
  assert.ok(!Object.values(HOME_PETITION_ART).includes(PRECEDENT_ART), "the precedent picture is never an open petition's");
});

test("a home petition's card: its picture, the engine's numbers per answer, and the answer through answer_estate_petition", () => {
  const view = homePetitionView(firstPetition)!;
  const card = homePetitionCard(firstPetition)!;
  const petition = open(firstPetition);
  assert.equal(view.petitionId, petition.id);
  assert.equal(view.kind, petition.kind);
  assert.equal(view.art, HOME_PETITION_ART[petition.kind as HomePetitionKind]);
  assert.match(view.court, /^1301년 봄 · 국왕 에드워드 1세 · 영주 .+\(\d+살\)$/);
  for (const choice of card.choices) {
    const grant = choice.id === "grant";
    const after = gameReducer(firstPetition, { type: "answer_estate_petition", petitionId: petition.id, grant });
    assert.equal(stewardshipOf(after).petitions.find(entry => entry.id === petition.id)?.status, grant ? "granted" : "refused");
    // DEC-CARD-2: the card reads the engine's outlook; what it says is what the answer does to the treasury and the factions.
    const moved = treasuryBalance(after) - treasuryBalance(firstPetition);
    assert.equal(/그대로/.test(choice.now[0]!), moved === 0, `${choice.label}: the treasury (${moved})`);
    if (moved !== 0) assert.ok(choice.now[0]!.includes(moneyShort(Math.abs(moved))), `${choice.label}: ${choice.now[0]}`);
    const relation = (state: GameState, id: string) => state.factions!.factions.find(entry => entry.id === id)!.relation;
    for (const faction of firstPetition.factions!.factions) {
      const delta = relation(after, faction.id) - relation(firstPetition, faction.id);
      const said = choice.remembers.find(entry => entry.who === factionDisplayName(faction.id, faction.name));
      assert.equal(said?.delta ?? 0, delta, `${choice.label}: ${faction.id}`);
    }
    assert.equal(homePetitionView(after), null, "answered: no card");
  }
});

test("each of the ten matching kinds and the two without a picture: title, picture, both answers' labels and numbers", () => {
  for (const kind of HOME_PETITION_ORDER) {
    const state = asKind(firstPetition, kind);
    const view = homePetitionView(state)!;
    assert.equal(view.kind, kind);
    assert.equal(view.title, HOME_PETITION_COPY[kind].title);
    assert.equal(view.art, HOME_PETITION_ART[kind]);
    const def = HOME_PETITION_KINDS[kind];
    const treasury = (grant: boolean) => outlookTreasury(answerOutlook(state, { type: "answer_estate_petition", petitionId: view.petitionId, grant })!);
    assert.deepEqual([treasury(true), treasury(false)], [def.grant.income * def.amount[1], def.refuse.income * def.amount[1]]);
    const [grant, refuse] = homePetitionCard(state)!.choices;
    assert.notEqual(grant!.label, refuse!.label);
    assert.ok(grant!.now.length > 0 && refuse!.now.length > 0);
    // The chip: the same picture, or none.
    const beat = lordBeats(state).find(entry => entry.kind === "home_petition")!;
    assert.equal(beat.illustration, view.art);
    assert.equal(decisionModal(beat.decision!), "estate_petition");
  }
  // The boundary names the neighbour house the petition sets against (its relation moves too).
  const boundary = asKind(firstPetition, "boundary_dispute");
  const grant = homePetitionCard(boundary)!.choices[0]!;
  const name = (id: string) => factionDisplayName(id, boundary.factions!.factions.find(entry => entry.id === id)!.name);
  assert.deepEqual(new Map(grant.remembers.map(entry => [entry.who, entry.delta])), new Map([[name("commons"), 5], [name("neighbour_1"), -5]]));
  assert.match(homePetitionView(boundary)!.demand, /가문\(이웃 영주\) 쪽 농부/);
});

test("lord mode only: the sandbox and the campaign have no home petition card, no lord beat", () => {
  for (const scenarioId of ["core:sandbox", "core:campaign_market_town"]) {
    let state = newGameState({ scenarioId })!;
    for (let tick = 0; tick < 4 * SEASON + 1; tick += 1) state = advanceTick(state);
    assert.equal(openHomePetitions(state).length, 0, scenarioId);
    assert.equal(homePetitionView(state), null);
    assert.equal(lordRequestView(state), null);
    assert.deepEqual(lordBeats(state), []);
    assert.ok(!storyBeats(state).some(beat => beat.kind === "home_petition" || beat.kind === "lord_request"));
  }
});

test("DTR-1: the card and its chip say the kind's standing policy and that the steward answers it so from now on", () => {
  const petition = open(firstPetition);
  const view = homePetitionView(firstPetition)!;
  // Every kind is set to 영주에게 here: it keeps coming to the lord.
  assert.equal(view.standing, HOME_PETITION_CARD_COPY.standingLord);
  assert.equal(lordBeats(firstPetition).find(beat => beat.kind === "home_petition")!.advice, view.standing);
  for (const choice of homePetitionCard(firstPetition)!.choices) assert.equal(choice.later[0], view.standing, choice.id);
  assert.doesNotMatch(view.standing, /두 번 이어서|선례/);
  // Set back to 관습대로 and brought by the rule that brings them all: the custom's answer is the engine's (`standingPolicies`).
  const customary = gameReducer(firstPetition, { type: "set_standing_policy", kind: petition.kind, setting: "customary" });
  const stewardship = stewardshipOf(customary);
  const recurring = { ...customary, stewardship: { ...stewardship, rules: { ...stewardship.rules, recurring: true } } };
  const granted = standingPolicies(recurring).find(entry => entry.kind === petition.kind)!.answers.customary.granted;
  const copy = HOME_PETITION_COPY[petition.kind as HomePetitionKind];
  const answer = granted === true ? copy.grant(parties(recurring, petition)) : copy.refuse(parties(recurring, petition));
  assert.equal(homePetitionView(recurring)!.standing, HOME_PETITION_CARD_COPY.standing("관습대로", "recurring", answer));
  assert.match(homePetitionView(recurring)!.standing, /"관습대로".*모두 올리라는 규칙.*청지기가 그 방침대로/);
  // A large sum brought it (escalated "amount"): it says so.
  const large = { ...recurring, stewardship: { ...recurring.stewardship, petitions: recurring.stewardship.petitions.map(entry => entry.id === petition.id ? { ...entry, escalated: "amount" as const } : entry) } };
  assert.match(homePetitionView(large)!.standing, /큰 돈이 걸려/);
});

test("the town's request: a proclamation waiting is a card whose answer is the command the lord bot would send", () => {
  const request = { kind: "proclaim_era" } as const;
  const state = { ...firstPetition, agency: { ...firstPetition.agency!, requests: [request] } } as GameState;
  const view = lordRequestView(state)!;
  assert.equal(view.title, "시장도시 선포를 기다립니다");
  assert.deepEqual(view.command, autoplayActionToGameAction(request, state));
  const beat = lordBeats(state).find(entry => entry.kind === "lord_request");
  assert.equal(beat === undefined ? null : decisionModal(beat.decision!), view.command === null ? null : "lord_request");
  const timber = lordRequestView({ ...state, agency: { ...state.agency!, requests: [{ kind: "order_timber", amount: 40 }, request] } } as GameState)!;
  assert.equal(timber.demand, "도시가 시장 상인에게 목재 40개를 주문해 달라고 청합니다.");
  assert.deepEqual(timber.command, { type: "order_timber", amount: 40 });
  assert.equal(timber.more, "요청 2건 가운데 첫째");
});

test("DEC-CARD: the town's request is the heavy card — the request's words, its stake, no deadline, and the grant's now / later from the engine", () => {
  for (const request of [{ kind: "order_timber", amount: 40 } as const, { kind: "proclaim_era" } as const]) {
    const state = { ...firstPetition, agency: { ...firstPetition.agency!, requests: [request] } } as GameState;
    const view = lordRequestView(state)!;
    const card = lordRequestCard(state)!;
    assert.equal(card.situation, view.demand);
    assert.ok(card.stake !== "" && card.deadline !== null, request.kind);
    assert.deepEqual(card.choices.map(choice => choice.id), ["grant"]);
    const [grant] = card.choices;
    const after = afterAnswer(state, view.command!);
    assert.equal(grant!.refusal === null, after !== null, `${request.kind}: shut exactly when the engine refuses it`);
    if (after !== null) {
      const outcome = lordOutcome(state, after, answerOutlook(state, view.command!)!);
      assert.deepEqual([grant!.now, grant!.later, grant!.remembers], [outcome.now, outcome.later, outcome.remembers], request.kind);
    }
    const markup = renderToStaticMarkup(createElement(LordRequestModal, { view, card, onGrant: () => undefined, onLater: () => undefined }));
    // DEC-CARD: the situation and the stake always; now / later / who remembers exactly where an open answer has lines (an empty part is left out).
    for (const part of ["무슨 일인가", "걸린 것"]) assert.ok(markup.includes(part), part);
    const open = card.choices.filter(choice => choice.refusal === null);
    for (const [part, has] of [["지금", open.some(c => c.now.length > 0)], ["나중에", open.some(c => c.later.length > 0)], ["기억하는 이", open.some(c => c.remembers.length > 0)]] as const) assert.equal(markup.includes(`class="decision-card-part-head">${part}</span>`), has, part);
    assert.match(markup, /data-lord-request="/);
    assert.doesNotMatch(markup, /ui-btn--primary/);
  }
  const timber = { ...firstPetition, agency: { ...firstPetition.agency!, requests: [{ kind: "order_timber", amount: 40 }] } } as GameState;
  // DEC-CARD-2: the order the command leaves is the outlook's later key (timber_order).
  assert.ok(lordRequestCard(timber)!.choices[0]!.later.includes("시장 상인에게 목재 40단을 주문해 둡니다. 상인이 가져오는 대로 들어옵니다."), "the order the command leaves");
});

test("MANOR-1: the lord's chips look at the manor's middle tile, not its top-left one", () => {
  const manor = firstPetition.buildings.find(building => building.kind === "manor_house")!;
  const size = buildingFootprint(manor);
  const beat = lordBeats(firstPetition).find(entry => entry.kind === "home_petition")!;
  assert.deepEqual(beat.tile, { tx: manor.tx + Math.floor((size.width - 1) / 2), ty: manor.ty + Math.floor((size.height - 1) / 2) });
  assert.equal(size.width, 3, "the 3 × 3 manor");
});

test("the court line: the king at the date (kingAt), the old lord by the engine's age, a minor lord's guardian", () => {
  const at = (year: number, season: number) => ({ ...firstPetition, tick: (year - 1300) * 4 * SEASON + season * SEASON });
  assert.match(courtLine(at(1399, 1)), /1399년 여름 · 국왕 리처드 2세/);
  assert.match(courtLine(at(1399, 2)), /1399년 가을 · 국왕 헨리 4세/);
  const people = firstPetition.persons!.people;
  const lord = manorLord(people, lordHouse(firstPetition).order, 1301)!;
  const aged = (birthYear: number) => ({ ...firstPetition, persons: { ...firstPetition.persons!, people: people.map(person => person.id === lord.id ? { ...person, birthYear } : person) } });
  assert.match(courtLine(aged(1240)), /· 늙은 영주 .+\(61살\)$/);
  assert.match(courtLine(aged(1260)), /· 영주 .+\(41살\)$/);
  // A minor lord: the engine's own wardship (mother → adult kin → the overlord).
  const minor = aged(1290);
  const ward = beginWardship(minor, minor.tick, manorLord(minor.persons.people, lordHouse(minor).order, 1301)!);
  assert.match(courtLine(ward), /· 영주 .+\(11살\) · (후견인 .+|후견: 상위 영주)$/);
});

test("LM-R1 the chronicle's factions in lord mode: the five the start introduces, then those the lord has dealt with", () => {
  const ids = (state: GameState) => factionRows(state).map(row => row.id as string).sort();
  assert.deepEqual(ids(firstPetition), [...lordSliceFactionsMet(firstPetition)].sort());
  for (const id of LORD_SLICE_FACTIONS) assert.ok(ids(firstPetition).includes(id), id);
  const unmet = (firstPetition.factions?.factions ?? []).filter(faction => !lordSliceFactionsMet(firstPetition).includes(faction.id));
  assert.ok(unmet.length > 0, "the slice holds factions not met yet");
  for (const faction of unmet) assert.equal(ids(firstPetition).includes(faction.id), false, faction.id);
  // Outside lord mode (no agency) every faction is listed, as before.
  const { agency: _agency, ...sandbox } = firstPetition;
  assert.equal(factionRows(sandbox as GameState).length, firstPetition.factions?.factions.length);
});

test("LM-R1 (Astra B02): the direction layer opens with the lord's first answer, and its pin opens the lord's conditions", () => {
  const before = directionAccess(firstPetition);
  assert.deepEqual(before, { open: false, lock: "petition" });
  const petition = open(firstPetition);
  const answered = gameReducer(firstPetition, { type: "answer_estate_petition", petitionId: petition.id, grant: true });
  assert.deepEqual(directionAccess(answered), { open: true, lock: "petition" });
  // The tutorial's access carries it in every branch (off, running, finished).
  for (const [enabled, index] of [[false, 0], [true, 0], [true, 999]] as const) {
    assert.equal(tutorialAccess(enabled, index, false, directionAccess(answered)).layers.direction, true);
    assert.equal(tutorialAccess(enabled, index, false, before).layers.direction, false);
  }
  const pins = (state: GameState) => renderToStaticMarkup(createElement(CommandPins, { state, onPublicWork: () => undefined, onZone: () => undefined,
    direction: { open: directionAccess(state).open, onOpen: () => undefined } }));
  assert.match(pins(firstPetition), /data-command-pin="direction" aria-disabled="true"/);
  assert.doesNotMatch(pins(answered), /data-command-pin="direction" aria-disabled="true"/);
  // Outside lord mode there are no conditions to set: shut, and it says lord mode.
  const campaign = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!;
  assert.deepEqual(directionAccess(campaign), { open: false, lock: "lord_mode" });
});

test("LR1-D5: a home petition's roundel holds the lord house's arms, as the lordship screen shows them", () => {
  const view = homePetitionView(firstPetition)!;
  assert.deepEqual(view.arms, lordHouseArms(firstPetition));
  // LM-R3: the label reads the house in Korean, never the engine's Latin name.
  assert.match(view.armsLabel, new RegExp(GENTRY_NAMES_KO[lordHouse(firstPetition).name]!));
  assert.doesNotMatch(view.armsLabel, /[A-Za-z]/);
  const card = homePetitionCard(firstPetition)!;
  const markup = renderToStaticMarkup(createElement(DecisionCard, { view: card, crest: { arms: view.arms, label: view.armsLabel }, onChoose: () => undefined, onLater: () => undefined }));
  assert.match(markup, /class="petition-roundel"/);
});

test("DEC-CARD: the home petition's card says what is happening, what is at stake, and each answer's now / later / who remembers — the engine's own", () => {
  const view = homePetitionView(firstPetition)!;
  const card = homePetitionCard(firstPetition)!;
  assert.equal(card.subjectId, view.petitionId);
  assert.ok(card.situation.length > 0 && card.stake.length > 0 && card.deadline !== null);
  for (const choice of card.choices) {
    const after = gameReducer(firstPetition, { type: "answer_estate_petition", petitionId: view.petitionId, grant: choice.id === "grant" });
    assert.notEqual(after, firstPetition, "an answer the engine takes");
    assert.equal(choice.refusal, null);
    const moved = treasuryBalance(after) - treasuryBalance(firstPetition);
    assert.equal(choice.now.length, 1, "the treasury's line, in words");
    assert.equal(/그대로/.test(choice.now[0]!), moved === 0, `${choice.id}: ${choice.now[0]} (${moved})`);
    assert.ok(choice.later.length > 0, "what follows (the kind's standing policy)");
    assert.ok(choice.remembers.every(entry => entry.who.length > 0 && entry.how.length > 0 && entry.delta !== 0));
  }
  const markup = renderToStaticMarkup(createElement(DecisionCard, { view: card, onChoose: () => undefined, onLater: () => undefined }));
  for (const part of ["무슨 일인가", "걸린 것", "지금", "나중에", "기억하는 이"]) assert.ok(markup.includes(part), part);
  assert.doesNotMatch(markup, /ui-btn--primary/, "equal answers, all secondary (LR1-D2)");
  assert.doesNotMatch(markup, /\stitle="/);
});
