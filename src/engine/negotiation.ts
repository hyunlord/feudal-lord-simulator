/**
 * LM-E3 the negotiation engine (spec docs/design/negotiation.md NG-1…NG-5). An offer is a bundle of terms; the
 * counterpart weighs it as a sum of named reasons A = base + relation + material + political + trust + urgency +
 * concession, with floors money cannot lift (rank, the inheritance risk, broken promises, a red line). The chance is
 * σ((A − θ) / s), shown as five tiers; the answer is drawn from the seed. Short of the line, the counterpart answers
 * with the smallest bundle of what it wants that lifts the score just over it (its greed on top), red lines left out.
 */
import {
  ACCEPT_SPREAD, ACCEPT_THETA, BASE_LIKE_RANK, BROKEN_PROMISE_CAP, BROKEN_PROMISE_POINTS, CONCESSION_COST, COUNTER_DESIRES, COUNTER_MARGIN,
  DEBT_INSTALMENT_MAX_YEARS, DEBT_INSTALMENT_SHARE,
  GREED_MAX, INHERITANCE_RISK_POINTS, KEPT_PROMISE_CAP, KEPT_PROMISE_POINTS, LAND_USE_COST_CAP, LAND_USE_COST_PER_PENNY, MATERIAL_CAP,
  MATERIAL_PER_PENNY, POLITICAL_BY_ERA, POLITICAL_PEOPLE_CAP, POLITICAL_SUPPORT_POINTS, RANK_GAP_POINTS, RED_LINE_POINTS, RELATION_SHARE,
  TIER_BOUNDS, URGENCY_DEBT_CAP, URGENCY_DEBT_PER_YEAR, URGENCY_NO_SON, URGENCY_OLD_LORD,
} from "../content/diplomacyConfig";
import { treasuryBalance } from "../ledger/ledger";
import type { Acceptance, AcceptanceReason, DiplomacyState, Term, TermChange, TermKind } from "./diplomacy.types";
import type { GameState } from "./engine.types";
import { estateById, estatePortfolio, estatesOf, LORD } from "./estates";
import type { Estate } from "./estates.types";
import { lordshipOf } from "./lordshipState";
import { currentYear } from "./persons";
import { hashSeed } from "./prng";

export const EMPTY_DIPLOMACY: DiplomacyState = { negotiations: [], promises: [], relations: {}, nextNegotiation: 1, nextPromise: 1 };

/** NG-1: the negotiations, promises and marriage (none until the first offer: sandbox and campaign keep no state). */
export function diplomacyOf(state: Pick<GameState, "diplomacy">): DiplomacyState {
  return state.diplomacy ?? EMPTY_DIPLOMACY;
}

/** NG-3: the counterpart house's estate (a holder `estate:<id>`), its lord's age, whether a son lives. */
export function counterpartEstate(state: GameState, counterpart: string): Estate | undefined {
  return counterpart.startsWith("estate:") ? estateById(state, counterpart.slice("estate:".length)) : undefined;
}

function counterpartFamily(state: GameState, estate: Estate | undefined): { readonly lordAge: number; readonly hasSon: boolean } {
  const people = estatesOf(state).people;
  const lord = people.find(person => person.id === estate?.house?.lordId);
  const year = currentYear(state);
  const sons = people.filter(person => person.alive && person.fatherId === lord?.id && person.sex === "male");
  return { lordAge: lord === undefined ? 0 : year - lord.birthYear, hasSon: sons.length > 0 };
}

/** A piece's year (a home piece's set worth when the ledger does not pay it). */
function pieceWorth(state: GameState, pieceId: string | undefined): number {
  if (pieceId === undefined) return 0;
  for (const estate of estatesOf(state).estates) {
    const piece = estate.pieces.find(entry => entry.id === pieceId);
    if (piece !== undefined) return piece.annualValue;
  }
  return 0;
}

/** NG-4: the counterpart's red lines — its manor court's use, a wardship over its heirs. */
function redLine(_state: GameState, term: Term): boolean {
  if (term.giver !== "counterpart") return false;
  if (term.kind === "wardship") return true;
  return term.kind === "land_use" && (term.pieceId?.endsWith(":manor_court") ?? false);
}

function materialOf(state: GameState, term: Term): number {
  if (term.giver !== "proposer") return 0;
  const per = MATERIAL_PER_PENNY[term.kind] ?? 0;
  switch (term.kind) {
    case "cash": case "debt_assumption": return (term.amount ?? 0) * per;
    case "pension": return (term.amount ?? 0) * (term.years ?? 1) * per;
    case "right_piece": return pieceWorth(state, term.pieceId) * per;
    default: return 0;
  }
}

function concessionOf(state: GameState, term: Term): number {
  if (term.giver !== "counterpart" || redLine(state, term)) return 0;
  if (term.kind === "land_use") return -Math.min(LAND_USE_COST_CAP, pieceWorth(state, term.pieceId) * LAND_USE_COST_PER_PENNY);
  return -(CONCESSION_COST[term.kind] ?? 0);
}

/** NG-3: the probability's five tiers. */
function tierOf(permille: number): Acceptance["tier"] {
  return TIER_BOUNDS.find(([, bound]) => permille < bound)![0];
}

/** NG-3 API: the counterpart's acceptance of these terms now — its named reasons, the score, the chance and tier. */
export function evaluateOffer(state: GameState, proposer: string, counterpart: string, terms: readonly Term[]): Acceptance {
  const estate = counterpartEstate(state, counterpart);
  const family = counterpartFamily(state, estate);
  const diplomacy = diplomacyOf(state);
  const reasons: AcceptanceReason[] = [];
  const add = (name: AcceptanceReason["name"], value: number, detail?: string) => {
    const rounded = Math.round(value);
    if (rounded !== 0) reasons.push({ name, value: rounded, ...(detail === undefined ? {} : { detail }) });
  };
  add("base", BASE_LIKE_RANK);
  add("relation", (diplomacy.relations[counterpart] ?? 0) * RELATION_SHARE);
  add("material", Math.min(MATERIAL_CAP, terms.reduce((sum, term) => sum + materialOf(state, term), 0)));
  const support = terms.some(term => term.giver === "proposer" && term.kind === "political_support") ? POLITICAL_SUPPORT_POINTS : 0;
  add("political", (POLITICAL_BY_ERA[state.era] ?? 0) + Math.min(POLITICAL_PEOPLE_CAP, Math.floor(Math.max(0, state.population) / 100)) + support);
  const ours = diplomacy.promises.filter(promise => promise.promisor === proposer && promise.promisee === counterpart);
  add("trust", Math.min(KEPT_PROMISE_CAP, ours.filter(promise => promise.status === "kept").length * KEPT_PROMISE_POINTS));
  const debtRatio = estate === undefined || estate.annualValue <= 0 ? 0 : estate.burdens.debt / estate.annualValue;
  add("urgency", Math.min(URGENCY_DEBT_CAP, debtRatio * URGENCY_DEBT_PER_YEAR) + (family.lordAge >= 60 ? URGENCY_OLD_LORD : 0) + (family.hasSon ? 0 : URGENCY_NO_SON));
  add("concession", terms.reduce((sum, term) => sum + concessionOf(state, term), 0));
  // NG-4: the floors money cannot lift.
  if (lordshipOf(state).titleDemoted) add("rank", -RANK_GAP_POINTS, "demoted");
  if (!family.hasSon) add("inheritance_risk", -INHERITANCE_RISK_POINTS, "heiress");
  add("broken_promises", -Math.min(BROKEN_PROMISE_CAP, ours.filter(promise => promise.status === "broken").length * BROKEN_PROMISE_POINTS));
  const lines = terms.filter(term => redLine(state, term));
  if (lines.length > 0) add("red_line", -RED_LINE_POINTS, lines.map(term => term.kind).join(","));
  const score = reasons.reduce((sum, reason) => sum + reason.value, 0);
  const permille = Math.round(1000 / (1 + Math.exp(-(score - ACCEPT_THETA) / ACCEPT_SPREAD)));
  const top = [...reasons].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, Math.max(3, Math.min(5, reasons.length)));
  return { score, reasons, top, permille, tier: tierOf(permille) };
}

/** NG-4 API: the most the score can reach with money and goods — the floors' proof (cash cannot lift what they hold down). */
export function materialCeiling(state: GameState, proposer: string, counterpart: string, terms: readonly Term[]): number {
  const now = evaluateOffer(state, proposer, counterpart, terms);
  const material = now.reasons.find(reason => reason.name === "material")?.value ?? 0;
  return now.score - material + MATERIAL_CAP;
}

/**
 * FIX-12 (item 1, NG-5a) API: the most a year's debt instalment may be — a quarter of the year of the estates the lord
 * holds (`estatePortfolio`'s annual value: the home estate's ledger year, an off-map estate's card).
 */
export function debtInstalmentCap(state: GameState): number {
  const year = estatePortfolio(state).filter(estate => estate.possessor === LORD).reduce((sum, estate) => sum + estate.annualValue, 0);
  return Math.floor(year * DEBT_INSTALMENT_SHARE);
}

/** FIX-12 (item 1): the instalments a debt takes at the lord's cap (1…5 years), or null when five years cannot carry it. */
export function debtInstalmentYears(state: GameState, amount: number): number | null {
  const cap = debtInstalmentCap(state);
  if (amount <= 0) return 1;
  if (cap <= 0) return null;
  const years = Math.ceil(amount / cap);
  return years <= DEBT_INSTALMENT_MAX_YEARS ? years : null;
}

/** NG-5: what the lord can give of each desire at most (the treasury's cash, the debt by instalments, a pension, one support). */
function desireRoom(state: GameState, counterpart: string, kind: TermKind): number {
  const estate = counterpartEstate(state, counterpart);
  switch (kind) {
    case "cash": return Math.max(0, treasuryBalance(state));
    // FIX-12 (item 1): only what five years of instalments carry; nothing when the lord's year carries none.
    case "debt_assumption": return Math.min(estate?.burdens.debt ?? 0, debtInstalmentCap(state) * DEBT_INSTALMENT_MAX_YEARS);
    case "pension": return 240;
    default: return 1;
  }
}

function amountOf(terms: readonly Term[], kind: TermKind): number {
  return terms.filter(term => term.kind === kind && term.giver === "proposer").reduce((sum, term) => sum + (term.amount ?? 0), 0);
}

/** NG-5 API: the changed terms between an offer and its counter (added, raised, removed), by kind. */
export function termChanges(from: readonly Term[], to: readonly Term[]): readonly TermChange[] {
  const kinds = [...new Set([...from, ...to].map(term => term.kind))];
  const changes: TermChange[] = [];
  for (const kind of kinds) {
    const before = from.find(term => term.kind === kind);
    const after = to.find(term => term.kind === kind);
    if (before === undefined && after !== undefined) changes.push({ kind, change: "added", ...(after.amount === undefined ? {} : { to: after.amount }) });
    else if (before !== undefined && after === undefined) changes.push({ kind, change: "removed" });
    else if (before !== undefined && after !== undefined && (before.amount ?? 0) !== (after.amount ?? 0)) {
      changes.push({ kind, change: "raised", from: before.amount ?? 0, to: after.amount ?? 0 });
    }
  }
  return changes;
}

/**
 * NG-5 API: the counterpart's counter — the offer without its red lines, then its desires in order (the debt taken on,
 * cash, a pension, political support), each only as much as lifts the score to θ + margin + greed; null when no such
 * bundle reaches it (a floor holds it down).
 */
export function counterOffer(state: GameState, proposer: string, counterpart: string, terms: readonly Term[], key: string):
  { readonly terms: readonly Term[]; readonly changes: readonly TermChange[]; readonly acceptance: Acceptance } | null {
  const greed = hashSeed(state.seed, "negotiation-greed", counterpart.length, key.length) % (GREED_MAX + 1);
  const target = ACCEPT_THETA + COUNTER_MARGIN + greed;
  let draft: Term[] = terms.filter(term => !redLine(state, term));
  let acceptance = evaluateOffer(state, proposer, counterpart, draft);
  for (const kind of COUNTER_DESIRES) {
    if (acceptance.score >= target) break;
    if (kind === "political_support") {
      if (draft.some(term => term.kind === kind)) continue;
      draft = [...draft, { kind, giver: "proposer", years: 2 }];
    } else {
      const per = (MATERIAL_PER_PENNY[kind] ?? 0) * (kind === "pension" ? 5 : 1);
      const material = acceptance.reasons.find(reason => reason.name === "material")?.value ?? 0;
      const room = Math.min(target - acceptance.score, MATERIAL_CAP - material);
      if (room <= 0 || per <= 0) continue;
      const have = amountOf(draft, kind);
      const more = Math.min(Math.ceil(room / per), desireRoom(state, counterpart, kind) - have);
      if (more <= 0) continue;
      const years = kind === "pension" ? 5 : kind === "debt_assumption" ? debtInstalmentYears(state, have + more) : undefined;
      if (years === null) continue;
      draft = [...draft.filter(term => !(term.kind === kind && term.giver === "proposer")),
        { kind, giver: "proposer", amount: have + more, ...(years === undefined ? {} : { years }) }];
    }
    acceptance = evaluateOffer(state, proposer, counterpart, draft);
  }
  if (acceptance.score < target) return null;
  return { terms: draft, changes: termChanges(terms, draft), acceptance };
}

/** NG-3: the seed's draw for an offer (permille, 0…999): accepted when under the acceptance's permille. */
export function offerDraw(state: Pick<GameState, "seed">, ordinal: number): number {
  return hashSeed(state.seed, "negotiation-answer", ordinal) % 1000;
}
