import { BUILDING_COPY } from "../../content/buildingCatalog.ko";
import { SAVE_COPY } from "../../content/saveCopy.ko";
import { wallConstructionPriority } from "../../engine/constructionReserve";
import type { GameState } from "../../engine/engine.types";
import { estatesOf } from "../../engine/estates";
import { diplomacyOf } from "../../engine/negotiation";
import { stewardshipOf } from "../../engine/stewardship";
import { NEGOTIATION_COPY } from "../lord/negotiation/negotiationCopy.ko";
import { ESTATES_COPY } from "../lord/estates/estatesCopy.ko";
import { POLICY_COPY } from "../lord/policyCopy.ko";
import { moneyShort } from "../money.ko";
import { OUTLOOK_COPY } from "./outlookCopy.ko";
import { dateWord, factionWord, holderName } from "./answerWords";
import { estateWord, onWhat } from "./families/lordOutcome";
import { LORD_OUTCOME_WORDS as WORDS } from "./families/lordOutcomeCopy.ko";
import { ANSWER_RECEIPT_COPY as COPY } from "./answerReceiptCopy.ko";
import type { DecisionCardView } from "./decisionCardTypes";

// RECEIPTS (user 2026-10-10, "결과가 티가 안 난다"): what an answer changed, at once and with its numbers — read off the
// store's state just before the answer and just after it (the engine's own reducer ran it; nothing here decides what an
// answer does, P-D4). One row per thing that moved: the treasury, each faction's and house's relation, an estate's
// goodwill, who manages it and how it is audited, a steward's loyalty and place, the steward's rules, the town's
// conditions (policy, dues, subsidies, timber, the wall), claims and suits, possession, an estate's value and a ruling's
// share, promises, registry terms and a marriage offer sent. The card's own "later" lines for the chosen answer follow
// it (what the answer set going). The view holds only words: no state is kept once it is made (LEAK-1).

export type ReceiptRow = Readonly<{ key: string; what: string; change: string }>;
export type AnswerReceiptView = Readonly<{ family: string; subjectId: string; title: string; answer: string; rows: readonly ReceiptRow[]; later: readonly string[] }>;
/** What the screen knew of the answer when it was given: the card's title, the answer's label and its later lines. */
export type AnswerMeta = Readonly<{ family: string; subjectId: string; title: string; answer: string; later: readonly string[] }>;

const row = (key: string, what: string, change: string): ReceiptRow => ({ key, what, change });
const byId = <T, K>(items: readonly T[], id: (item: T) => K) => new Map(items.map(item => [id(item), item] as const));

function treasuryRows(before: GameState, after: GameState): ReceiptRow[] {
  const delta = after.treasuryCoin - before.treasuryCoin;
  return delta === 0 ? [] : [row("treasury", COPY.treasury, COPY.money(delta, before.treasuryCoin, after.treasuryCoin))];
}

/** The town's factions (FX-4 relation) and the houses the lord deals with (diplomacy relations). */
function relationRows(before: GameState, after: GameState): ReceiptRow[] {
  const was = byId(before.factions?.factions ?? [], entry => entry.id);
  const factions = (after.factions?.factions ?? []).flatMap(entry => {
    const old = was.get(entry.id)?.relation ?? entry.relation;
    return entry.relation === old ? [] : [row(`relation:${entry.id}`, COPY.relation(factionWord(after, entry.id)), COPY.points(entry.relation - old, old, entry.relation))];
  });
  const [houseWas, houseNow] = [diplomacyOf(before).relations, diplomacyOf(after).relations];
  const houses = Object.entries(houseNow).flatMap(([id, value]) => {
    const old = houseWas[id] ?? 0;
    return value === old ? [] : [row(`house:${id}`, COPY.relation(holderName(after, id)), COPY.points(value - old, old, value))];
  });
  return [...factions, ...houses];
}

const stewardName = (state: GameState, personId: string) => holderName(state, `person:${personId}`);

/** An estate's goodwill, who manages it, its steward and how it is audited (SW-1…SW-6 oversight). */
function oversightRows(before: GameState, after: GameState): ReceiptRow[] {
  const was = byId(stewardshipOf(before).oversight, entry => entry.estateId);
  return stewardshipOf(after).oversight.flatMap(entry => {
    const old = was.get(entry.estateId);
    if (old === undefined) return [];
    const estate = estateWord(after, entry.estateId);
    const rows = (["tenants", "merchants"] as const).flatMap(group => entry[group] === old[group] ? []
      : [row(`goodwill:${entry.estateId}:${group}`, COPY.goodwill(estate, COPY.groups[group]), COPY.points(entry[group] - old[group], old[group], entry[group]))]);
    if (entry.mode !== old.mode) rows.push(row(`mode:${entry.estateId}`, COPY.management(estate), COPY.change(ESTATES_COPY.modes[old.mode], ESTATES_COPY.modes[entry.mode])));
    if (entry.stewardId !== old.stewardId) rows.push(row(`steward:${entry.estateId}`, COPY.steward(estate), COPY.change(stewardName(before, old.stewardId), stewardName(after, entry.stewardId))));
    if (entry.auditMode !== old.auditMode) rows.push(row(`audit:${entry.estateId}`, COPY.auditMode(estate), COPY.change(ESTATES_COPY.auditModes[old.auditMode], ESTATES_COPY.auditModes[entry.auditMode])));
    return rows;
  });
}

/** A steward's loyalty, and his place when no estate's steward row already says it. */
function stewardRows(before: GameState, after: GameState, said: ReadonlySet<string>): ReceiptRow[] {
  const was = byId(stewardshipOf(before).stewards, entry => entry.personId);
  return stewardshipOf(after).stewards.flatMap(entry => {
    const old = was.get(entry.personId);
    if (old === undefined) return [];
    const name = stewardName(after, entry.personId);
    const rows: ReceiptRow[] = [];
    if (entry.loyalty !== old.loyalty) rows.push(row(`loyalty:${entry.personId}`, COPY.loyalty(name), COPY.points(entry.loyalty - old.loyalty, old.loyalty, entry.loyalty)));
    if (entry.status !== old.status && !said.has(entry.personId)) {
      rows.push(row(`status:${entry.personId}`, COPY.stewardOf(name), COPY.change(COPY.stewardStatus[old.status], COPY.stewardStatus[entry.status])));
    }
    return rows;
  });
}

/** What the steward brings to the lord (SW-5 exception rules). */
function ruleRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [stewardshipOf(before).rules, stewardshipOf(after).rules];
  const amount = (value: number | null) => COPY.rulesAmount(value === null ? null : moneyShort(value));
  const rows: ReceiptRow[] = [];
  if (now.amountAtLeast !== was.amountAtLeast) rows.push(row("rules:amount", COPY.rules, COPY.change(amount(was.amountAtLeast), amount(now.amountAtLeast))));
  for (const key of ["rights", "marriage", "recurring"] as const) {
    if ((now[key] ?? false) !== (was[key] ?? false)) rows.push(row(`rules:${key}`, COPY.rules, COPY.rulesOn(COPY.rulesWhat[key], now[key] ?? false)));
  }
  return rows;
}

const building = (kind: string) => BUILDING_COPY[kind as keyof typeof BUILDING_COPY]?.name ?? kind;

/** The town's conditions the lord sets (TA-6): the estate policy, the stall dues, subsidies, the timber order, the wall. */
function conditionRows(before: GameState, after: GameState): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const [was, now] = [before.agency, after.agency];
  if (now !== undefined && was !== undefined && now.policy !== was.policy) rows.push(row("policy", COPY.policy, COPY.change(POLICY_COPY.policies[was.policy], POLICY_COPY.policies[now.policy])));
  const [duesWas, duesNow] = [was?.duesPermille ?? 1000, now?.duesPermille ?? 1000];
  if (duesNow !== duesWas) rows.push(row("dues", COPY.dues, COPY.change(COPY.duesValue(Math.round(duesWas / 10)), COPY.duesValue(Math.round(duesNow / 10)))));
  // DUES-REL (DTR-18): the rate agreed with a faction, which its later mind is measured against.
  const [agreedWas, agreedNow] = [was?.duesAgreement, now?.duesAgreement];
  if (agreedNow !== undefined && (agreedNow.permille !== agreedWas?.permille || agreedNow.faction !== agreedWas?.faction)) {
    rows.push(row("dues:agreed", COPY.duesAgreed(factionWord(after, agreedNow.faction)),
      COPY.change(agreedWas === undefined ? COPY.none_ : COPY.duesValue(Math.round(agreedWas.permille / 10)), COPY.duesValue(Math.round(agreedNow.permille / 10)))));
  }
  const subsidyWas = new Map((was?.subsidies ?? []).map(entry => [entry.kind, entry.amount] as const));
  const subsidyNow = new Map((now?.subsidies ?? []).map(entry => [entry.kind, entry.amount] as const));
  for (const kind of new Set([...subsidyWas.keys(), ...subsidyNow.keys()])) {
    const [from, to] = [subsidyWas.get(kind) ?? 0, subsidyNow.get(kind) ?? 0];
    if (from !== to) rows.push(row(`subsidy:${kind}`, COPY.subsidy(building(kind)), COPY.money(to - from, from, to)));
  }
  const [timberWas, timberNow] = [before.timberOrder ?? 0, after.timberOrder ?? 0];
  if (timberNow !== timberWas) rows.push(row("timber", COPY.timber, COPY.change(COPY.timberValue(timberWas), COPY.timberValue(timberNow))));
  const [wallWas, wallNow] = [wallConstructionPriority(before), wallConstructionPriority(after)];
  if (wallNow !== wallWas) rows.push(row("wall", COPY.wall, COPY.change(COPY.wallValue[wallWas] ?? wallWas, COPY.wallValue[wallNow] ?? wallNow)));
  if (after.era !== before.era) rows.push(row("era", COPY.era, COPY.change(SAVE_COPY.eraLabels[before.era], SAVE_COPY.eraLabels[after.era])));
  const sites = after.constructionSites.length - before.constructionSites.length;
  if (sites > 0) rows.push(row("sites", COPY.sites, COPY.sitesValue(sites)));
  return rows;
}

const pieceWord = (state: GameState, estateId: string, pieceId: string) => onWhat(state, estateId, pieceId);

/** Claims, suits, possession, an estate's value and a ruling's share (ES-1…ES-8, LM-E9). */
function estateRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [estatesOf(before), estatesOf(after)];
  const rows: ReceiptRow[] = [];
  const claims = byId(was.claims, claim => claim.id);
  for (const claim of now.claims) {
    const old = claims.get(claim.id);
    const what = COPY.claim(holderName(after, claim.claimant), onWhat(after, claim.estateId, claim.pieceId));
    if (old === undefined) { rows.push(row(`claim:${claim.id}`, what, COPY.claimNew(WORDS.basis[claim.basis], claim.strength))); continue; }
    if (claim.strength !== old.strength) rows.push(row(`claim:${claim.id}:strength`, what, COPY.strength(claim.strength - old.strength, old.strength, claim.strength)));
    const added = claim.evidence.slice(old.evidence.length).map(entry => COPY.evidenceItem(WORDS.evidence[entry.kind], entry.weight));
    if (added.length > 0) rows.push(row(`claim:${claim.id}:evidence`, what, COPY.evidence(added.join(", "))));
    if (claim.status !== old.status) rows.push(row(`claim:${claim.id}:status`, what, COPY.change(COPY.claimStatus[old.status] ?? old.status, COPY.claimStatus[claim.status] ?? claim.status)));
  }
  const suits = byId(was.suits, suit => suit.id);
  for (const suit of now.suits) {
    const old = suits.get(suit.id);
    const what = COPY.suit(holderName(after, suit.plaintiff), holderName(after, suit.defendant), onWhat(after, suit.estateId, suit.pieceId));
    if (old === undefined) { rows.push(row(`suit:${suit.id}`, what, COPY.suitNew)); continue; }
    const stage = (value: string) => OUTLOOK_COPY.suitStages[value] ?? value;
    if (suit.stage !== old.stage) rows.push(row(`suit:${suit.id}:stage`, what, COPY.suitStage(stage(old.stage), stage(suit.stage))));
    if (suit.costs !== old.costs) rows.push(row(`suit:${suit.id}:costs`, what, COPY.suitCosts(suit.costs - old.costs, old.costs, suit.costs)));
    if (suit.patron !== undefined && suit.patron !== old.patron) rows.push(row(`suit:${suit.id}:patron`, what, COPY.suitPatron(holderName(after, suit.patron))));
    if (suit.enforcements > old.enforcements) rows.push(row(`suit:${suit.id}:enforce`, what, COPY.enforcement(suit.enforcements)));
  }
  const estates = byId(was.estates, estate => estate.id);
  for (const estate of now.estates) {
    const old = estates.get(estate.id);
    if (old === undefined) continue;
    const name = estateWord(after, estate.id);
    if (estate.possessor !== old.possessor) rows.push(row(`possession:${estate.id}`, COPY.possession(name), COPY.change(holderName(before, old.possessor), holderName(after, estate.possessor))));
    if (estate.annualValue !== old.annualValue) rows.push(row(`value:${estate.id}`, COPY.value(name), COPY.money(estate.annualValue - old.annualValue, old.annualValue, estate.annualValue)));
    const pieces = byId(old.pieces, piece => piece.id);
    for (const piece of estate.pieces) {
      const was_ = pieces.get(piece.id);
      if (was_ === undefined) continue;
      const what = pieceWord(after, estate.id, piece.id);
      if (piece.possessor !== was_.possessor) rows.push(row(`possession:${piece.id}`, COPY.possession(what), COPY.change(holderName(before, was_.possessor), holderName(after, piece.possessor))));
      const [share, shareWas] = [piece.scope?.sharePermille, was_.scope?.sharePermille];
      if (share !== undefined && share !== shareWas) rows.push(row(`scope:${piece.id}`, COPY.scope(what), COPY.change(shareWas === undefined ? COPY.none_ : COPY.scopeValue(Math.round(shareWas / 10)), COPY.scopeValue(Math.round(share / 10)))));
    }
  }
  return rows;
}

/** Promises made, kept or broken; registry terms set; a marriage offer sent (NG-1…NG-3, ER-8). */
function wordRows(before: GameState, after: GameState): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const promises = byId(diplomacyOf(before).promises, entry => entry.id);
  for (const record of diplomacyOf(after).promises) {
    const old = promises.get(record.id);
    const what = COPY.promise(WORDS.terms[record.term]);
    if (old === undefined) rows.push(row(`promise:${record.id}`, what, COPY.promiseNew(holderName(after, record.promisor), holderName(after, record.promisee), dateWord(after, record.deadline))));
    else if (old.status !== record.status) rows.push(row(`promise:${record.id}`, what, COPY.promiseStatus[record.status] ?? record.status));
  }
  const terms = new Set((before.registry?.terms ?? []).map(term => term.id));
  for (const term of after.registry?.terms ?? []) {
    if (terms.has(term.id)) continue;
    rows.push(row(`term:${term.id}`, COPY.term(WORDS.termWhat[term.what] ?? term.what, WORDS.termKinds[term.kind]), COPY.termValue(moneyShort(term.amountPerYear), term.years)));
  }
  // A marriage offer is answered as it is sent (NG-3): the offer, then the counterpart's answer as it now stands.
  const offers = byId(diplomacyOf(before).negotiations, entry => entry.id);
  for (const offer of diplomacyOf(after).negotiations) {
    const old = offers.get(offer.id);
    const house = holderName(after, offer.counterpart);
    if (old === undefined) rows.push(row(`offer:${offer.id}`, COPY.offer(house), COPY.offerValue(NEGOTIATION_COPY.tiers[offer.acceptance.tier])));
    if (old?.status !== offer.status) rows.push(row(`offer:${offer.id}:answer`, COPY.offerAnswer(house), NEGOTIATION_COPY.answers[offer.status]));
  }
  return rows;
}

/** Every number the answer changed at once, from the state before and after it. */
export function receiptRows(before: GameState, after: GameState): readonly ReceiptRow[] {
  const oversight = oversightRows(before, after);
  // A steward whose estate's row names him (put in or sent away) needs no second row for his place.
  const said = new Set(stewardshipOf(after).oversight.flatMap(entry => {
    const old = stewardshipOf(before).oversight.find(item => item.estateId === entry.estateId);
    return old === undefined || old.stewardId === entry.stewardId ? [] : [old.stewardId, entry.stewardId];
  }));
  return [...treasuryRows(before, after), ...relationRows(before, after), ...oversight, ...stewardRows(before, after, said), ...ruleRows(before, after),
    ...conditionRows(before, after), ...estateRows(before, after), ...wordRows(before, after)];
}

/** The answer's receipt: the card's title and the answer, the rows, and the later lines the card showed for it. */
export function answerReceipt(before: GameState, after: GameState, meta: AnswerMeta): AnswerReceiptView {
  return { ...meta, rows: receiptRows(before, after) };
}

/** What the card showed for the answer given: its title, the answer's label and the answer's later lines. */
export function answerMeta(card: DecisionCardView, choiceId: string): AnswerMeta {
  const choice = card.choices.find(entry => entry.id === choiceId);
  return { family: card.family, subjectId: card.subjectId, title: card.title, answer: choice?.label ?? choiceId, later: choice?.later ?? [] };
}
