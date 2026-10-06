import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson, estatesOf } from "../../../engine/estates";
import { faction } from "../../../engine/factions";
import { personDisplayName } from "../../../engine/persons";
import { factionDisplayName } from "../../../content/factionCopy.ko";
import type { Claim, Suit } from "../../../engine/estates.types";
import { historySummary } from "../../../engine/history";
import type { HistoryRecord } from "../../../engine/history.types";
import { diplomacyOf } from "../../../engine/negotiation";
import type { PromiseRecord } from "../../../engine/diplomacy.types";
import { calendar, scenarioOf } from "../../../engine/scenarioState";
import { stewardshipOf } from "../../../engine/stewardship";
import { wallConstructionPriority } from "../../../engine/constructionReserve";
import { treasuryBalance } from "../../../ledger/ledger";
import { BUILDING_COPY } from "../../../content/buildingCatalog.ko";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import { NEGOTIATION_COPY } from "../../lord/negotiation/negotiationCopy.ko";
import { POLICY_COPY } from "../../lord/policyCopy.ko";
import { moneyShort } from "../../money.ko";
import type { Rememberer } from "../decisionCardTypes";
import { remembersOf } from "../remembers";
import { LORD_OUTCOME_COPY as COPY, LORD_OUTCOME_WORDS as WORDS } from "./lordOutcomeCopy.ko";

// DEC-CARD, the lord-mode cards: what an answer does, read off the state the engine leaves after it (the answer run on
// the state with gameReducer, `afterAnswer`) — never a rule or a table copied here (P-D4). The diff is put in sentences:
//  - now: the treasury, claims raised or moved, suits, evidence, a patron, promises settled, the steward kept or sent
//    away, the town's conditions, and the chronicle's own sentences for what else it writes;
//  - later: the promises the answer makes (their deadlines, what a breach costs, the witnesses), a timed term, and the
//    day a big decision's actual is written (`actualDueTick`);
//  - who remembers: the factions (recordDecision's faction.relation records), the houses that are not factions
//    (diplomacy relations) and an estate's tenants and merchants (its goodwill).
// A marriage offer is answered by the seed's draw as it is sent (NG-3): when the answer sends one, only the offer and its
// tier are said — what the draw brings is not shown before it is made. DEC-TRACE's `answerOutlook` will give all of
// this directly (docs/requests/engine-deccard-gp7.md §3).

export type LordOutcome = Readonly<{ now: readonly string[]; later: readonly string[]; remembers: readonly Rememberer[] }>;

/** "1305년 여름": a tick's year and season (glossary rule 5: no ticks, no days counted down). */
export function dateWord(state: GameState, tick: number): string {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.date(date.year, SCENARIO_COPY.seasons[date.season] ?? "");
}

/** A holder's name (ES-1 HolderId) as the lord screens write it: the lord, a person, a neighbour's house, a faction. */
function holderName(state: GameState, holder: string): string {
  if (holder.startsWith("person:")) {
    const id = holder.slice("person:".length);
    const person = estatePerson(state, id) ?? state.persons?.people.find(entry => entry.id === id);
    return person === undefined ? WORDS.oldKin : personDisplayName(person);
  }
  if (holder.startsWith("estate:")) {
    const estate = estatesOf(state).estates.find(entry => entry.id === holder.slice("estate:".length));
    const name = estate?.house?.name ?? estate?.name ?? holder;
    return WORDS.houseOf(GENTRY_NAMES_KO[name] ?? name);
  }
  const known = WORDS.holders[holder];
  if (known !== undefined) return known;
  const view = faction(state, holder as Parameters<typeof faction>[1]);
  return view === undefined ? holder : factionDisplayName(view.id, view.name);
}

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

/** The promises the answer makes (later) and settles (now); one line for a debt or a pension paid year by year. */
function promiseLines(before: GameState, after: GameState): { now: string[]; later: string[] } {
  const was = new Map(diplomacyOf(before).promises.map(entry => [entry.id, entry] as const));
  const now: string[] = [];
  const made: PromiseRecord[] = [];
  for (const record of diplomacyOf(after).promises) {
    const old = was.get(record.id);
    if (old === undefined) { made.push(record); continue; }
    if (old.status === "open" && record.status === "broken") now.push(COPY.promiseBroken(holderName(after, record.promisor), WORDS.terms[record.term]));
    if (old.status === "open" && record.status === "kept" && record.promisor === "lord") now.push(COPY.promiseKept(WORDS.terms[record.term]));
  }
  const later: string[] = [];
  const groups = new Map<string, PromiseRecord[]>();
  for (const record of made) groups.set(`${record.promisor}|${record.term}`, [...groups.get(`${record.promisor}|${record.term}`) ?? [], record]);
  for (const records of groups.values()) {
    const first = records[0]!;
    const last = records.at(-1)!;
    const term = WORDS.terms[first.term];
    if (first.promisor !== "lord") { later.push(COPY.promiseToLord(holderName(after, first.promisor), term, dateWord(after, first.deadline))); continue; }
    later.push(records.length === 1 ? COPY.promiseByLord(term, dateWord(after, first.deadline))
      : COPY.promisesByLord(term, records.length, dateWord(after, first.deadline), dateWord(after, last.deadline)));
  }
  // What a breach of the lord's word costs: the promise's own stake and witnesses (once per promisee).
  const stakes = new Map<string, PromiseRecord>();
  for (const record of made) if (record.promisor === "lord" && !stakes.has(record.promisee)) stakes.set(record.promisee, record);
  for (const record of stakes.values()) {
    const witnesses = record.witnesses.map(id => holderName(after, id)).join(", ");
    later.push(COPY.stake(holderName(after, record.promisee), record.stake.relation, witnesses === "" ? null : witnesses));
  }
  return { now, later };
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

/** The town's conditions the answer sets (the lord's policy screen's words). */
function conditionLines(before: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const [was, now] = [before.agency, after.agency];
  if (now?.policy !== undefined && now.policy !== was?.policy) lines.push(COPY.policy(POLICY_COPY.policies[now.policy]));
  if (now?.duesPermille !== undefined && now.duesPermille !== was?.duesPermille) lines.push(COPY.dues(Math.round(now.duesPermille / 10)));
  const name = (kind: string) => BUILDING_COPY[kind as keyof typeof BUILDING_COPY]?.name ?? kind;
  for (const subsidy of now?.subsidies ?? []) {
    if (!(was?.subsidies ?? []).some(old => old.kind === subsidy.kind && old.amount === subsidy.amount)) lines.push(COPY.subsidy(name(subsidy.kind), moneyShort(subsidy.amount)));
  }
  for (const subsidy of was?.subsidies ?? []) if (!(now?.subsidies ?? []).some(entry => entry.kind === subsidy.kind)) lines.push(COPY.subsidyGone(name(subsidy.kind)));
  if ((after.timberOrder ?? 0) !== (before.timberOrder ?? 0) && (after.timberOrder ?? 0) > 0) lines.push(COPY.timber(after.timberOrder!));
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

/** The answer's outcome, from the state before it and the state the engine leaves after it. */
export function lordOutcome(before: GameState, after: GameState): LordOutcome {
  const records = newRecords(before, after);
  const offers = diplomacyOf(after).negotiations.filter(entry => !diplomacyOf(before).negotiations.some(old => old.id === entry.id));
  if (offers.length > 0) {
    return { now: offers.map(offer => COPY.offerSent(NEGOTIATION_COPY.tiers[offer.acceptance.tier])), later: [COPY.offerAnswer], remembers: [] };
  }
  const promises = promiseLines(before, after);
  const quoted = records.filter(record => !SAID.test(record.template)).map(record => COPY.record(historySummary(record, after)));
  const value = (state: GameState) => new Map(estatesOf(state).estates.map(estate => [estate.id, estate.annualValue] as const));
  const [valueWas, valueNow] = [value(before), value(after)];
  const dropped = [...valueNow].filter(([id, now]) => now < (valueWas.get(id) ?? now)).map(([id]) => COPY.valueDrop(estateWord(after, id)));
  return {
    now: [money(treasuryBalance(after) - treasuryBalance(before)), ...conditionLines(before, after), ...claimLines(before, after), ...suitLines(before, after),
      ...promises.now, ...stewardLines(before, after), ...dropped, ...quoted],
    later: [...promises.later, ...termLines(before, after), ...actualLines(after, records)],
    remembers: [...remembersOf(before, after), ...houseMoves(before, after), ...goodwillMoves(before, after)],
  };
}
