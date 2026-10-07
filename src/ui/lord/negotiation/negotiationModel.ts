import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import { BALANCE } from "../../../content/balanceConfig";
import { ACCEPT_THETA, DEBT_INSTALMENT_MAX_YEARS, JOINTURE_PIECES, PROMISE_SUPPORT_TICKS } from "../../../content/diplomacyConfig";
import { GROOM_RELATION_KO } from "../../../content/historyCopy.ko";
import type { Acceptance, AcceptanceReasonName, AcceptanceTier, MarriagePlan, MarriageStage, Negotiation, Term, TermKind } from "../../../engine/diplomacy.types";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson, estatesOf, LORD } from "../../../engine/estates";
import { lordshipOf } from "../../../engine/lordshipState";
import { marriageCandidates, marriageDecisionDue, marriageGrooms, marriageRefusal, MARRIAGE_ESTATE_ID, type MarriageRefusal } from "../../../engine/marriage";
import { counterpartEstate, debtInstalmentCap, debtInstalmentYears, diplomacyOf, evaluateOffer, jointurePiece, materialCeiling } from "../../../engine/negotiation";
import type { Person } from "../../../engine/persons.types";
import { ageOf, currentYear } from "../../../engine/persons";
import { calendar, scenarioOf } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { treasuryBalance } from "../../../ledger/ledger";
import { lordOutcome } from "../../decisionCard/families/lordOutcome";
import { afterAnswer } from "../../decisionCard/remembers";
import { moneyFull } from "../../money.ko";
import { lordPersonRow, type LordPersonRow } from "../screen/lordPortrait";
import { NEGOTIATION_COPY as COPY } from "./negotiationCopy.ko";

// LM-R2 (negotiation area): the lord screen's 혼인 item as a pure view of the engine's read models (docs/design/negotiation.md
// "화면에 넘길 것"). Three phases, read from `diplomacyOf(state)`:
//  - draft: no marriage and no counter waiting — the groom (`marriageGrooms`), the clauses the lord picks (jointure on
//    `jointurePiece`, a debt by instalments within `debtInstalmentCap` / `debtInstalmentYears`), and the live preview of
//    every edit: `evaluateOffer` (tier, top reasons), `materialCeiling`, `marriageRefusal`. An offer is answered as it is
//    sent (`proposeMarriage` draws at once), so the last answer shows above the next draft.
//  - countered: the counter's clauses with what changed (`counter.changes`: added / raised → changed, removed → rejected);
//    `answer_counter` accept or refuse, each shut when the engine's own command would change nothing. DEC-CARD: each
//    answer's now / later / who remembers from that same run (lordOutcome: the contract's cash, the claim it raises, the
//    promises it writes with their deadlines, stakes and witnesses, the house's relation), in the heavy cards' words.
//  - contract: the `MarriagePlan` timeline — stage, the middle events as they fell, brother-in-law, the will answer, the
//    rival, the jointure, the deferred debt; a contested estate links to its suit (no command of its own, NG-8).
// No engine rule is copied: the numbers come from the read models; where a refusal reason is not exposed (answering a
// counter) the button is shut with a neutral line (engine request answerCounterRefusal).

const COUNTERPART = `estate:${MARRIAGE_ESTATE_ID}`;
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;
/** Political support is promised for the engine's support term (the counter asks the same years). */
const SUPPORT_YEARS = PROMISE_SUPPORT_TICKS / BALANCE.TICKS_PER_YEAR;

/** The clauses the editor offers, by side. Not offered: right_piece and land_use — the engine weighs them but its contract
 * moves no piece for either, so the screen does not let the lord trade on them. Consent is always added by the engine. */
export const OUR_KINDS = ["cash", "debt_assumption", "debt_after_inheritance", "jointure", "pension", "political_support"] as const;
export const THEIR_KINDS = ["inheritance_non_infringement", "residence", "wardship"] as const;
export type OurKind = (typeof OUR_KINDS)[number];
export type TheirKind = (typeof THEIR_KINDS)[number];
export type AmountKind = "cash" | "debt_assumption" | "debt_after_inheritance" | "pension";
export type ToggleKind = Exclude<OurKind | TheirKind, AmountKind>;
const AMOUNT_KINDS: readonly AmountKind[] = ["cash", "debt_assumption", "debt_after_inheritance", "pension"];
const isAmount = (kind: TermKind): kind is AmountKind => (AMOUNT_KINDS as readonly TermKind[]).includes(kind);

/** The editor's two step sizes per amount, in pence (a pension's is a year's): whole shillings and pounds, so the steps read
 * as the money the screens write (£1 = 20s = 240d). A screen convenience, not an engine rule. */
export const STEPS: Readonly<Record<AmountKind, readonly [number, number]>> = {
  cash: [12, 240], debt_assumption: [12, 60], debt_after_inheritance: [240, 1200], pension: [12, 60],
};
/** A pension's years on the editor (the engine sets no bound; the screen stops at ten). */
export const PENSION_YEARS_MAX = 10;

/** The lord's draft (screen state, not saved): the groom asked for, the amounts and the clauses switched on. */
export type Draft = Readonly<{ groomId: string | null; amounts: Readonly<Record<AmountKind, number>>; pensionYears: number; on: readonly ToggleKind[] }>;
export const EMPTY_DRAFT: Draft = { groomId: null, amounts: { cash: 0, debt_assumption: 0, debt_after_inheritance: 0, pension: 0 }, pensionYears: 1, on: [] };

export const toggleClause = (draft: Draft, kind: ToggleKind): Draft =>
  ({ ...draft, on: draft.on.includes(kind) ? draft.on.filter(entry => entry !== kind) : [...draft.on, kind] });
export const stepAmount = (draft: Draft, kind: AmountKind, delta: number): Draft =>
  ({ ...draft, amounts: { ...draft.amounts, [kind]: Math.max(0, draft.amounts[kind] + delta) } });
export const stepPensionYears = (draft: Draft, delta: number): Draft =>
  ({ ...draft, pensionYears: Math.min(PENSION_YEARS_MAX, Math.max(1, draft.pensionYears + delta)) });
export const chooseGroom = (draft: Draft, groomId: string): Draft => ({ ...draft, groomId });

/** The counterpart house's debt (its estate's burdens), the bound of what can be taken on now or after the inheritance. */
const theirDebt = (state: GameState): number => counterpartEstate(state, COUNTERPART)?.burdens.debt ?? 0;

/** The draft as the engine's terms (without consent: the engine adds it to every marriage offer). */
export function draftTerms(state: GameState, draft: Draft): readonly Term[] {
  const terms: Term[] = [];
  const { cash, debt_assumption: debt, debt_after_inheritance: deferred, pension } = draft.amounts;
  if (cash > 0) terms.push({ kind: "cash", giver: "proposer", amount: cash });
  if (debt > 0) terms.push({ kind: "debt_assumption", giver: "proposer", amount: debt, years: debtInstalmentYears(state, debt) ?? DEBT_INSTALMENT_MAX_YEARS });
  if (deferred > 0) terms.push({ kind: "debt_after_inheritance", giver: "proposer", amount: deferred });
  const piece = jointurePiece(state);
  if (draft.on.includes("jointure") && piece !== null) terms.push({ kind: "jointure", giver: "proposer", pieceId: piece });
  if (pension > 0) terms.push({ kind: "pension", giver: "proposer", amount: pension, years: draft.pensionYears });
  if (draft.on.includes("political_support")) terms.push({ kind: "political_support", giver: "proposer", years: SUPPORT_YEARS });
  for (const kind of THEIR_KINDS) if (draft.on.includes(kind)) terms.push({ kind, giver: "counterpart" });
  return terms;
}
const withConsent = (terms: readonly Term[]): readonly Term[] =>
  terms.some(term => term.kind === "consent") ? terms : [...terms, { kind: "consent", giver: "counterpart" }];

// --- words ---------------------------------------------------------------------------------------------------------------

const money = (pence: number): string => moneyFull(pence);
const pieceWord = (pieceId: string | undefined): string => (pieceId === undefined ? "" : COPY.pieces[pieceId] ?? pieceId.slice(pieceId.lastIndexOf(":") + 1));
const dateOf = (state: GameState, tick: number): string => {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.date(date.year, COPY.seasons[date.season]);
};

/** A term's value as the treaty writes it (null: the clause is its name alone). */
export function termValue(term: Term): string | null {
  switch (term.kind) {
    case "cash": case "debt_after_inheritance": return money(term.amount ?? 0);
    case "debt_assumption": return term.years === undefined ? money(term.amount ?? 0) : `${money(term.amount ?? 0)} · ${COPY.instalmentYears(term.years)}`;
    case "pension": return COPY.pensionLine(money(term.amount ?? 0), term.years ?? 1);
    case "jointure": case "right_piece": case "land_use": return pieceWord(term.pieceId) || null;
    default: return null;
  }
}

export type TreatyRow = Readonly<{ kind: TermKind; side: "ours" | "theirs"; name: string; value: string | null }>;
const sideOf = (term: Term): "ours" | "theirs" => (term.giver === "proposer" ? "ours" : "theirs");
export const treatyRow = (term: Term): TreatyRow => ({ kind: term.kind, side: sideOf(term), name: COPY.terms[term.kind], value: termValue(term) });

export type ReasonChip = Readonly<{ name: AcceptanceReasonName; sign: "plus" | "minus"; value: number; text: string }>;
export type AcceptanceView = Readonly<{ tier: AcceptanceTier; tierWord: string; score: number; line: number; reasons: readonly ReasonChip[] }>;

/** The acceptance as the screens show it: the tier (the probability stays inside, NG-3), the score against the line, the
 * top reasons as signed chips. */
export function acceptanceView(acceptance: Acceptance): AcceptanceView {
  return { tier: acceptance.tier, tierWord: COPY.tiers[acceptance.tier], score: acceptance.score, line: ACCEPT_THETA,
    reasons: acceptance.top.map(reason => ({ name: reason.name, sign: reason.value >= 0 ? "plus" as const : "minus" as const, value: reason.value,
      text: COPY.reason(COPY.reasons[reason.name], reason.value) })) };
}

// --- the parties ---------------------------------------------------------------------------------------------------------

export type PartyView = Readonly<{ id: string; name: string; line: string; row: LordPersonRow }>;
export type GroomView = PartyView & Readonly<{ chosen: boolean; choose: string }>;

function grooms(state: GameState, draft: Draft): readonly GroomView[] {
  const list = marriageGrooms(state);
  const chosen = draft.groomId !== null && list.some(entry => entry.person.id === draft.groomId) ? draft.groomId : list[0]?.person.id ?? null;
  const year = currentYear(state);
  return list.map(({ person, relation }) => {
    const relationWord = GROOM_RELATION_KO[relation] ?? relation;
    const row = lordPersonRow(state, person);
    return { id: person.id, name: row.name, line: COPY.groomLine(relationWord, ageOf(person, year)), row, chosen: person.id === chosen,
      choose: COPY.groomChoose(row.name, relationWord) };
  });
}

function bride(state: GameState): PartyView | null {
  const person = marriageCandidates(state).bride;
  if (person === null) return null;
  const row = lordPersonRow(state, person);
  return { id: person.id, name: row.name, line: COPY.brideLine(ageOf(person, currentYear(state))), row };
}

// --- the editor ----------------------------------------------------------------------------------------------------------

export type StepView = Readonly<{ delta: number; text: string; label: string; enabled: boolean }>;
export type ClauseEditor = Readonly<{
  kind: OurKind | TheirKind; side: "ours" | "theirs"; name: string;
  /** Amount clauses: the value and the four steps (− big, − small, + small, + big). */
  value: string | null; steps: readonly StepView[] | null;
  /** The pension's years. */
  years: Readonly<{ value: number; less: boolean; more: boolean }> | null;
  /** Switch clauses: pressed, and whether it can be switched on now. */
  on: boolean | null; switchable: boolean;
  note: string | null;
}>;

function amountEditor(state: GameState, draft: Draft, kind: AmountKind): ClauseEditor {
  const amount = draft.amounts[kind];
  const [small, big] = STEPS[kind];
  const debtNow = draft.amounts.debt_assumption + draft.amounts.debt_after_inheritance;
  const roomFor = (step: number): boolean => {
    if (kind === "debt_assumption") return debtNow + step <= theirDebt(state) && debtInstalmentYears(state, amount + step) !== null;
    if (kind === "debt_after_inheritance") return debtNow + step <= theirDebt(state);
    return true;
  };
  const name = COPY.terms[kind];
  const step = (delta: number): StepView => {
    const text = money(Math.abs(delta));
    return delta < 0 ? { delta, text: COPY.less(text), label: COPY.lessLabel(name, text), enabled: amount > 0 }
      : { delta, text: COPY.more(text), label: COPY.moreLabel(name, text), enabled: roomFor(delta) };
  };
  const cap = debtInstalmentCap(state);
  const years = debtInstalmentYears(state, amount, cap);
  const note = kind === "cash" ? COPY.treasuryNow(money(Math.max(0, treasuryBalance(state))))
    : kind === "debt_assumption" ? (cap <= 0 ? COPY.instalmentNone
      : [COPY.instalmentCap(money(cap)), amount > 0 && years !== null ? COPY.instalmentYears(years) : null, roomFor(small) ? null : COPY.instalmentTooLong(DEBT_INSTALMENT_MAX_YEARS)]
        .filter(Boolean).join(" · "))
    : kind === "debt_after_inheritance" ? `${COPY.theirDebt(money(theirDebt(state)))} · ${COPY.debtLeft(money(Math.max(0, theirDebt(state) - debtNow)))}. ${COPY.deferredNote}`
    : null;
  return { kind, side: "ours", name, value: kind === "pension" ? COPY.pensionLine(money(amount), draft.pensionYears) : money(amount),
    steps: [step(-big), step(-small), step(small), step(big)],
    years: kind === "pension" ? { value: draft.pensionYears, less: draft.pensionYears > 1, more: draft.pensionYears < PENSION_YEARS_MAX } : null,
    on: null, switchable: false, note };
}

function switchEditor(state: GameState, draft: Draft, kind: ToggleKind): ClauseEditor {
  const piece = kind === "jointure" ? jointurePiece(state) : null;
  const switchable = kind !== "jointure" || piece !== null;
  const note = kind === "jointure" ? (piece === null ? COPY.jointureNone(JOINTURE_PIECES.map(pieceWord).join("·")) : COPY.jointureOn(pieceWord(piece)))
    : kind === "political_support" ? COPY.supportNote(SUPPORT_YEARS) : kind === "wardship" ? COPY.wardshipNote : null;
  return { kind, side: kind === "jointure" || kind === "political_support" ? "ours" : "theirs", name: COPY.terms[kind], value: null, steps: null, years: null,
    on: switchable && draft.on.includes(kind), switchable, note };
}

export function clauseEditors(state: GameState, draft: Draft): readonly ClauseEditor[] {
  return [...OUR_KINDS, ...THEIR_KINDS].map(kind => (isAmount(kind) ? amountEditor(state, draft, kind) : switchEditor(state, draft, kind)));
}

// --- the phases ----------------------------------------------------------------------------------------------------------

export type LastAnswer = Readonly<{ status: Negotiation["status"]; text: string; tier: string }>;
const lastAnswer = (negotiation: Negotiation | undefined): LastAnswer | null => negotiation === undefined ? null
  : { status: negotiation.status, text: COPY.answers[negotiation.status], tier: COPY.answerTier(COPY.tiers[negotiation.acceptance.tier]) };

export type DraftView = Readonly<{
  phase: "draft"; houses: string; grooms: readonly GroomView[]; bride: PartyView | null; editors: readonly ClauseEditor[];
  rows: readonly TreatyRow[]; preview: AcceptanceView; ceiling: number; ceilingBelow: boolean;
  refusal: MarriageRefusal | null; refusalText: string | null; terms: readonly Term[]; groomId: string | null;
  last: LastAnswer | null; seal: "empty" | "broken";
}>;

export type CounterRow = TreatyRow & Readonly<{ mark: "same" | "changed" | "rejected"; markWord: string; change: string | null }>;
/** DEC-CARD: one answer to the counter — what it does now, later, and who remembers it (the heavy cards' words). */
export type CounterOutlook = Readonly<{ id: "accept" | "refuse"; label: string; now: readonly string[]; later: readonly string[]; remembers: readonly string[] }>;
export type CounterView = Readonly<{
  phase: "countered"; houses: string; negotiationId: string; rows: readonly CounterRow[]; preview: AcceptanceView; offered: string;
  deadline: string; canAccept: boolean; canRefuse: boolean; last: LastAnswer; seal: "empty";
  /** What silence means: a counter not answered by its deadline lapses (withdrawn, NG-5). */
  silence: string;
  /** Each answer the engine takes now, run on the state (`answer_counter`): the contract, its promises and witnesses. */
  outlook: readonly CounterOutlook[];
}>;

export type TimelineEvent = Readonly<{ key: string; tick: number; date: string; text: string }>;
export type TimelineView = Readonly<{
  phase: "contract"; houses: string; stage: MarriageStage; stageWord: string; couple: string; contracted: string;
  rows: readonly TreatyRow[]; events: readonly TimelineEvent[]; details: readonly string[]; outcome: string | null;
  due: "will_change" | "contested" | null; dueText: string | null; suitFocus: string | null; last: LastAnswer | null; seal: "stamped";
}>;

export type NegotiationScreenView = DraftView | CounterView | TimelineView;

function houses(state: GameState): string {
  // Houses by their Korean reading (GENTRY_NAMES_KO, the registry card's and the other lord screens' rule).
  const ko = (name: string) => GENTRY_NAMES_KO[name] ?? name;
  const theirs = counterpartEstate(state, COUNTERPART)?.house?.name;
  return COPY.houses(ko(lordshipOf(state).house.name), theirs === undefined ? COPY.theirHouseFallback : ko(theirs));
}

export function draftView(state: GameState, draft: Draft): DraftView {
  const groomList = grooms(state, draft);
  const groomId = groomList.find(entry => entry.chosen)?.id ?? null;
  const terms = draftTerms(state, draft);
  const offered = withConsent(terms);
  const refusal = marriageRefusal(state, terms, groomId ?? undefined);
  const ceiling = materialCeiling(state, LORD, COUNTERPART, offered);
  const last = lastAnswer(diplomacyOf(state).negotiations.at(-1));
  return { phase: "draft", houses: houses(state), grooms: groomList, bride: bride(state), editors: clauseEditors(state, draft),
    rows: offered.map(treatyRow), preview: acceptanceView(evaluateOffer(state, LORD, COUNTERPART, offered)), ceiling, ceilingBelow: ceiling < ACCEPT_THETA,
    refusal, refusalText: refusal === null ? null : COPY.refusals[refusal], terms, groomId, last, seal: last === null ? "empty" : "broken" };
}

/** The counter's clauses beside the offer's: changed (added or raised) and rejected (removed: a red line) are marked. */
export function counterRows(negotiation: Negotiation): readonly CounterRow[] {
  const counter = negotiation.counter;
  if (counter === undefined) return [];
  const kinds = [...new Set([...negotiation.terms, ...counter.terms].map(term => term.kind))];
  const rows = kinds.map((kind): CounterRow => {
    const before = negotiation.terms.find(term => term.kind === kind);
    const after = counter.terms.find(term => term.kind === kind);
    const change = counter.changes.find(entry => entry.kind === kind);
    const row = treatyRow((after ?? before)!);
    if (change === undefined) return { ...row, mark: "same", markWord: COPY.marks.same, change: null };
    if (change.change === "removed") return { ...row, mark: "rejected", markWord: COPY.marks.rejected, change: COPY.changeRemoved };
    // An added clause's value is already in its row: the mark says only that it is new.
    const words = change.change === "added" ? COPY.changeAddedPlain
      : COPY.changeRaised(money(change.from ?? 0), money(change.to ?? 0));
    return { ...row, mark: "changed", markWord: COPY.marks.changed, change: words };
  });
  return [...rows.filter(row => row.side === "ours"), ...rows.filter(row => row.side === "theirs")];
}

export function counterView(state: GameState, negotiation: Negotiation): CounterView {
  const left = negotiation.deadline - state.tick;
  // The engine's own command, run on the state (gameReducer, so the faction records it writes are in it too): a refused
  // answer returns the same state (no reason is exposed yet); a taken one is put in words by lordOutcome.
  const run = (accept: boolean) => afterAnswer(state, { type: "answer_counter", negotiationId: negotiation.id, accept });
  const [accepted, refused] = [run(true), run(false)];
  const outlook = ([["accept", accepted], ["refuse", refused]] as const).flatMap(([id, after]): CounterOutlook[] => {
    if (after === null) return [];
    const outcome = lordOutcome(state, after);
    return [{ id, label: id === "accept" ? COPY.accept : COPY.refuse, now: outcome.now, later: outcome.later,
      remembers: outcome.remembers.map(entry => `${entry.who}: ${entry.how}`) }];
  });
  return { phase: "countered", houses: houses(state), negotiationId: negotiation.id, rows: counterRows(negotiation),
    preview: acceptanceView(negotiation.counter!.acceptance), offered: COPY.answerTier(COPY.tiers[negotiation.acceptance.tier]),
    deadline: left < 0 ? COPY.deadlinePast : COPY.deadline(Math.ceil(left / TICKS_PER_DAY)), silence: COPY.counterSilence,
    canAccept: accepted !== null, canRefuse: refused !== null, outlook, last: lastAnswer(negotiation)!, seal: "empty" };
}

const EVENT_ORDER = ["bride_arrived", "child_born", "brother_in_law_born", "father_ill", "will_change", "will_dropped", "father_died"] as const;

/** A person of the marriage (the lord's family after the wedding, the neighbour's house's before): the name, else null. */
function nameOf(state: GameState, id: string | undefined): string | null {
  if (id === undefined) return null;
  const local = id.startsWith("person:") ? id.slice("person:".length) : id;
  const person: Person | undefined = state.persons?.people.find(entry => entry.id === local) ?? state.persons?.past?.find(entry => entry.id === local)
    ?? estatePerson(state, local);
  return person === undefined ? null : lordPersonRow(state, person).name;
}

export function timelineView(state: GameState, plan: MarriagePlan): TimelineView {
  const negotiation = diplomacyOf(state).negotiations.find(entry => entry.id === plan.negotiationId);
  const contracted = negotiation === undefined ? [] : negotiation.counter?.terms ?? negotiation.terms;
  const events: TimelineEvent[] = [{ key: "contracted", tick: plan.contractedTick, date: dateOf(state, plan.contractedTick), text: COPY.events.contracted }];
  for (const key of EVENT_ORDER) {
    const tick = plan.events[key];
    // −1: the seed drew no such event (no brother-in-law, no new will).
    if (tick !== undefined && tick >= 0) events.push({ key, tick, date: dateOf(state, tick), text: COPY.events[key] });
  }
  events.sort((a, b) => a.tick - b.tick);
  const details = [
    plan.brotherInLawId === undefined ? null : COPY.brotherInLaw(nameOf(state, plan.brotherInLawId) ?? COPY.rivalFallback),
    plan.willAnswer === undefined ? null : COPY.willAnswer(COPY.willAnswers[plan.willAnswer]),
    plan.rival === undefined ? null : COPY.rival(nameOf(state, plan.rival) ?? COPY.rivalFallback),
    plan.jointurePieceId === undefined ? null : COPY.jointure(pieceWord(plan.jointurePieceId), plan.jointureSettled === true),
    plan.deferredDebt === undefined ? null : COPY.deferred(money(plan.deferredDebt), plan.stage === "inherited"),
  ].filter((line): line is string => line !== null);
  const due = marriageDecisionDue(state);
  const suit = estatesOf(state).suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === LORD);
  const outcome = plan.stage === "inherited" || plan.stage === "lost" || plan.stage === "contested" ? COPY.outcomes[plan.stage] : null;
  return { phase: "contract", houses: houses(state), stage: plan.stage, stageWord: COPY.stages[plan.stage],
    couple: COPY.couple(nameOf(state, plan.groomId) ?? COPY.ourHouse, nameOf(state, plan.brideId) ?? COPY.theirHouseFallback),
    contracted: COPY.contractedOn(dateOf(state, plan.contractedTick)), rows: contracted.map(treatyRow), events, details, outcome,
    due, dueText: due === "will_change" ? COPY.willDue : due === "contested" ? COPY.contestedDue : null,
    suitFocus: plan.stage === "contested" ? suit?.id ?? plan.claimId : null,
    last: plan.stage === "contracted" ? lastAnswer(negotiation) : null, seal: "stamped" };
}

/** The screen: the contract once made, else the counter waiting, else the draft. */
export function negotiationScreen(state: GameState, draft: Draft): NegotiationScreenView {
  const diplomacy = diplomacyOf(state);
  if (diplomacy.marriage !== undefined) return timelineView(state, diplomacy.marriage);
  const countered = diplomacy.negotiations.find(entry => entry.status === "countered" && entry.counter !== undefined);
  return countered === undefined ? draftView(state, draft) : counterView(state, countered);
}

/** The 혼인 menu item: open in lord mode once there is a marriage, an offer, or a groom and a bride to offer; else why not. */
export function negotiationGateReason(state: GameState): string | null {
  if (!lordMode(state)) return COPY.gate.lordOnly;
  const diplomacy = diplomacyOf(state);
  if (diplomacy.marriage !== undefined || diplomacy.negotiations.length > 0) return null;
  const { groom, bride: found } = marriageCandidates(state);
  return groom === null ? COPY.gate.no_groom : found === null ? COPY.gate.no_bride : null;
}
