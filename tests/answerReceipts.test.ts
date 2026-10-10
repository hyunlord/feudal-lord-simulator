import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { diplomacyOf } from "../src/engine/negotiation";
import { pendingAudits, stewardshipOf } from "../src/engine/stewardship";
import type { AuditRecord, EstatePetition, StewardRecord } from "../src/engine/stewardship.types";
import { initialAgency } from "../src/engine/townAgency";
import { MERCHANT_GAUGE_START, type PetitionResponse } from "../src/content/chapterConfig";
import { lordshipOf } from "../src/engine/lordshipState";
import { initialPolitics } from "../src/engine/politics";
import { famineCard } from "../src/ui/decisionCard/families/famineCard";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import type { PetitionDefId } from "../src/ui/petitionPresentation";
import { famineState, petitionStates } from "./helpers/deccardCampaignStates";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { AnswerReceipt } from "../src/ui/decisionCard/AnswerReceipt";
import { answerMeta, answerReceipt, receiptRows, type ReceiptRow } from "../src/ui/decisionCard/answerReceiptModel";
import { homePetitionCard } from "../src/ui/decisionCard/families/homePetitionCard";
import { auditDecisionView, marriageDecisionView, offMapPetitionView } from "../src/ui/lord/decisions/decisionCardsModel";
import { lordRequestView, openHomePetitions } from "../src/ui/lordCardsModel";
import { moneyDelta, moneyShort } from "../src/ui/money.ko";
import { registryOfferView } from "../src/ui/registryCardModel";
import type { DecisionCardView } from "../src/ui/decisionCard/decisionCardTypes";
import { dateWord } from "../src/ui/decisionCard/answerWords";
import { lordMattersDue } from "../src/engine/lordDue";
import { lordMatterBeats } from "../src/ui/lord/decisions/lordMatterBeats";
import { LORD_MATTERS_COPY } from "../src/ui/lord/decisions/lordMattersCopy.ko";
import { DECISION_CARDS_COPY as CARDS_COPY } from "../src/ui/lord/decisions/decisionCardsCopy.ko";

// RECEIPTS (user 2026-10-10, "결과가 티가 안 난다"): once the lord answers a heavy decision its card turns over to the
// answer's receipt, and every real change of the answer shows there at once with its number. Here each target decision
// and answer runs through the store's reducer as the screen does, the state before and after is diffed field by field
// (the test's own walk over the state, not the receipt's), and each change must be on the receipt with the same number.
// In-process states (the v49 fixture with the decision put in) always run; the real lord-slice states from the DGX run
// too when their folders are given (LMR2_STATES, LMR1_PETITION_STATES, LORD_STATES, VARIANT_STATES).

const minus = (value: number) => `${value < 0 ? "−" : ""}${Math.abs(value)}`;
const signed = (delta: number) => `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
const points = (delta: number, from: number, to: number) => `${signed(delta)} (${minus(from)} → ${minus(to)})`;

type Expected = Readonly<{ key: string; change?: string }>;

/** The numbers an answer moved, walked off the two states (each with the receipt row it must have, and its words for a number). */
function expectedChanges(before: GameState, after: GameState): readonly Expected[] {
  const out: Expected[] = [];
  if (after.treasuryCoin !== before.treasuryCoin) {
    out.push({ key: "treasury", change: `${moneyDelta(after.treasuryCoin - before.treasuryCoin)} (${moneyShort(before.treasuryCoin)} → ${moneyShort(after.treasuryCoin)})` });
  }
  for (const entry of after.factions?.factions ?? []) {
    const old = before.factions?.factions.find(item => item.id === entry.id)?.relation;
    if (old !== undefined && old !== entry.relation) out.push({ key: `relation:${entry.id}`, change: points(entry.relation - old, old, entry.relation) });
  }
  for (const [id, value] of Object.entries(after.diplomacy?.relations ?? {})) {
    const old = before.diplomacy?.relations[id] ?? 0;
    if (old !== value) out.push({ key: `house:${id}`, change: points(value - old, old, value) });
  }
  for (const entry of stewardshipOf(after).oversight) {
    const old = stewardshipOf(before).oversight.find(item => item.estateId === entry.estateId);
    if (old === undefined) continue;
    for (const group of ["tenants", "merchants"] as const) {
      if (old[group] !== entry[group]) out.push({ key: `goodwill:${entry.estateId}:${group}`, change: points(entry[group] - old[group], old[group], entry[group]) });
    }
    if (old.mode !== entry.mode) out.push({ key: `mode:${entry.estateId}` });
    if (old.stewardId !== entry.stewardId) out.push({ key: `steward:${entry.estateId}` });
    if (old.auditMode !== entry.auditMode) out.push({ key: `audit:${entry.estateId}` });
  }
  for (const entry of stewardshipOf(after).stewards) {
    const old = stewardshipOf(before).stewards.find(item => item.personId === entry.personId);
    if (old !== undefined && old.loyalty !== entry.loyalty) out.push({ key: `loyalty:${entry.personId}`, change: points(entry.loyalty - old.loyalty, old.loyalty, entry.loyalty) });
  }
  if ((after.agency?.duesPermille ?? 1000) !== (before.agency?.duesPermille ?? 1000)) out.push({ key: "dues" });
  if (after.agency?.policy !== before.agency?.policy) out.push({ key: "policy" });
  if ((after.timberOrder ?? 0) !== (before.timberOrder ?? 0)) out.push({ key: "timber" });
  if (after.era !== before.era) out.push({ key: "era" });
  if (after.constructionSites.length > before.constructionSites.length) out.push({ key: "sites" });
  const [was, now] = [estatesOf(before), estatesOf(after)];
  for (const claim of now.claims) {
    const old = was.claims.find(item => item.id === claim.id);
    if (old === undefined) { out.push({ key: `claim:${claim.id}` }); continue; }
    if (old.strength !== claim.strength) out.push({ key: `claim:${claim.id}:strength`, change: `힘 ${points(claim.strength - old.strength, old.strength, claim.strength)}` });
    if (claim.evidence.length > old.evidence.length) out.push({ key: `claim:${claim.id}:evidence` });
  }
  for (const suit of now.suits) {
    const old = was.suits.find(item => item.id === suit.id);
    if (old === undefined) { out.push({ key: `suit:${suit.id}` }); continue; }
    if (old.costs !== suit.costs) out.push({ key: `suit:${suit.id}:costs`, change: `들인 비용 ${moneyDelta(suit.costs - old.costs)} (${moneyShort(old.costs)} → ${moneyShort(suit.costs)})` });
    if (old.stage !== suit.stage) out.push({ key: `suit:${suit.id}:stage` });
  }
  for (const estate of now.estates) {
    const old = was.estates.find(item => item.id === estate.id);
    if (old !== undefined && old.annualValue !== estate.annualValue) out.push({ key: `value:${estate.id}` });
    if (old !== undefined && old.possessor !== estate.possessor) out.push({ key: `possession:${estate.id}` });
  }
  for (const record of after.diplomacy?.promises ?? []) {
    const old = before.diplomacy?.promises.find(item => item.id === record.id);
    if (old === undefined || old.status !== record.status) out.push({ key: `promise:${record.id}` });
  }
  for (const offer of after.diplomacy?.negotiations ?? []) {
    if (!(before.diplomacy?.negotiations ?? []).some(item => item.id === offer.id)) out.push({ key: `offer:${offer.id}` });
  }
  for (const term of after.registry?.terms ?? []) if (!(before.registry?.terms ?? []).some(item => item.id === term.id)) out.push({ key: `term:${term.id}` });
  out.push(...politicalChanges(before, after));
  return out;
}

/** RECEIPTS-2: what the famine's and the political petitions' answers move (the test's own walk, as above). */
function politicalChanges(before: GameState, after: GameState): readonly Expected[] {
  const out: Expected[] = [];
  if (after.population !== before.population) out.push({ key: "population", change: points(after.population - before.population, before.population, after.population) });
  const lived = (state: GameState) => state.houses.filter(house => house.residents > 0).length;
  if (lived(after) !== lived(before)) out.push({ key: "houses", change: points(lived(after) - lived(before), lived(before), lived(after)) });
  const gauge = (state: GameState) => state.politics?.merchantGauge ?? MERCHANT_GAUGE_START;
  if (gauge(after) !== gauge(before)) out.push({ key: "gauge", change: points(gauge(after) - gauge(before), gauge(before), gauge(after)) });
  const rights = (state: GameState) => new Set((state.politics?.rights ?? []).map(right => right.id));
  for (const id of rights(after)) if (!rights(before).has(id)) out.push({ key: `right:${id}` });
  for (const id of rights(before)) if (!rights(after).has(id)) out.push({ key: `right:${id}` });
  const [lordWas, lordNow] = [lordshipOf(before), lordshipOf(after)];
  if (lordWas.titleDemoted !== lordNow.titleDemoted) out.push({ key: "title" });
  if (lordNow.titleReturnsTick !== undefined && lordNow.titleReturnsTick !== lordWas.titleReturnsTick) out.push({ key: "title:returns" });
  if ((lordWas.decline === null) !== (lordNow.decline === null)) out.push({ key: "decline" });
  if (lordNow.decline === null && lordWas.decline?.lost != null) out.push({ key: `right-back:${lordWas.decline.lost}` });
  if (lordNow.decline?.petitionFrom !== undefined && lordNow.decline.petitionFrom !== lordWas.decline?.petitionFrom) out.push({ key: "decline:again" });
  const [warWas, warNow] = [before.war, after.war];
  if (warNow !== undefined) {
    if (warWas !== undefined && warWas.favour !== warNow.favour) out.push({ key: "favour" });
    if (warNow.conscripts !== undefined && warNow.conscripts !== warWas?.conscripts) out.push({ key: "conscripts" });
    for (const [index, due] of warNow.instalments.slice(warWas?.instalments.length ?? 0).entries()) out.push({ key: `instalment:${due.category}:${index}` });
    if ((warNow.taxSeasonsLeft ?? 0) > (warWas?.taxSeasonsLeft ?? 0)) out.push({ key: "war-tax" });
    if (warNow.wall !== undefined && warNow.wall !== warWas?.wall) out.push({ key: "war-wall" });
  }
  if (after.plague?.curacy?.by !== undefined && after.plague.curacy.by !== before.plague?.curacy?.by) out.push({ key: "curacy" });
  if ((after.reorganisation?.guild ?? null) !== null && (before.reorganisation?.guild ?? null) === null) out.push({ key: "guild" });
  const [was, now] = [before.legacy, after.legacy];
  if (now !== undefined) {
    for (const key of ["royalSubsidy", "endowment", "feeFarm"] as const) {
      const [from, to] = [was?.[key] ?? 0, now[key]];
      if (from !== to) out.push({ key: `legacy:${key}`, change: `${moneyDelta(to - from)} (${moneyShort(from)} → ${moneyShort(to)})` });
    }
    if ((was?.backlash ?? 0) !== now.backlash) out.push({ key: "legacy:backlash", change: points(now.backlash - (was?.backlash ?? 0), was?.backlash ?? 0, now.backlash) });
    if (now.naveRebuilt === true && was?.naveRebuilt !== true) out.push({ key: "legacy:nave" });
    if (now.legacy !== undefined && now.legacy !== was?.legacy) out.push({ key: "legacy:legacy" });
    if (now.mayorId !== undefined && now.mayorId !== was?.mayorId) out.push({ key: "legacy:mayor" });
    if (now.heir !== undefined && now.heir.personId !== was?.heir?.personId) out.push({ key: "legacy:heir" });
    if (now.family !== undefined && now.family !== was?.family) out.push({ key: "legacy:family" });
  }
  const [peopleWas, peopleNow] = [before.persons?.people ?? [], after.persons?.people ?? []];
  const [ids, still] = [new Set(peopleWas.map(entry => entry.id)), new Set(peopleNow.map(entry => entry.id))];
  if (peopleWas.some(entry => !still.has(entry.id))) out.push({ key: "people:left" });
  if (peopleNow.some(entry => !ids.has(entry.id))) out.push({ key: "people:joined" });
  // A family member's place or mark moved (the old head to kin, a candidate into the family): the heir's row says it.
  const role = new Map(peopleWas.map(entry => [entry.id, `${entry.role}|${(entry.tags ?? []).join(",")}`] as const));
  if (peopleNow.some(entry => role.has(entry.id) && role.get(entry.id) !== `${entry.role}|${(entry.tags ?? []).join(",")}`)) out.push({ key: "legacy:heir" });
  return out;
}

/**
 * Every changed leaf of the state, but for the bookkeeping the lord does not read as a number (the ledgers' own records,
 * the decision trace, memories, an answered thing's own status — the receipt's title says the answer): each must be one
 * the receipt walks (`expectedChanges`), so an answer that starts to move something new is caught here.
 */
const BOOKKEEPING = [/^\.(history|trace|ledger|tick|rngState|lastCommand|commandLog)\b/, /\.memory\b/, /\.timeline\b/, /^\.registry\.occurrences/, /^\.registry\.(seasonDraws|seen|draws)/,
  /^\.stewardship\.(petitions|audits)\[[^\]]+\]\.(status|decidedBy|policy)$/, /^\.stewardship\.audits\[/, /\.since$/, /\.settledTick$/, /^\.stewardship\.stewards\[[^\]]+\]\.status$/,
  /^\.agency\.duesAgreement\.(tick|occurrenceId)$/, /^\.diplomacy\.marriage\./, /^\.estates\.people\[/, /^\.constructionSites\[/, /^\.palisade$/, /^\.wallConstructionReserve$/,
  /^\.eraProclaimedTick$/, /^\.next[A-Z]\w*$/, /^\.stewardship\.next/, /^\.estates\.next/, /^\.diplomacy\.next/, /^\.registry\.next/, /^\.agency\.next/,
  // RECEIPTS-2: the famine's and the petition's own answer (the receipt's title says it), the chronicle's decision records,
  // a house's abandoned mark (its residents are read), the persons' biographies of those who left (the row names them).
  /^\.events\.records\[[^\]]+\]\.response$/, /^\.politics\.petitions\[[^\]]+\]\.(response|respondedTick)$/, /^\.politics\.decisions\[/,
  /^\.(war|plague|reorganisation|legacy)\.answers\./, /^\.houses\[[^\]]+\]\.abandonedTick$/, /^\.persons\.past\[/];
const WATCHED = [/^\.treasuryCoin$/, /^\.factions\.factions\[[^\]]+\]\.relation$/, /^\.diplomacy\.relations\./, /^\.stewardship\.oversight\[[^\]]+\]\.(tenants|merchants|mode|stewardId|auditMode)$/,
  /^\.stewardship\.stewards\[[^\]]+\]\.loyalty$/, /^\.stewardship\.rules\./, /^\.agency\.(policy|duesPermille|subsidies|duesAgreement\.(permille|faction))/, /^\.timberOrder$/,
  /^\.wallConstructionPriority$/, /^\.era$/, /^\.estates\.(claims|suits|estates)\[/, /^\.diplomacy\.(promises|negotiations)\[/, /^\.registry\.terms\[/,
  /^\.population$/, /^\.houses\[[^\]]+\]\.residents$/, /^\.politics\.merchantGauge$/, /^\.politics\.rights\[[^\]]+\]$/,
  /^\.lordship\.(titleDemoted|titleReturnsTick|decline(\.petitionFrom)?)$/, /^\.war\.(favour|conscripts|taxSeasonsLeft|wall)$/, /^\.war\.instalments\[[^\]]+\]$/,
  /^\.plague\.curacy\.(filledTick|by)$/, /^\.reorganisation\.guild$/, /^\.legacy\.(royalSubsidy|endowment|feeFarm|backlash|naveRebuilt|legacy|mayorId|heir|family)$/,
  /^\.persons\.people\[[^\]]+\](\.(role|tags)\b.*)?$/];

function changedLeaves(a: unknown, b: unknown, path: string, out: string[]) {
  if (a === b) return;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) { out.push(path); return; }
  if (Array.isArray(a) && Array.isArray(b)) {
    const key = (item: unknown, index: number) => {
      const record = item as Record<string, unknown> | null;
      return String(record?.id ?? record?.personId ?? record?.estateId ?? index);
    };
    const was = new Map(a.map((item, index) => [key(item, index), item]));
    for (const [index, item] of b.entries()) {
      const id = key(item, index);
      if (!was.has(id)) out.push(`${path}[${id}]`); else changedLeaves(was.get(id), item, `${path}[${id}]`, out);
    }
    return;
  }
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (path === "" && (name === "tiles" || name === "workers" || name === "buildings" || name === "households" || name === "walkers")) continue;
    changedLeaves((a as Record<string, unknown>)[name], (b as Record<string, unknown>)[name], `${path}.${name}`, out);
  }
}

/** One answer through the store's reducer, then its receipt against the state's own change. */
function checkAnswer(label: string, before: GameState, command: GameAction, card: DecisionCardView | null, choiceId: string): readonly ReceiptRow[] {
  const after = gameReducer(before, command);
  assert.notEqual(after, before, `${label}: the engine takes the answer`);
  const rows = card === null ? receiptRows(before, after) : answerReceipt(before, after, answerMeta(card, choiceId)).rows;
  const byKey = new Map(rows.map(row => [row.key, row] as const));
  for (const expected of expectedChanges(before, after)) {
    const row = byKey.get(expected.key);
    assert.ok(row !== undefined, `${label}: ${expected.key} changed but the receipt has no row for it (rows: ${rows.map(entry => entry.key).join(", ")})`);
    if (expected.change !== undefined) assert.equal(row.change, expected.change, `${label}: ${expected.key}`);
  }
  const leaves: string[] = [];
  // A part the state did not hold yet is walked as the engine reads it (its `…Of` default), so only what moved shows.
  const filled = (state: GameState): GameState => ({ ...state, estates: estatesOf(state), diplomacy: diplomacyOf(state),
    politics: state.politics ?? initialPolitics(state), lordship: lordshipOf(state) });
  changedLeaves(filled(before), filled(after), "", leaves);
  const unread = leaves.filter(path => !BOOKKEEPING.some(rule => rule.test(path)) && !WATCHED.some(rule => rule.test(path)));
  assert.deepEqual(unread, [], `${label}: changed but neither on the receipt nor bookkeeping`);
  if (card !== null) {
    const view = answerReceipt(before, after, answerMeta(card, choiceId));
    assert.equal(view.title, card.title);
    assert.equal(view.answer, card.choices.find(choice => choice.id === choiceId)!.label);
  }
  return rows;
}

// --- in-process states: the v49 fixture with each decision put in ------------------------------------------------------

function base(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v49/chapter-two-town.save.json"))).envelope.state;
  return { ...state, tick: 100, agency: initialAgency(), trace: { decisions: [], acts: [] } };
}

function withOffMapPetition(): { state: GameState; estateId: string } {
  const state = base();
  const estate = estatesOf(state).estates.find(row => row.id !== "estate-home");
  assert.ok(estate);
  const petition: EstatePetition = { id: "receipt-offmap", estateId: estate.id, kind: "repair", group: "tenants", amount: 40,
    rights: false, marriage: false, tick: 0, deadline: 1000, status: "open", escalated: "amount" };
  return { estateId: estate.id, state: { ...state, stewardship: { ...stewardshipOf(state),
    oversight: [{ estateId: estate.id, mode: "direct", stewardId: "receipt-receiver", auditMode: "accounts", tenants: 10, merchants: 0, undetected: 0, since: 0 }],
    petitions: [petition] } } };
}

function withAudit(): GameState {
  const { state, estateId } = withOffMapPetition();
  const steward = (personId: string, status: StewardRecord["status"]): StewardRecord => ({ personId, estateId, ability: 50, loyalty: 45, disposition: "greedy",
    connection: "bishop", since: 0, kept: 0, errors: 0, status });
  const audit: AuditRecord = { id: "receipt-audit", estateId, tick: state.tick, stewardId: "receipt-steward", mode: "visit", revealedKept: 120, revealedErrors: 30,
    hidden: 0, status: "pending", deadline: state.tick + 1000 };
  return { ...state, stewardship: { ...stewardshipOf(state), petitions: [],
    oversight: [{ estateId, mode: "steward", stewardId: "receipt-steward", auditMode: "visit", tenants: -20, merchants: 5, undetected: 0, since: 0 }],
    stewards: [steward("receipt-steward", "serving"), steward("receipt-next", "candidate")], audits: [audit] } };
}

test("an off-map estate's petition granted and refused: the receipt says each real change with its number", () => {
  const { state } = withOffMapPetition();
  const petitionId = "receipt-offmap";
  for (const grant of [true, false]) {
    const rows = checkAnswer(`offmap ${grant}`, state, { type: "answer_estate_petition", petitionId, grant }, null, grant ? "grant" : "refuse");
    assert.ok(rows.length > 0, "the answer moved something the lord sees");
  }
});

test("an audit's finding punished and tolerated: the treasury recovered, the steward's place or loyalty, with numbers", () => {
  const state = withAudit();
  assert.equal(pendingAudits(state).length, 1);
  for (const choice of ["punish", "tolerate", "replace"] as const) {
    const rows = checkAnswer(`audit ${choice}`, state, { type: "answer_audit", auditId: "receipt-audit", choice }, null, choice);
    if (choice === "tolerate") assert.ok(rows.some(row => row.key === "loyalty:receipt-steward"), "tolerated: the steward's loyalty");
    else assert.ok(rows.some(row => row.key.startsWith("steward:")), `${choice}: the estate's new steward`);
    if (choice === "punish") assert.ok(rows.some(row => row.key === "treasury"), "punished: what is recovered");
  }
});

test("the receipt view: the answer, one row per change, the later lines, one primary", () => {
  const state = withAudit();
  const after = gameReducer(state, { type: "answer_audit", auditId: "receipt-audit", choice: "punish" });
  const view = answerReceipt(state, after, { family: "audit", subjectId: "receipt-audit", title: "T", answer: "A", later: ["L1"] });
  const html = renderToStaticMarkup(createElement(AnswerReceipt, { view, onClose: () => undefined }));
  assert.equal((html.match(/class="answer-receipt-row"/g) ?? []).length, view.rows.length);
  assert.equal((html.match(/ui-btn--primary/g) ?? []).length, 1, "one primary");
  assert.match(html, /data-answer-receipt="audit"/);
  assert.match(html, /L1/);
  const none = renderToStaticMarkup(createElement(AnswerReceipt, { view: { ...view, rows: [] }, onClose: () => undefined }));
  assert.match(none, /answer-receipt-none/);
});

test("the receipt's own rows for the town's conditions, from a plain before and after", () => {
  const state = base();
  const after: GameState = { ...state, era: state.era === "hamlet" ? "palisade" : "hamlet", timberOrder: 8, wallConstructionPriority: "priority",
    agency: { ...state.agency!, policy: state.agency!.policy === "growth" ? "revenue" : "growth", duesPermille: 1150,
      subsidies: [{ id: "s1", kind: "farmstead", amount: 10 }] } };
  const keys = receiptRows(state, after).map(row => row.key);
  for (const key of ["era", "timber", "wall", "policy", "dues", "subsidy:farmstead"]) assert.ok(keys.includes(key), key);
  const dues = receiptRows(state, after).find(row => row.key === "dues")!;
  assert.match(dues.change, /100%.*115%/);
});

// RECEIPTS-2 (user 2026-10-10): the famine's and every political petition's answers, on the campaign's own states (the
// famine arriving, each petition kind's card open — tests/helpers/deccardCampaignStates).
function famineAndPetitionAnswers(name: string, state: GameState, seen: Set<string>) {
  const famine = famineCard(state);
  if (famine !== null) for (const choice of famine.card.choices.filter(entry => entry.refusal === null)) {
    checkAnswer(`${name} famine ${choice.id}`, state, { type: "famine_response", choice: choice.id as "relief" }, famine.card, choice.id);
    seen.add(`famine:${choice.id}`);
  }
  const petition = petitionCard(state);
  if (petition !== null) for (const choice of petition.card.choices.filter(entry => entry.refusal === null)) {
    checkAnswer(`${name} petition ${petition.defId} ${choice.id}`, state, { type: "petition_response", petitionId: petition.petitionId, response: choice.id as "accept" },
      petition.card, choice.id);
    seen.add(`petition:${petition.defId}:${choice.id}`);
  }
}

test("the famine's four answers and every political petition's: the receipt says each real change with its number", () => {
  const seen = new Set<string>();
  famineAndPetitionAnswers("famine", famineState(), seen);
  for (const [defId, state] of petitionStates()) famineAndPetitionAnswers(defId, state, seen);
  for (const choice of ["relief", "price_control", "laissez_faire", "speculation"]) assert.ok(seen.has(`famine:${choice}`), `famine ${choice}`);
  for (const defId of petitionStates().keys()) assert.ok([...seen].some(key => key.startsWith(`petition:${defId}:`)), `${defId} answered`);
});

test("the political rows read as the card's own words: a right granted, the decline bought back, the war's men, the heir", () => {
  const states = petitionStates();
  const rows = (defId: PetitionDefId, response: PetitionResponse) => {
    const state = states.get(defId)!;
    const card = petitionCard(state)!;
    return answerReceipt(state, gameReducer(state, { type: "petition_response", petitionId: card.petitionId, response }), answerMeta(card.card, response)).rows;
  };
  const charter = rows("market_charter", "accept");
  assert.ok(charter.some(row => row.key === "right:market_charter" && /좌판세/.test(row.change)), "the charter's right and its stall fee");
  assert.ok(charter.some(row => row.key === "gauge"), "the merchants' gauge");
  const restore = rows("restore_right", "accept");
  for (const key of ["treasury", "title", "decline"]) assert.ok(restore.some(row => row.key === key), `the right bought back: ${key}`);
  const levy = rows("levy_response", "accept");
  assert.ok(levy.some(row => row.key === "conscripts" && /명/.test(row.change)), "the men levied and when they come back");
  const heir = rows("heir_choice", "accept");
  assert.ok(heir.some(row => row.key === "legacy:heir" && row.change.includes("→")), "who heads the family, from whom to whom");
});

// --- the real lord-slice states (the DGX folders), every target decision and answer ------------------------------------

/** The states each folder holds (scripts/lmr2States.ts, lmr1PetitionStates.ts, lmr1LordStates.ts + eventArtStates.ts, variantStates.ts). */
const FOLDERS: Readonly<Record<string, readonly string[]>> = {
  LMR2_STATES: ["attention-overloaded", "audit-pending", "contested", "inherited", "marriage-contracted", "neighbour-suit", "offer-countered", "promises",
    "suit-defence-enforcing", "suit-defence-patronage", "suit-entry-forced", "suit-entry-threat", "suit-neighbour-took", "will-change"],
  LMR1_PETITION_STATES: ["guardian", "home-ale_fines", "home-boundary_dispute", "home-chancel_repair", "home-common_pasture", "home-heriot", "home-merchet",
    "home-mill_suit", "home-newcomer", "home-pannage", "home-road_bridge", "home-stall_dispute", "home-wardship", "precedent", "request"],
  LORD_STATES: ["lord-receipts", "lord-receipts-old", "registry-offer", "registry-offer-hold"],
  VARIANT_STATES: ["home-041", "home-048", "home-056", "registry-067", "registry-078"],
  // RECEIPTS-2: the campaign's famine and petition states the geometry rows open (scripts/ui{5,6,8,9,10}States.ts).
  UI5_STATES: ["famine-arrival", "petition-open"],
  UI6_STATES: ["levy_response", "refugee_admission", "wall_or_market", "war_funding", "wool_payment"],
  UI8_STATES: ["cash_rent", "land_redistribution", "vacant_priest", "wages"],
  UI9_STATES: ["borough_charter", "cloth_or_grain", "guild_charter", "tax_collection"],
  UI10_STATES: ["borough_autonomy", "church_rebuilding", "guild_dispute", "heir_choice", "legacy_choice", "royal_tax", "extra/heir_choice"],
};
const CAMPAIGN = ["UI5_STATES", "UI6_STATES", "UI8_STATES", "UI9_STATES", "UI10_STATES"];

function realStates(): readonly { name: string; state: GameState }[] {
  return Object.entries(FOLDERS).flatMap(([env, names]) => {
    const dir = process.env[env];
    if (dir === undefined) return [];
    return names.map(name => join(dir, `${name}.json`)).filter(file => existsSync(file))
      .map(file => ({ name: `${env}/${file.slice(dir.length + 1)}`, state: JSON.parse(readFileSync(file, "utf8")) as GameState }));
  });
}

test("on the campaign's real states: the famine's every answer and every political petition's", t => {
  const states = realStates().filter(entry => CAMPAIGN.some(env => entry.name.startsWith(`${env}/`)));
  if (states.length === 0) { t.skip("no campaign state folder given (UI5_STATES, UI6_STATES, UI8_STATES, UI9_STATES, UI10_STATES)"); return; }
  const seen = new Set<string>();
  for (const { name, state } of states) famineAndPetitionAnswers(name, state, seen);
  if (states.some(entry => entry.name.startsWith("UI5_STATES/"))) {
    for (const choice of ["relief", "price_control", "laissez_faire", "speculation"]) assert.ok(seen.has(`famine:${choice}`), `famine ${choice}`);
  }
  for (const { name, state } of states) {
    const petition = petitionCard(state);
    if (petition !== null) for (const choice of petition.card.choices.filter(entry => entry.refusal === null)) assert.ok(seen.has(`petition:${petition.defId}:${choice.id}`), `${name} ${choice.id}`);
  }
  assert.ok([...seen].filter(key => key.startsWith("petition:")).length >= 20, `the petitions' answers: ${[...seen].join(", ")}`);
});

test("on the real lord-slice states: home and off-map petitions, audits, registry offers, the will and the town's request", t => {
  const states = realStates().filter(entry => !CAMPAIGN.some(env => entry.name.startsWith(`${env}/`)));
  if (states.length === 0) { t.skip("no state folder given (LMR2_STATES, LMR1_PETITION_STATES, LORD_STATES, VARIANT_STATES)"); return; }
  const seen = new Set<string>();
  for (const { name, state } of states) {
    const home = openHomePetitions(state)[0];
    const homeCard = homePetitionCard(state);
    if (home !== undefined && homeCard !== null) for (const choice of homeCard.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} home ${choice.id}`, state, { type: "answer_estate_petition", petitionId: home.id, grant: choice.id === "grant" }, homeCard, choice.id);
      seen.add(`home:${choice.id}`);
    }
    const offMap = offMapPetitionView(state);
    if (offMap !== null) for (const choice of offMap.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} offmap ${choice.id}`, state, { type: "answer_estate_petition", petitionId: offMap.petitionId, grant: choice.id === "grant" }, offMap.card, choice.id);
      seen.add(`offmap:${choice.id}`);
    }
    const audit = auditDecisionView(state);
    if (audit !== null) for (const choice of audit.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} audit ${choice.id}`, state, { type: "answer_audit", auditId: audit.auditId, choice: choice.id as "punish" }, audit.card, choice.id);
      seen.add(`audit:${choice.id}`);
    }
    const offer = registryOfferView(state);
    if (offer !== null) for (const choice of offer.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} registry ${offer.entryId} ${choice.id}`, state, { type: "answer_registry_offer", occurrenceId: offer.occurrenceId, choiceId: choice.id }, offer.card, choice.id);
      seen.add(`registry:${offer.entryId}`);
    }
    const will = marriageDecisionView(state);
    if (will !== null && will.kind === "will_change") for (const choice of will.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} will ${choice.id}`, state, { type: "answer_will_change", choice: choice.id as "favour" }, will.card, choice.id);
      seen.add(`will:${choice.id}`);
    }
    const request = lordRequestView(state);
    if (request !== null && request.command !== null) { checkAnswer(`${name} request`, state, request.command, null, "grant"); seen.add("request"); }
  }
  if (states.some(entry => entry.name.startsWith("LORD_STATES")) && states.some(entry => entry.name.startsWith("LMR2_STATES"))) {
    assert.ok([...seen].filter(key => key.startsWith("registry:")).length >= 3, `several registry kinds: ${[...seen].join(", ")}`);
  }
  // The targets the task names: both answers of both petitions, the audit's punish and tolerate, several registry kinds.
  for (const key of ["home:grant", "home:refuse", "offmap:grant", "offmap:refuse", "audit:punish", "audit:tolerate"]) {
    if (states.some(entry => entry.name.startsWith("LMR2_STATES")) || !key.startsWith("offmap") && !key.startsWith("audit")) assert.ok(seen.has(key), key);
  }
});

// RECEIPTS (user 2026-10-10): a card whose chip gives the engine's deadline as a season says the same season (the will, the
// audit's finding, the off-map estate's petition: lordMattersDue's dueTick); the home petition and the registry offer say
// days on both, so they agree already.
test("on the real states, the will's, the audit's and the off-map petition's cards say their chip's season", t => {
  const states = realStates().filter(entry => entry.name.startsWith("LMR2_STATES"));
  if (states.length === 0) { t.skip("LMR2_STATES not given"); return; }
  let compared = 0;
  for (const { name, state } of states) {
    const beats = lordMatterBeats(state);
    const due = (kind: string, id: string | undefined) => {
      const tick = lordMattersDue(state).find(matter => matter.kind === kind && matter.id === id)?.dueTick ?? null;
      return tick === null ? null : dateWord(state, tick);
    };
    const audit = auditDecisionView(state);
    if (audit !== null) {
      const date = due("audit", audit.auditId);
      assert.ok(date !== null, `${name}: the audit has the engine's deadline`);
      assert.ok(beats.find(beat => beat.decision === "audit_decision")!.facts.includes(LORD_MATTERS_COPY.auditDue(date)), `${name}: the chip's season`);
      assert.equal(audit.card.deadline, CARDS_COPY.auditDeadline(date, 0), `${name}: the card's season`);
      assert.ok(audit.card.deadline!.startsWith(`${date}까지`));
      compared += 1;
    }
    const offMap = offMapPetitionView(state);
    if (offMap !== null) {
      const date = due("estate_petition", offMap.petitionId);
      assert.ok(date !== null, `${name}: the petition has the engine's deadline`);
      assert.ok(beats.find(beat => beat.decision === "estate_petition_offmap")!.facts.includes(LORD_MATTERS_COPY.petitionDue(date)), `${name}: the chip's season`);
      assert.ok(offMap.card.deadline!.startsWith(`${date}까지`), `${name}: the card's season`);
      compared += 1;
    }
    const will = marriageDecisionView(state);
    if (will !== null && will.kind === "will_change") {
      const date = due("will_change", diplomacyOf(state).marriage?.negotiationId);
      assert.ok(date !== null && will.card.deadline!.startsWith(`${date}까지`), `${name}: the will's card's season`);
      compared += 1;
    }
  }
  assert.ok(compared >= 3, `the will, the audit and the off-map petition compared (${compared})`);
});
