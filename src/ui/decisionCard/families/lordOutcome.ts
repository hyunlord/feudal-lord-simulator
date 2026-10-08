import type { GameState } from "../../../engine/engine.types";
import { estatesOf } from "../../../engine/estates";
import type { Claim, Suit } from "../../../engine/estates.types";
import { historySummary } from "../../../engine/history";
import type { HistoryRecord } from "../../../engine/history.types";
import { diplomacyOf } from "../../../engine/negotiation";
import type { PromiseRecord } from "../../../engine/diplomacy.types";
import { stewardshipOf } from "../../../engine/stewardship";
import { wallConstructionPriority } from "../../../engine/constructionReserve";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import type { GameAction } from "../../../state/gameStore.types";
import { NEGOTIATION_COPY } from "../../lord/negotiation/negotiationCopy.ko";
import { POLICY_COPY } from "../../lord/policyCopy.ko";
import { moneyShort } from "../../money.ko";
import { dateWord, holderName } from "../answerWords";
import type { Rememberer } from "../decisionCardTypes";
import { outlookLater, outlookOf, outlookRemembers, outlookTreasury, type AnswerOutlook, type OutlookLater } from "../outlook";
import { afterAnswer } from "../remembers";
import { LORD_OUTCOME_COPY as COPY, LORD_OUTCOME_WORDS as WORDS } from "./lordOutcomeCopy.ko";

// DEC-CARD, the lord-mode cards: what an answer does. DEC-CARD-2 (DC-D7): the engine's outlook (`answerOutlook`, outlook.ts)
// gives the treasury (지금), what the answer sets going (나중에: a promise's deadline, a subsidy, the dues, the timber
// order, a suit's stage, the factions whose later acts follow from it) and the factions that remember it. What the
// outlook does not give is read off the state the engine leaves after the answer (the dry run, `afterAnswer`) — never a
// rule or a table copied here (P-D4):
//  - now: claims raised or moved, suits, evidence, a patron, promises kept or broken, the steward kept or sent away, the
//    estate policy, the wall's priority, new building sites, an estate's value, and the chronicle's own sentences;
//  - later: a promise's term and who gives it (beside the outlook's deadline), what a breach costs and its witnesses, a
//    timed term, and the day a big decision's actual is written (`actualDueTick`);
//  - who remembers: the houses that are not factions (diplomacy relations), an estate's tenants and merchants (its
//    goodwill), and a promise's promisee and witnesses.
// A marriage offer is answered by the seed's draw as it is sent (NG-3): when the answer sends one, only the offer and its
// tier are said — what the draw brings is not shown before it is made.

export type LordOutcome = Readonly<{ now: readonly string[]; later: readonly string[]; remembers: readonly Rememberer[];
  /** The pennies the answer moves now (the outlook's). */
  treasury: number }>;

const money = (pennies: number) => pennies > 0 ? COPY.treasuryIn(pennies) : pennies < 0 ? COPY.treasuryOut(-pennies) : COPY.treasurySame;

/** An estate as the ledger screen names it: a neighbour's by its house's Korean reading, else the home estate. */
function estateWord(state: GameState, estateId: string): string {
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  return estate === undefined || !estate.offMap ? WORDS.homeEstate : WORDS.estateName(GENTRY_NAMES_KO[estate.name] ?? estate.name);
}

/** What a claim or a suit is on: the estate, or one piece of it. */
function onWhat(state: GameState, estateId: string, pieceId: string | undefined): string {
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  const piece = pieceId === undefined ? undefined : estate?.pieces.find(entry => entry.id === pieceId);
  return piece === undefined ? COPY.whole(estateWord(state, estateId)) : WORDS.estatePiece(estateWord(state, estateId), WORDS.pieces[piece.kind]);
}

function claimLines(before: GameState, after: GameState): string[] {
  const was = new Map(estatesOf(before).claims.map(claim => [claim.id, claim] as const));
  return estatesOf(after).claims.flatMap((claim: Claim) => {
    const old = was.get(claim.id);
    const who = holderName(after, claim.claimant);
    if (old === undefined) return [COPY.claimNew(who, onWhat(after, claim.estateId, claim.pieceId), WORDS.basis[claim.basis], claim.strength)];
    const lines: string[] = [];
    if (claim.strength > old.strength) lines.push(COPY.claimStronger(who, old.strength, claim.strength));
    if (claim.strength < old.strength) lines.push(COPY.claimWeaker(who, old.strength, claim.strength));
    const added = claim.evidence.filter(entry => !old.evidence.some(item => item.kind === entry.kind)).map(entry => WORDS.evidence[entry.kind]);
    if (added.length > 0) lines.push(COPY.evidence(added.join(", ")));
    return lines;
  });
}

function suitLines(before: GameState, after: GameState): string[] {
  const was = new Map(estatesOf(before).suits.map(suit => [suit.id, suit] as const));
  return estatesOf(after).suits.flatMap((suit: Suit) => {
    const old = was.get(suit.id);
    if (old === undefined) return [COPY.suitNew(holderName(after, suit.plaintiff), holderName(after, suit.defendant), onWhat(after, suit.estateId, suit.pieceId))];
    return suit.patron !== undefined && suit.patron !== old.patron ? [COPY.patron(holderName(after, suit.patron))] : [];
  });
}

/** The promises the answer settles (now), and what a breach of the lord's new word costs (later; once per promisee). */
function promiseLines(before: GameState, after: GameState): { now: string[]; later: string[] } {
  const was = new Map(diplomacyOf(before).promises.map(entry => [entry.id, entry] as const));
  const now: string[] = [];
  const stakes = new Map<string, PromiseRecord>();
  for (const record of diplomacyOf(after).promises) {
    const old = was.get(record.id);
    if (old === undefined) { if (record.promisor === "lord" && !stakes.has(record.promisee)) stakes.set(record.promisee, record); continue; }
    if (old.status === "open" && record.status === "broken") now.push(COPY.promiseBroken(holderName(after, record.promisor), WORDS.terms[record.term]));
    if (old.status === "open" && record.status === "kept" && record.promisor === "lord") now.push(COPY.promiseKept(WORDS.terms[record.term]));
  }
  const later = [...stakes.values()].map(record => {
    const witnesses = record.witnesses.map(id => holderName(after, id)).join(", ");
    return COPY.stake(holderName(after, record.promisee), record.stake.relation, witnesses === "" ? null : witnesses);
  });
  return { now, later };
}

/** The outlook's open promises (promise_due) with the term and the one who gives the word, from the promise ledger after
 * the answer; one line for a debt or a pension paid year by year. A row the ledger does not match keeps the outlook's words. */
function promiseDue(after: GameState, rows: readonly OutlookLater[]): string[] {
  const promises = diplomacyOf(after).promises;
  const groups = new Map<string, { record: PromiseRecord; ticks: number[] }>();
  const unmatched: OutlookLater[] = [];
  for (const row of [...rows].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))) {
    const record = promises.find(entry => entry.status === "open" && entry.deadline === row.tick && entry.promisee === row.actor);
    if (record === undefined || row.tick === null) { unmatched.push(row); continue; }
    const key = `${record.promisor}|${record.promisee}|${record.term}`;
    groups.set(key, { record: groups.get(key)?.record ?? record, ticks: [...groups.get(key)?.ticks ?? [], row.tick] });
  }
  const lines = [...groups.values()].map(({ record, ticks }) => {
    const term = WORDS.terms[record.term];
    const [first, last] = [dateWord(after, ticks[0]!), dateWord(after, ticks.at(-1)!)];
    if (record.promisor !== "lord") return COPY.promiseToLord(holderName(after, record.promisor), term, first);
    return ticks.length === 1 ? COPY.promiseByLord(term, first) : COPY.promisesByLord(term, ticks.length, first, last);
  });
  return unmatched.length === 0 ? lines : [...lines, ...outlookLater(after, { now: [], later: unmatched, remembers: [] })];
}

function termLines(before: GameState, after: GameState): string[] {
  const known = new Set((before.registry?.terms ?? []).map(term => term.id));
  return (after.registry?.terms ?? []).filter(term => !known.has(term.id)).map(term =>
    COPY.term(WORDS.termWhat[term.what] ?? term.what, WORDS.termKinds[term.kind], moneyShort(term.amountPerYear), term.years));
}

function stewardLines(before: GameState, after: GameState): string[] {
  const was = new Map(stewardshipOf(before).stewards.map(entry => [entry.personId, entry] as const));
  const lines: string[] = [];
  for (const steward of stewardshipOf(after).stewards) {
    const old = was.get(steward.personId);
    if (old === undefined) continue;
    const name = holderName(after, `person:${steward.personId}`);
    if (old.status === "serving" && steward.status !== "serving") lines.push(COPY.stewardOut(name));
    else if (steward.loyalty !== old.loyalty) lines.push(COPY.loyalty(name, steward.loyalty - old.loyalty));
  }
  return lines;
}

/** The town's conditions the answer sets that the outlook does not word (the dues, subsidies and timber are its later keys). */
function conditionLines(before: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const [was, now] = [before.agency, after.agency];
  if (now?.policy !== undefined && now.policy !== was?.policy) lines.push(COPY.policy(POLICY_COPY.policies[now.policy]));
  const [wallWas, wallNow] = [wallConstructionPriority(before), wallConstructionPriority(after)];
  if (wallNow !== wallWas) lines.push(wallNow === "priority" ? COPY.wallFirst : COPY.wallNotFirst);
  const sites = after.constructionSites.length - before.constructionSites.length;
  if (sites > 0) lines.push(COPY.sites(sites));
  return lines;
}

/** The records the card says in its own words (or that only repeat the answer): not quoted from the chronicle. */
const SAID = /^(faction\.relation|registry\.|promise\.|estate\.(claim_raised|suit_filed|suit_patron)|negotiation\.offered|decision\.|stewardship\.(audit_answered|lord_decided|season)|manor\.)/;

function newRecords(before: GameState, after: GameState): readonly HistoryRecord[] {
  const known = new Set((before.history?.records ?? []).map(record => record.id));
  return (after.history?.records ?? []).filter(record => !known.has(record.id));
}

/** A big decision's actual: the day it is written, and the numbers it will be read against (the engine's keys). */
function actualLines(after: GameState, records: readonly HistoryRecord[]): string[] {
  return records.flatMap(record => {
    const decision = record.decision;
    if (decision?.actualDueTick === undefined) return [];
    const metrics = Object.entries(decision.predicted).map(([key, value]) => COPY.metricNow(COPY.metrics[key] ?? key, key === "treasury" ? moneyShort(value) : String(value)));
    return metrics.length === 0 ? [] : [COPY.actual(dateWord(after, decision.actualDueTick), metrics.join(", "))];
  });
}

/** Who remembers a promise the answer makes: the one the lord's word is given to, its witnesses, the one who gives the
 * lord their word (the promise ledger's own records; a breach's cost is in "later"). */
function promiseRememberers(before: GameState, after: GameState): Rememberer[] {
  const known = new Set(diplomacyOf(before).promises.map(record => record.id));
  const out: Rememberer[] = [];
  const seen = new Set<string>();
  const add = (holder: string, how: string) => { const who = holderName(after, holder); if (seen.has(who)) return; seen.add(who); out.push({ who, how, delta: 0 }); };
  for (const record of diplomacyOf(after).promises) {
    if (known.has(record.id)) continue;
    if (record.promisor === "lord") { add(record.promisee, COPY.holdsWord); for (const witness of record.witnesses) add(witness, COPY.witnesses); }
    else add(record.promisor, COPY.gaveWord);
  }
  return out;
}

/** One line per who: a relation move first, then a promise's role. */
const dedupe = (entries: readonly Rememberer[]): Rememberer[] => {
  const seen = new Set<string>();
  return entries.filter(entry => { if (seen.has(entry.who)) return false; seen.add(entry.who); return true; });
};

function houseMoves(before: GameState, after: GameState): Rememberer[] {
  const [was, now] = [diplomacyOf(before).relations, diplomacyOf(after).relations];
  return Object.entries(now).flatMap(([id, value]) => {
    const delta = value - (was[id] ?? 0);
    return delta === 0 ? [] : [{ who: holderName(after, id), how: COPY.house(delta), delta }];
  });
}

function goodwillMoves(before: GameState, after: GameState): Rememberer[] {
  const was = new Map(stewardshipOf(before).oversight.map(entry => [entry.estateId, entry] as const));
  return stewardshipOf(after).oversight.flatMap(entry => {
    const old = was.get(entry.estateId);
    if (old === undefined) return [];
    const estate = estateWord(after, entry.estateId);
    return (["tenants", "merchants"] as const).flatMap(group => {
      const delta = entry[group] - old[group];
      return delta === 0 ? [] : [{ who: COPY.goodwillOf(estate, COPY.groups[group]), how: COPY.goodwill(delta), delta }];
    });
  });
}

/** The answer's outcome: the engine's outlook, and the state before and after it for what the outlook lacks. */
export function lordOutcome(before: GameState, after: GameState, outlook: AnswerOutlook): LordOutcome {
  const records = newRecords(before, after);
  const treasury = outlookTreasury(outlook);
  const offers = diplomacyOf(after).negotiations.filter(entry => !diplomacyOf(before).negotiations.some(old => old.id === entry.id));
  if (offers.length > 0) {
    return { now: offers.map(offer => COPY.offerSent(NEGOTIATION_COPY.tiers[offer.acceptance.tier])), later: [COPY.offerAnswer], remembers: [], treasury };
  }
  const promises = promiseLines(before, after);
  const quoted = records.filter(record => !SAID.test(record.template)).map(record => COPY.record(historySummary(record, after)));
  const value = (state: GameState) => new Map(estatesOf(state).estates.map(estate => [estate.id, estate.annualValue] as const));
  const [valueWas, valueNow] = [value(before), value(after)];
  const dropped = [...valueNow].filter(([id, now]) => now < (valueWas.get(id) ?? now)).map(([id]) => COPY.valueDrop(estateWord(after, id)));
  return {
    now: [money(treasury), ...conditionLines(before, after), ...claimLines(before, after), ...suitLines(before, after),
      ...promises.now, ...stewardLines(before, after), ...dropped, ...quoted],
    later: [...outlookLater(after, outlook, { promise_due: rows => promiseDue(after, rows) }), ...promises.later, ...termLines(before, after), ...actualLines(after, records)],
    remembers: dedupe([...outlookRemembers(before, outlook), ...houseMoves(before, after), ...goodwillMoves(before, after), ...promiseRememberers(before, after)]), treasury,
  };
}

/** A lord-mode answer as its card says it (the outlook, then the dry run for the rest), or null when the engine refuses it. */
export function lordAnswer(state: GameState, command: GameAction): LordOutcome | null {
  const outlook = outlookOf(state, command);
  const after = outlook === null ? null : afterAnswer(state, command);
  return outlook === null || after === null ? null : lordOutcome(state, after, outlook);
}
